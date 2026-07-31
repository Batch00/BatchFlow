-- ============================================================================
-- BatchFlow demo account — read-only enforcement + rolling monthly data
--
-- Run this whole script once in the Supabase SQL editor. It is idempotent:
-- re-running it is safe and will not duplicate or destroy demo data.
--
-- It replaces the old "wipe and re-seed nightly" model:
--   * reset_demo_data()            -> dropped
--   * pg_cron job 'reset-demo-data'-> unscheduled
--   * new pg_cron job 'demo-monthly-topup' runs on the 1st of each month
--
-- What it sets up:
--   Part 1  Read-only enforcement — triggers reject any write made *as* the demo
--           user. Service-role callers (the Edge Function and pg_cron) are
--           unaffected because auth.uid() is NULL for them.
--   Part 2  demo_ensure_structure() — categories, subcategories and recurring
--           rules. Created once with stable IDs so history stays intact.
--   Part 3  demo_generate_month()   — one month of budget + transactions.
--   Part 4  ensure_demo_data()      — backfills any missing month in the trailing
--           window and prunes anything older. This is what cron and the Edge
--           Function call.
--   Part 5  pg_cron schedule.
--
-- Prerequisite: pg_cron enabled (Dashboard -> Database -> Extensions -> pg_cron).
-- ============================================================================


-- ── Shared: the demo user id ────────────────────────────────────────────────
-- Must match VITE_DEMO_USER_ID in the app environment.

CREATE OR REPLACE FUNCTION demo_user_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 'c079f26a-b70b-4eb7-a04a-e0c17769facc'::uuid $$;


-- ============================================================================
-- PART 0 — One-time clean slate  *** DELETES THE DEMO ACCOUNT'S DATA ***
-- ============================================================================
-- The account currently holds data from the old nightly-reset seed: fixed months
-- Oct 2025 - Mar 2026, no recurring-rule links, and a budget that does not add up
-- to a zero-based plan. The generator below deliberately skips any month that
-- already has transactions, so without this step those old months would survive
-- and the history would be half old-format, half new.
--
-- This deletes rows for the demo user ONLY (user_id = demo_user_id()). No other
-- account is touched. Everything it removes is regenerated further down.
--
-- Comment this block out if you would rather keep the existing months as-is and
-- only have new months appended from here on.

DELETE FROM transaction_splits
  WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = demo_user_id());
DELETE FROM transactions    WHERE user_id = demo_user_id();
DELETE FROM budget_plans    WHERE user_id = demo_user_id();
DELETE FROM paycheck_plans  WHERE user_id = demo_user_id();
DELETE FROM recurring_rules WHERE user_id = demo_user_id();
DELETE FROM subcategories   WHERE user_id = demo_user_id();
DELETE FROM categories      WHERE user_id = demo_user_id();


-- How far back the demo keeps data, and how deep the analytics trends go.
CREATE OR REPLACE FUNCTION demo_months_back() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 12 $$;   -- 12 back + current = 13 months

CREATE OR REPLACE FUNCTION demo_months_keep() RETURNS integer
LANGUAGE sql IMMUTABLE AS $$ SELECT 18 $$;   -- prune anything older than this


-- ============================================================================
-- PART 1 — Read-only enforcement
-- ============================================================================
-- The app also blocks writes client-side, but that is a UX affordance, not a
-- guarantee. This is the guarantee: anyone holding the demo credentials still
-- cannot modify a row, even by calling the REST API directly.
--
-- auth.uid() is NULL for the service role and for pg_cron, so the data
-- generators below are unaffected.

CREATE OR REPLACE FUNCTION demo_current_uid()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- auth.uid() raises if there is no request context (e.g. under pg_cron)
  RETURN auth.uid();
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION demo_block_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF demo_current_uid() = demo_user_id() THEN
    RAISE EXCEPTION 'The BatchFlow demo account is read-only.'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions', 'transaction_splits', 'budget_plans',
    'categories', 'subcategories', 'recurring_rules', 'paycheck_plans'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS demo_read_only ON %I', t);
    EXECUTE format(
      'CREATE TRIGGER demo_read_only
         BEFORE INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION demo_block_writes()', t);
  END LOOP;
END $$;


-- ============================================================================
-- PART 2 — Structure (categories, subcategories, recurring rules)
-- ============================================================================
-- Created once and then left alone. Keeping the IDs stable is what lets each
-- new month append to the same history instead of orphaning the old months.

CREATE OR REPLACE FUNCTION demo_ensure_structure()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := demo_user_id();
  c_income uuid; c_housing uuid; c_trans uuid; c_food uuid;
  c_ins uuid; c_savings uuid; c_student uuid; c_personal uuid;
  s_paycheck uuid; s_rent uuid; s_util uuid; s_net uuid;
  s_carpmt uuid; s_gas uuid; s_carins uuid;
  s_groc uuid; s_rest uuid; s_coffee uuid;
  s_health uuid; s_retire uuid; s_emerg uuid; s_loan uuid;
  s_subs uuid; s_ent uuid; s_cloth uuid; s_self uuid;
  start_date date := (date_trunc('month', current_date) - make_interval(months => demo_months_keep()))::date;
  have_cats  integer;
  have_rules integer;
BEGIN
  -- These tables have no unique constraint on (user_id, name), so ON CONFLICT
  -- would not deduplicate. Guard on a count instead, which also keeps the
  -- existing IDs — and therefore the existing history — untouched.
  SELECT count(*) INTO have_cats FROM categories WHERE user_id = uid;

  IF have_cats = 0 THEN
  -- ── Categories ────────────────────────────────────────────────────────────
  INSERT INTO categories (user_id, name, type, color, sort_order) VALUES
    (uid, 'Income',         'income',  '#10b981', 0),
    (uid, 'Housing',        'expense', '#3b82f6', 1),
    (uid, 'Transportation', 'expense', '#f97316', 2),
    (uid, 'Food',           'expense', '#eab308', 3),
    (uid, 'Insurance',      'expense', '#8b5cf6', 4),
    (uid, 'Savings',        'expense', '#14b8a6', 5),
    (uid, 'Student Loans',  'expense', '#ef4444', 6),
    (uid, 'Personal',       'expense', '#ec4899', 7);
  END IF;

  SELECT id INTO c_income   FROM categories WHERE user_id = uid AND name = 'Income';
  SELECT id INTO c_housing  FROM categories WHERE user_id = uid AND name = 'Housing';
  SELECT id INTO c_trans    FROM categories WHERE user_id = uid AND name = 'Transportation';
  SELECT id INTO c_food     FROM categories WHERE user_id = uid AND name = 'Food';
  SELECT id INTO c_ins      FROM categories WHERE user_id = uid AND name = 'Insurance';
  SELECT id INTO c_savings  FROM categories WHERE user_id = uid AND name = 'Savings';
  SELECT id INTO c_student  FROM categories WHERE user_id = uid AND name = 'Student Loans';
  SELECT id INTO c_personal FROM categories WHERE user_id = uid AND name = 'Personal';

  -- ── Subcategories ─────────────────────────────────────────────────────────
  IF have_cats = 0 THEN
  INSERT INTO subcategories (category_id, user_id, name, sort_order) VALUES
    (c_income,   uid, 'Paycheck',             0),
    (c_income,   uid, 'Bonus & Extra',        1),
    (c_housing,  uid, 'Rent / Mortgage',      0),
    (c_housing,  uid, 'Utilities',            1),
    (c_housing,  uid, 'Internet',             2),
    (c_trans,    uid, 'Car Payment',          0),
    (c_trans,    uid, 'Gas',                  1),
    (c_trans,    uid, 'Car Insurance',        2),
    (c_food,     uid, 'Groceries',            0),
    (c_food,     uid, 'Restaurants',          1),
    (c_food,     uid, 'Coffee',               2),
    (c_ins,      uid, 'Health Insurance',     0),
    (c_savings,  uid, 'Retirement',           0),
    (c_savings,  uid, 'Emergency Fund',       1),
    (c_student,  uid, 'Student Loan Payment', 0),
    (c_personal, uid, 'Subscriptions',        0),
    (c_personal, uid, 'Entertainment',        1),
    (c_personal, uid, 'Clothing',             2),
    (c_personal, uid, 'Self Care',            3);
  END IF;

  SELECT id INTO s_paycheck FROM subcategories WHERE user_id = uid AND name = 'Paycheck';
  SELECT id INTO s_rent     FROM subcategories WHERE user_id = uid AND name = 'Rent / Mortgage';
  SELECT id INTO s_util     FROM subcategories WHERE user_id = uid AND name = 'Utilities';
  SELECT id INTO s_net      FROM subcategories WHERE user_id = uid AND name = 'Internet';
  SELECT id INTO s_carpmt   FROM subcategories WHERE user_id = uid AND name = 'Car Payment';
  SELECT id INTO s_gas      FROM subcategories WHERE user_id = uid AND name = 'Gas';
  SELECT id INTO s_carins   FROM subcategories WHERE user_id = uid AND name = 'Car Insurance';
  SELECT id INTO s_groc     FROM subcategories WHERE user_id = uid AND name = 'Groceries';
  SELECT id INTO s_rest     FROM subcategories WHERE user_id = uid AND name = 'Restaurants';
  SELECT id INTO s_coffee   FROM subcategories WHERE user_id = uid AND name = 'Coffee';
  SELECT id INTO s_health   FROM subcategories WHERE user_id = uid AND name = 'Health Insurance';
  SELECT id INTO s_retire   FROM subcategories WHERE user_id = uid AND name = 'Retirement';
  SELECT id INTO s_emerg    FROM subcategories WHERE user_id = uid AND name = 'Emergency Fund';
  SELECT id INTO s_loan     FROM subcategories WHERE user_id = uid AND name = 'Student Loan Payment';
  SELECT id INTO s_subs     FROM subcategories WHERE user_id = uid AND name = 'Subscriptions';
  SELECT id INTO s_ent      FROM subcategories WHERE user_id = uid AND name = 'Entertainment';
  SELECT id INTO s_cloth    FROM subcategories WHERE user_id = uid AND name = 'Clothing';
  SELECT id INTO s_self     FROM subcategories WHERE user_id = uid AND name = 'Self Care';

  -- ── Recurring rules ───────────────────────────────────────────────────────
  -- Two separate monthly paycheck rules rather than one semi-monthly rule,
  -- because the app's frequency vocabulary is weekly/biweekly/monthly/yearly.
  SELECT count(*) INTO have_rules FROM recurring_rules WHERE user_id = uid;
  IF have_rules > 0 THEN
    RETURN;
  END IF;

  INSERT INTO recurring_rules
    (user_id, label, amount, type, frequency, start_date, end_date,
     merchant, notes, category_id, subcategory_id, is_paused)
  VALUES
    (uid, 'Paycheck (1st)',   2500.00, 'income',  'monthly', start_date,      NULL, 'Employer Direct Deposit', 'First paycheck of the month',  c_income,   s_paycheck, false),
    (uid, 'Paycheck (15th)',  2500.00, 'income',  'monthly', start_date + 14, NULL, 'Employer Direct Deposit', 'Second paycheck of the month', c_income,   s_paycheck, false),
    (uid, 'Rent',             1200.00, 'expense', 'monthly', start_date,      NULL, 'Oakwood Apartments',      'Monthly rent',                 c_housing,  s_rent,     false),
    (uid, 'Internet',           59.99, 'expense', 'monthly', start_date + 21, NULL, 'Xfinity',                 NULL,                           c_housing,  s_net,      false),
    (uid, 'Car Payment',       300.00, 'expense', 'monthly', start_date + 9,  NULL, 'Toyota Financial Services', NULL,                         c_trans,    s_carpmt,   false),
    (uid, 'Car Insurance',     100.00, 'expense', 'monthly', start_date + 24, NULL, 'State Farm',              NULL,                           c_trans,    s_carins,   false),
    (uid, 'Health Insurance',  150.00, 'expense', 'monthly', start_date + 26, NULL, 'UnitedHealth',            'Premium',                      c_ins,      s_health,   false),
    (uid, 'Student Loan',      350.00, 'expense', 'monthly', start_date + 27, NULL, 'Navient',                 NULL,                           c_student,  s_loan,     false),
    (uid, '401k Contribution',1000.00, 'expense', 'monthly', start_date + 27, NULL, 'Fidelity 401k',           NULL,                           c_savings,  s_retire,   false),
    (uid, 'Emergency Fund',    600.00, 'expense', 'monthly', start_date + 27, NULL, 'Ally Bank',               'Automatic transfer',           c_savings,  s_emerg,    false),
    (uid, 'Netflix',            15.99, 'expense', 'monthly', start_date + 4,  NULL, 'Netflix',                 NULL,                           c_personal, s_subs,     false),
    (uid, 'Spotify',             9.99, 'expense', 'monthly', start_date + 4,  NULL, 'Spotify',                 NULL,                           c_personal, s_subs,     false),
    (uid, 'Gym Membership',     34.99, 'expense', 'monthly', start_date + 7,  NULL, 'Anytime Fitness',         NULL,                           c_personal, s_self,     false);
END $$;


-- ============================================================================
-- PART 3 — Generate one month
-- ============================================================================
-- Idempotent: does nothing if the month already has transactions, so a re-run
-- never duplicates and never overwrites.
--
-- Dates in the future (relative to today) are written as pending, which is how
-- the current month shows upcoming recurring charges. The client normally
-- generates those itself, but it cannot write as a read-only account, so they
-- are materialised here.

CREATE OR REPLACE FUNCTION demo_generate_month(mk text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid      uuid := demo_user_id();
  m_start  date := to_date(mk || '-01', 'YYYY-MM-DD');
  m_end    date := (to_date(mk || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date;
  today    date := current_date;
  existing integer;
  n        integer := 0;

  c_income uuid; c_housing uuid; c_trans uuid; c_food uuid;
  c_ins uuid; c_savings uuid; c_student uuid; c_personal uuid;
  s_paycheck uuid; s_bonus uuid; s_rent uuid; s_util uuid; s_net uuid;
  s_carpmt uuid; s_gas uuid; s_carins uuid;
  s_groc uuid; s_rest uuid; s_coffee uuid;
  s_health uuid; s_retire uuid; s_emerg uuid; s_loan uuid;
  s_subs uuid; s_ent uuid; s_cloth uuid; s_self uuid;

  r_pay1 uuid; r_pay15 uuid; r_rent uuid; r_net uuid; r_carpmt uuid;
  r_carins uuid; r_health uuid; r_loan uuid; r_401k uuid; r_emerg uuid;
  r_netflix uuid; r_spotify uuid; r_gym uuid;

  txn_id uuid;
  d      date;
  amt    numeric;
  wk     integer;
  month_num integer := EXTRACT(MONTH FROM m_start);
  -- Seasonal utility swing: higher in winter and midsummer
  util_amt numeric;
  ent_budget numeric;
  retire_budget numeric;
BEGIN
  -- Already generated?
  SELECT count(*) INTO existing FROM transactions
    WHERE user_id = uid AND date >= m_start AND date <= m_end;
  IF existing > 0 THEN
    RETURN 0;
  END IF;

  -- Deterministic variance: the same month always produces the same figures,
  -- so a re-run or a backfill is reproducible rather than drifting each time.
  PERFORM setseed(((abs(hashtext(mk)::bigint) % 1000)::float) / 1000.0);

  SELECT id INTO c_income   FROM categories WHERE user_id = uid AND name = 'Income';
  SELECT id INTO c_housing  FROM categories WHERE user_id = uid AND name = 'Housing';
  SELECT id INTO c_trans    FROM categories WHERE user_id = uid AND name = 'Transportation';
  SELECT id INTO c_food     FROM categories WHERE user_id = uid AND name = 'Food';
  SELECT id INTO c_ins      FROM categories WHERE user_id = uid AND name = 'Insurance';
  SELECT id INTO c_savings  FROM categories WHERE user_id = uid AND name = 'Savings';
  SELECT id INTO c_student  FROM categories WHERE user_id = uid AND name = 'Student Loans';
  SELECT id INTO c_personal FROM categories WHERE user_id = uid AND name = 'Personal';

  SELECT id INTO s_paycheck FROM subcategories WHERE user_id = uid AND name = 'Paycheck';
  SELECT id INTO s_bonus    FROM subcategories WHERE user_id = uid AND name = 'Bonus & Extra';
  SELECT id INTO s_rent     FROM subcategories WHERE user_id = uid AND name = 'Rent / Mortgage';
  SELECT id INTO s_util     FROM subcategories WHERE user_id = uid AND name = 'Utilities';
  SELECT id INTO s_net      FROM subcategories WHERE user_id = uid AND name = 'Internet';
  SELECT id INTO s_carpmt   FROM subcategories WHERE user_id = uid AND name = 'Car Payment';
  SELECT id INTO s_gas      FROM subcategories WHERE user_id = uid AND name = 'Gas';
  SELECT id INTO s_carins   FROM subcategories WHERE user_id = uid AND name = 'Car Insurance';
  SELECT id INTO s_groc     FROM subcategories WHERE user_id = uid AND name = 'Groceries';
  SELECT id INTO s_rest     FROM subcategories WHERE user_id = uid AND name = 'Restaurants';
  SELECT id INTO s_coffee   FROM subcategories WHERE user_id = uid AND name = 'Coffee';
  SELECT id INTO s_health   FROM subcategories WHERE user_id = uid AND name = 'Health Insurance';
  SELECT id INTO s_retire   FROM subcategories WHERE user_id = uid AND name = 'Retirement';
  SELECT id INTO s_emerg    FROM subcategories WHERE user_id = uid AND name = 'Emergency Fund';
  SELECT id INTO s_loan     FROM subcategories WHERE user_id = uid AND name = 'Student Loan Payment';
  SELECT id INTO s_subs     FROM subcategories WHERE user_id = uid AND name = 'Subscriptions';
  SELECT id INTO s_ent      FROM subcategories WHERE user_id = uid AND name = 'Entertainment';
  SELECT id INTO s_cloth    FROM subcategories WHERE user_id = uid AND name = 'Clothing';
  SELECT id INTO s_self     FROM subcategories WHERE user_id = uid AND name = 'Self Care';

  SELECT id INTO r_pay1    FROM recurring_rules WHERE user_id = uid AND label = 'Paycheck (1st)';
  SELECT id INTO r_pay15   FROM recurring_rules WHERE user_id = uid AND label = 'Paycheck (15th)';
  SELECT id INTO r_rent    FROM recurring_rules WHERE user_id = uid AND label = 'Rent';
  SELECT id INTO r_net     FROM recurring_rules WHERE user_id = uid AND label = 'Internet';
  SELECT id INTO r_carpmt  FROM recurring_rules WHERE user_id = uid AND label = 'Car Payment';
  SELECT id INTO r_carins  FROM recurring_rules WHERE user_id = uid AND label = 'Car Insurance';
  SELECT id INTO r_health  FROM recurring_rules WHERE user_id = uid AND label = 'Health Insurance';
  SELECT id INTO r_loan    FROM recurring_rules WHERE user_id = uid AND label = 'Student Loan';
  SELECT id INTO r_401k    FROM recurring_rules WHERE user_id = uid AND label = '401k Contribution';
  SELECT id INTO r_emerg   FROM recurring_rules WHERE user_id = uid AND label = 'Emergency Fund';
  SELECT id INTO r_netflix FROM recurring_rules WHERE user_id = uid AND label = 'Netflix';
  SELECT id INTO r_spotify FROM recurring_rules WHERE user_id = uid AND label = 'Spotify';
  SELECT id INTO r_gym     FROM recurring_rules WHERE user_id = uid AND label = 'Gym Membership';

  -- ── Budget plans ──────────────────────────────────────────────────────────
  -- The plan is zero-based: planned expenses total exactly the $5,000 planned
  -- income, so the Dashboard shows "Every dollar is budgeted" — which is the
  -- whole idea the app is built around, and worth demonstrating.
  --
  -- December moves $50 from retirement into entertainment rather than adding it,
  -- so the holiday month stays balanced too.
  ent_budget    := CASE WHEN month_num = 12 THEN 160.00 ELSE 110.00 END;
  retire_budget := CASE WHEN month_num = 12 THEN 950.00 ELSE 1000.00 END;

  -- Clear first: the month had no transactions, so any plan rows here are
  -- leftovers from a partially-completed earlier run.
  DELETE FROM budget_plans   WHERE user_id = uid AND month_key = mk;
  DELETE FROM paycheck_plans WHERE user_id = uid AND month_key = mk;

  INSERT INTO budget_plans (user_id, month_key, category_id, subcategory_id, planned_amount) VALUES
    (uid, mk, c_income,   NULL,          5000.00),
    (uid, mk, NULL,       s_paycheck,    5000.00),
    (uid, mk, NULL,       s_rent,        1200.00),
    (uid, mk, NULL,       s_util,         135.00),
    (uid, mk, NULL,       s_net,           60.00),
    (uid, mk, NULL,       s_carpmt,       300.00),
    (uid, mk, NULL,       s_gas,          135.00),
    (uid, mk, NULL,       s_carins,       100.00),
    (uid, mk, NULL,       s_groc,         450.00),
    (uid, mk, NULL,       s_rest,         180.00),
    (uid, mk, NULL,       s_coffee,        55.00),
    (uid, mk, NULL,       s_health,       150.00),
    (uid, mk, NULL,       s_retire, retire_budget),
    (uid, mk, NULL,       s_emerg,        600.00),
    (uid, mk, NULL,       s_loan,         350.00),
    (uid, mk, NULL,       s_subs,          30.00),
    (uid, mk, NULL,       s_ent,      ent_budget),
    (uid, mk, NULL,       s_cloth,         70.00),
    (uid, mk, NULL,       s_self,          75.00);

  -- ── Paycheck plans (calendar paycheck planning) ───────────────────────────
  INSERT INTO paycheck_plans (user_id, month_key, date, amount, label) VALUES
    (uid, mk, m_start,                    2500.00, 'Paycheck 1'),
    (uid, mk, LEAST(m_start + 14, m_end), 2500.00, 'Paycheck 2');

  -- ── Recurring instances ───────────────────────────────────────────────────
  -- demo_txn marks anything dated after today as pending.
  n := n + demo_txn(m_start,                    2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 1',           c_income,   s_paycheck, r_pay1);
  n := n + demo_txn(LEAST(m_start + 14, m_end), 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 2',           c_income,   s_paycheck, r_pay15);
  n := n + demo_txn(m_start,                    1200.00, 'expense', 'Oakwood Apartments',        'Monthly rent',         c_housing,  s_rent,     r_rent);
  n := n + demo_txn(LEAST(m_start + 4,  m_end),   15.99, 'expense', 'Netflix',                   NULL,                   c_personal, s_subs,     r_netflix);
  n := n + demo_txn(LEAST(m_start + 4,  m_end),    9.99, 'expense', 'Spotify',                   NULL,                   c_personal, s_subs,     r_spotify);
  n := n + demo_txn(LEAST(m_start + 7,  m_end),   34.99, 'expense', 'Anytime Fitness',           'Gym membership',       c_personal, s_self,     r_gym);
  n := n + demo_txn(LEAST(m_start + 9,  m_end),  300.00, 'expense', 'Toyota Financial Services', 'Car payment',          c_trans,    s_carpmt,   r_carpmt);
  n := n + demo_txn(LEAST(m_start + 21, m_end),   59.99, 'expense', 'Xfinity',                   'Internet',             c_housing,  s_net,      r_net);
  n := n + demo_txn(LEAST(m_start + 24, m_end),  100.00, 'expense', 'State Farm',                'Car insurance',        c_trans,    s_carins,   r_carins);
  n := n + demo_txn(LEAST(m_start + 26, m_end),  150.00, 'expense', 'UnitedHealth',              'Health insurance',     c_ins,      s_health,   r_health);
  n := n + demo_txn(LEAST(m_start + 27, m_end),  350.00, 'expense', 'Navient',                   'Student loan payment', c_student,  s_loan,     r_loan);
  n := n + demo_txn(LEAST(m_start + 27, m_end), CASE WHEN month_num = 12 THEN 950.00 ELSE 1000.00 END,
                                                         'expense', 'Fidelity 401k',             '401k contribution',    c_savings,  s_retire,   r_401k);
  n := n + demo_txn(LEAST(m_start + 27, m_end),  600.00, 'expense', 'Ally Bank',                 'Emergency fund',       c_savings,  s_emerg,    r_emerg);

  -- ── Irregular income ──────────────────────────────────────────────────────
  -- Without this the income line is a dead-flat $5,000 across every month, which
  -- reads as fake, and the savings-rate chart sits at ~0 because a zero-based
  -- plan assigns every planned dollar. Real budgets get the occasional windfall,
  -- and that surplus is what shows up as savings.
  IF month_num = 3 THEN
    n := n + demo_txn(LEAST(m_start + 17, m_end), round((900 + random() * 500)::numeric, 2),
           'income', 'IRS', 'Tax refund', c_income, s_bonus, NULL);
  ELSIF month_num = 6 THEN
    n := n + demo_txn(LEAST(m_start + 12, m_end), round((500 + random() * 300)::numeric, 2),
           'income', 'Employer Direct Deposit', 'Mid-year bonus', c_income, s_bonus, NULL);
  ELSIF month_num = 11 THEN
    n := n + demo_txn(LEAST(m_start + 18, m_end), round((600 + random() * 400)::numeric, 2),
           'income', 'Employer Direct Deposit', 'Holiday bonus', c_income, s_bonus, NULL);
  ELSIF month_num % 4 = 1 THEN
    n := n + demo_txn(LEAST(m_start + 8, m_end), round((180 + random() * 220)::numeric, 2),
           'income', 'Freelance Client', 'Side project', c_income, s_bonus, NULL);
  END IF;

  -- ── Utilities: seasonal, one-off (not a recurring rule — the amount varies) ─
  util_amt := CASE
    WHEN month_num IN (12, 1, 2) THEN 125 + random() * 30   -- winter heating
    WHEN month_num IN (6, 7, 8)  THEN 118 + random() * 28   -- summer cooling
    ELSE 95 + random() * 25
  END;
  n := n + demo_txn(LEAST(m_start + 19, m_end), round(util_amt, 2), 'expense', 'City Utilities', 'Electric + water', c_housing, s_util, NULL);

  -- ── Variable spending, one batch per week ─────────────────────────────────
  FOR wk IN 0..3 LOOP
    -- Groceries, roughly weekly
    d := LEAST(m_start + (wk * 7) + 2, m_end);
    IF d <= today THEN
      n := n + demo_txn(d, round((72 + random() * 44)::numeric, 2), 'expense',
             (ARRAY['Aldi','Walmart','Kroger','Trader Joe''s'])[1 + floor(random() * 4)::int],
             'Weekly groceries', c_food, s_groc, NULL);
    END IF;

    -- Gas: three fill-ups a month, skipping one week
    IF wk <> 1 THEN
      d := LEAST(m_start + (wk * 7) + 5, m_end);
      IF d <= today THEN
        n := n + demo_txn(d, round((38 + random() * 20)::numeric, 2), 'expense',
               (ARRAY['Shell','BP','Costco Gas'])[1 + floor(random() * 3)::int],
               'Fill-up', c_trans, s_gas, NULL);
      END IF;
    END IF;

    -- Coffee
    d := LEAST(m_start + (wk * 7) + 3, m_end);
    IF d <= today THEN
      n := n + demo_txn(d, round((8 + random() * 9)::numeric, 2), 'expense',
             (ARRAY['Starbucks','Dutch Bros','Local Roasters'])[1 + floor(random() * 3)::int],
             NULL, c_food, s_coffee, NULL);
    END IF;

    -- Restaurants, most weeks
    IF wk <> 2 THEN
      d := LEAST(m_start + (wk * 7) + 6, m_end);
      IF d <= today THEN
        n := n + demo_txn(d, round((30 + random() * 56)::numeric, 2), 'expense',
               (ARRAY['Chipotle','Panera Bread','Olive Garden','Thai Basil'])[1 + floor(random() * 4)::int],
               'Dinner out', c_food, s_rest, NULL);
      END IF;
    END IF;
  END LOOP;

  -- ── Entertainment: one or two outings, heavier in December ────────────────
  d := LEAST(m_start + 13, m_end);
  IF d <= today THEN
    n := n + demo_txn(d, round((18 + random() * 40)::numeric, 2), 'expense',
           (ARRAY['Regal Cinemas','Steam','Ticketmaster'])[1 + floor(random() * 3)::int],
           NULL, c_personal, s_ent, NULL);
  END IF;
  IF month_num = 12 THEN
    d := LEAST(m_start + 20, m_end);
    IF d <= today THEN
      n := n + demo_txn(d, round((60 + random() * 45)::numeric, 2), 'expense',
             'Ticketmaster', 'Holiday show', c_personal, s_ent, NULL);
    END IF;
  END IF;

  -- ── Split transactions ────────────────────────────────────────────────────
  -- One trip that covers groceries + household, one that covers clothing +
  -- entertainment. These exercise the split rendering on every screen.
  d := LEAST(m_start + 11, m_end);
  IF d <= today THEN
    amt := round((80 + random() * 45)::numeric, 2);
    INSERT INTO transactions (user_id, date, amount, type, merchant, notes,
                              is_split, is_pending, scheduled_date,
                              category_id, subcategory_id, recurring_rule_id)
      VALUES (uid, d, amt, 'expense', 'Target', 'Groceries + household',
              true, false, NULL, NULL, NULL, NULL)
      RETURNING id INTO txn_id;
    INSERT INTO transaction_splits (transaction_id, category_id, subcategory_id, amount) VALUES
      (txn_id, c_food,     s_groc, round(amt * 0.62, 2)),
      (txn_id, c_personal, s_self, round(amt - round(amt * 0.62, 2), 2));
    n := n + 1;
  END IF;

  d := LEAST(m_start + 24, m_end);
  IF d <= today THEN
    amt := round((55 + random() * 60)::numeric, 2);
    INSERT INTO transactions (user_id, date, amount, type, merchant, notes,
                              is_split, is_pending, scheduled_date,
                              category_id, subcategory_id, recurring_rule_id)
      VALUES (uid, d, amt, 'expense', 'Amazon', 'Apparel + media',
              true, false, NULL, NULL, NULL, NULL)
      RETURNING id INTO txn_id;
    INSERT INTO transaction_splits (transaction_id, category_id, subcategory_id, amount) VALUES
      (txn_id, c_personal, s_cloth, round(amt * 0.55, 2)),
      (txn_id, c_personal, s_ent,   round(amt - round(amt * 0.55, 2), 2));
    n := n + 1;
  END IF;

  RETURN n;
END $$;


-- ── Insert helper: decides confirmed vs pending from the date ───────────────

CREATE OR REPLACE FUNCTION demo_txn(
  d date, amt numeric, ttype text, merch text, note text,
  cat uuid, sub uuid, rule uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_future boolean := d > current_date;
BEGIN
  -- Only recurring items exist in the future; a one-off dated ahead of today
  -- would be a transaction the user has not made yet, which makes no sense.
  IF is_future AND rule IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO transactions
    (user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES
    (demo_user_id(), d, amt, ttype, merch, note,
     false, is_future, CASE WHEN is_future THEN d ELSE NULL END, cat, sub, rule);

  RETURN 1;
END $$;


-- ============================================================================
-- PART 4 — Top up and prune
-- ============================================================================
-- Backfills every month in the trailing window that has no data, so a missed
-- cron run self-heals on the next one, and prunes anything past the retention
-- window so the account does not grow without bound.

CREATE OR REPLACE FUNCTION ensure_demo_data()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid       uuid := demo_user_id();
  i         integer;
  mk        text;
  added     integer;
  months    text[] := ARRAY[]::text[];
  total     integer := 0;
  cutoff    date := (date_trunc('month', current_date) - make_interval(months => demo_months_keep()))::date;
  pruned    integer := 0;
BEGIN
  PERFORM demo_ensure_structure();

  -- Oldest first so history reads naturally
  FOR i IN REVERSE demo_months_back()..0 LOOP
    mk := to_char(date_trunc('month', current_date) - make_interval(months => i), 'YYYY-MM');
    added := demo_generate_month(mk);
    IF added > 0 THEN
      months := months || mk;
      total := total + added;
    END IF;
  END LOOP;

  -- ── Prune beyond the retention window ───────────────────────────────────
  DELETE FROM transaction_splits
    WHERE transaction_id IN (
      SELECT id FROM transactions WHERE user_id = uid AND date < cutoff
    );
  DELETE FROM transactions WHERE user_id = uid AND date < cutoff;
  GET DIAGNOSTICS pruned = ROW_COUNT;
  DELETE FROM budget_plans   WHERE user_id = uid AND month_key < to_char(cutoff, 'YYYY-MM');
  DELETE FROM paycheck_plans WHERE user_id = uid AND month_key < to_char(cutoff, 'YYYY-MM');

  -- Stale pending rows: anything still pending whose date has passed is now
  -- history, so confirm it rather than leaving a permanently overdue item.
  UPDATE transactions
     SET is_pending = false
   WHERE user_id = uid AND is_pending = true AND date < current_date;

  IF array_length(months, 1) IS NULL THEN
    RETURN format('Demo already current through %s. Pruned %s old transaction(s).',
                  to_char(current_date, 'YYYY-MM'), pruned);
  END IF;

  RETURN format('Added %s transaction(s) across %s: %s. Pruned %s old transaction(s).',
                total, array_length(months, 1), array_to_string(months, ', '), pruned);
END $$;


-- ============================================================================
-- PART 5 — Schedule
-- ============================================================================

-- Retire the old nightly wipe-and-reseed job.
SELECT cron.unschedule('reset-demo-data')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reset-demo-data');

DROP FUNCTION IF EXISTS reset_demo_data();

-- Monthly top-up: 03:00 UTC on the 1st. ensure_demo_data() backfills every
-- missing month in the window, so a skipped run is corrected by the next one.
SELECT cron.unschedule('demo-monthly-topup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'demo-monthly-topup');

SELECT cron.schedule(
  'demo-monthly-topup',
  '0 3 1 * *',
  'SELECT ensure_demo_data();'
);


-- ============================================================================
-- Run it now so the account is populated immediately.
-- ============================================================================

SELECT ensure_demo_data();

-- Verify:
--   SELECT * FROM cron.job WHERE jobname IN ('demo-monthly-topup','reset-demo-data');
--   SELECT to_char(date,'YYYY-MM') m, count(*), count(*) FILTER (WHERE is_pending) pending
--     FROM transactions WHERE user_id = demo_user_id() GROUP BY 1 ORDER BY 1;
