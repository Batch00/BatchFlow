-- ============================================================
-- BatchFlow demo account: reset function + nightly pg_cron job
-- Demo user: c079f26a-b70b-4eb7-a04a-e0c17769facc
--
-- Run this entire script once in the Supabase SQL editor.
--
-- Prerequisites:
--   1. Enable pg_cron: Dashboard → Database → Extensions → pg_cron
--   2. Deploy the reset-demo-data Edge Function so the manual
--      "Run Now" button in Settings can also trigger a reset.
--
-- What this script does:
--   Step 1 — Creates the reset_demo_data() Postgres function.
--            This function wipes all demo data and re-seeds 6 months
--            of realistic budget + transaction data atomically.
--   Step 2 — Schedules that function to run at 03:00 UTC every night
--            via pg_cron (no Edge Function invocation needed for cron).
-- ============================================================


-- ── Step 1: Create the reset function ────────────────────────────────────────

CREATE OR REPLACE FUNCTION reset_demo_data()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := 'c079f26a-b70b-4eb7-a04a-e0c17769facc';

  -- Fresh UUIDs generated every reset so old references never linger
  cat_income   UUID := gen_random_uuid();
  cat_housing  UUID := gen_random_uuid();
  cat_trans    UUID := gen_random_uuid();
  cat_food     UUID := gen_random_uuid();
  cat_ins      UUID := gen_random_uuid();
  cat_savings  UUID := gen_random_uuid();
  cat_student  UUID := gen_random_uuid();
  cat_personal UUID := gen_random_uuid();

  sub_paycheck      UUID := gen_random_uuid();
  sub_rent          UUID := gen_random_uuid();
  sub_utilities     UUID := gen_random_uuid();
  sub_internet      UUID := gen_random_uuid();
  sub_car_pmt       UUID := gen_random_uuid();
  sub_gas           UUID := gen_random_uuid();
  sub_car_ins       UUID := gen_random_uuid();
  sub_groceries     UUID := gen_random_uuid();
  sub_restaurants   UUID := gen_random_uuid();
  sub_coffee        UUID := gen_random_uuid();
  sub_health_ins    UUID := gen_random_uuid();
  sub_retirement    UUID := gen_random_uuid();
  sub_emergency     UUID := gen_random_uuid();
  sub_student_pay   UUID := gen_random_uuid();
  sub_subscriptions UUID := gen_random_uuid();
  sub_entertainment UUID := gen_random_uuid();
  sub_clothing      UUID := gen_random_uuid();
  sub_selfcare      UUID := gen_random_uuid();

  txn_id UUID;

BEGIN

  -- ── Wipe all existing demo data (FK order) ─────────────────────────────────
  DELETE FROM transaction_splits
    WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = uid);
  DELETE FROM transactions    WHERE user_id = uid;
  DELETE FROM budget_plans    WHERE user_id = uid;
  DELETE FROM recurring_rules WHERE user_id = uid;
  DELETE FROM subcategories   WHERE user_id = uid;
  DELETE FROM categories      WHERE user_id = uid;

  -- ── Re-seed categories ─────────────────────────────────────────────────────
  INSERT INTO categories (id, user_id, name, type, color, sort_order) VALUES
    (cat_income,   uid, 'Income',         'income',  '#10b981', 0),
    (cat_housing,  uid, 'Housing',        'expense', '#3b82f6', 1),
    (cat_trans,    uid, 'Transportation', 'expense', '#f97316', 2),
    (cat_food,     uid, 'Food',           'expense', '#eab308', 3),
    (cat_ins,      uid, 'Insurance',      'expense', '#8b5cf6', 4),
    (cat_savings,  uid, 'Savings',        'expense', '#14b8a6', 5),
    (cat_student,  uid, 'Student Loans',  'expense', '#ef4444', 6),
    (cat_personal, uid, 'Personal',       'expense', '#ec4899', 7);

  -- ── Re-seed subcategories ──────────────────────────────────────────────────
  INSERT INTO subcategories (id, category_id, user_id, name, sort_order) VALUES
    (sub_paycheck,      cat_income,   uid, 'Paycheck',             0),
    (sub_rent,          cat_housing,  uid, 'Rent / Mortgage',      0),
    (sub_utilities,     cat_housing,  uid, 'Utilities',            1),
    (sub_internet,      cat_housing,  uid, 'Internet',             2),
    (sub_car_pmt,       cat_trans,    uid, 'Car Payment',          0),
    (sub_gas,           cat_trans,    uid, 'Gas',                  1),
    (sub_car_ins,       cat_trans,    uid, 'Car Insurance',        2),
    (sub_groceries,     cat_food,     uid, 'Groceries',            0),
    (sub_restaurants,   cat_food,     uid, 'Restaurants',          1),
    (sub_coffee,        cat_food,     uid, 'Coffee',               2),
    (sub_health_ins,    cat_ins,      uid, 'Health Insurance',     0),
    (sub_retirement,    cat_savings,  uid, 'Retirement',           0),
    (sub_emergency,     cat_savings,  uid, 'Emergency Fund',       1),
    (sub_student_pay,   cat_student,  uid, 'Student Loan Payment', 0),
    (sub_subscriptions, cat_personal, uid, 'Subscriptions',        0),
    (sub_entertainment, cat_personal, uid, 'Entertainment',        1),
    (sub_clothing,      cat_personal, uid, 'Clothing',             2),
    (sub_selfcare,      cat_personal, uid, 'Self Care',            3);

  -- ── Budget plans (6 months) ────────────────────────────────────────────────
  -- Same base structure every month; Dec bumps entertainment to $150.

  INSERT INTO budget_plans (id, user_id, month_key, category_id, subcategory_id, planned_amount) VALUES
    -- OCT 2025
    (gen_random_uuid(), uid, '2025-10', cat_income,  NULL,             5000.00),
    (gen_random_uuid(), uid, '2025-10', NULL,  sub_paycheck,     5000.00),
    (gen_random_uuid(), uid, '2025-10', cat_housing, NULL,             1380.00),
    (gen_random_uuid(), uid, '2025-10', NULL, sub_rent,         1200.00),
    (gen_random_uuid(), uid, '2025-10', NULL, sub_utilities,     120.00),
    (gen_random_uuid(), uid, '2025-10', NULL, sub_internet,       60.00),
    (gen_random_uuid(), uid, '2025-10', cat_trans,   NULL,              520.00),
    (gen_random_uuid(), uid, '2025-10', NULL,   sub_car_pmt,       300.00),
    (gen_random_uuid(), uid, '2025-10', NULL,   sub_gas,           120.00),
    (gen_random_uuid(), uid, '2025-10', NULL,   sub_car_ins,       100.00),
    (gen_random_uuid(), uid, '2025-10', cat_food,    NULL,              590.00),
    (gen_random_uuid(), uid, '2025-10', NULL,    sub_groceries,     400.00),
    (gen_random_uuid(), uid, '2025-10', NULL,    sub_restaurants,   150.00),
    (gen_random_uuid(), uid, '2025-10', NULL,    sub_coffee,         40.00),
    (gen_random_uuid(), uid, '2025-10', cat_ins,     NULL,              150.00),
    (gen_random_uuid(), uid, '2025-10', NULL,     sub_health_ins,    150.00),
    (gen_random_uuid(), uid, '2025-10', cat_savings, NULL,              350.00),
    (gen_random_uuid(), uid, '2025-10', NULL, sub_emergency,     150.00),
    (gen_random_uuid(), uid, '2025-10', NULL, sub_retirement,    200.00),
    (gen_random_uuid(), uid, '2025-10', cat_student, NULL,              350.00),
    (gen_random_uuid(), uid, '2025-10', NULL, sub_student_pay,   350.00),
    (gen_random_uuid(), uid, '2025-10', cat_personal,NULL,              200.00),
    (gen_random_uuid(), uid, '2025-10', NULL,sub_subscriptions,  50.00),
    (gen_random_uuid(), uid, '2025-10', NULL,sub_entertainment, 100.00),
    (gen_random_uuid(), uid, '2025-10', NULL,sub_clothing,       50.00),
    -- NOV 2025
    (gen_random_uuid(), uid, '2025-11', cat_income,  NULL,             5000.00),
    (gen_random_uuid(), uid, '2025-11', NULL,  sub_paycheck,     5000.00),
    (gen_random_uuid(), uid, '2025-11', cat_housing, NULL,             1380.00),
    (gen_random_uuid(), uid, '2025-11', NULL, sub_rent,         1200.00),
    (gen_random_uuid(), uid, '2025-11', NULL, sub_utilities,     120.00),
    (gen_random_uuid(), uid, '2025-11', NULL, sub_internet,       60.00),
    (gen_random_uuid(), uid, '2025-11', cat_trans,   NULL,              520.00),
    (gen_random_uuid(), uid, '2025-11', NULL,   sub_car_pmt,       300.00),
    (gen_random_uuid(), uid, '2025-11', NULL,   sub_gas,           120.00),
    (gen_random_uuid(), uid, '2025-11', NULL,   sub_car_ins,       100.00),
    (gen_random_uuid(), uid, '2025-11', cat_food,    NULL,              590.00),
    (gen_random_uuid(), uid, '2025-11', NULL,    sub_groceries,     400.00),
    (gen_random_uuid(), uid, '2025-11', NULL,    sub_restaurants,   150.00),
    (gen_random_uuid(), uid, '2025-11', NULL,    sub_coffee,         40.00),
    (gen_random_uuid(), uid, '2025-11', cat_ins,     NULL,              150.00),
    (gen_random_uuid(), uid, '2025-11', NULL,     sub_health_ins,    150.00),
    (gen_random_uuid(), uid, '2025-11', cat_savings, NULL,              350.00),
    (gen_random_uuid(), uid, '2025-11', NULL, sub_emergency,     150.00),
    (gen_random_uuid(), uid, '2025-11', NULL, sub_retirement,    200.00),
    (gen_random_uuid(), uid, '2025-11', cat_student, NULL,              350.00),
    (gen_random_uuid(), uid, '2025-11', NULL, sub_student_pay,   350.00),
    (gen_random_uuid(), uid, '2025-11', cat_personal,NULL,              200.00),
    (gen_random_uuid(), uid, '2025-11', NULL,sub_subscriptions,  50.00),
    (gen_random_uuid(), uid, '2025-11', NULL,sub_entertainment, 100.00),
    (gen_random_uuid(), uid, '2025-11', NULL,sub_clothing,       50.00),
    -- DEC 2025 (entertainment + personal bumped for holidays)
    (gen_random_uuid(), uid, '2025-12', cat_income,  NULL,             5000.00),
    (gen_random_uuid(), uid, '2025-12', NULL,  sub_paycheck,     5000.00),
    (gen_random_uuid(), uid, '2025-12', cat_housing, NULL,             1380.00),
    (gen_random_uuid(), uid, '2025-12', NULL, sub_rent,         1200.00),
    (gen_random_uuid(), uid, '2025-12', NULL, sub_utilities,     120.00),
    (gen_random_uuid(), uid, '2025-12', NULL, sub_internet,       60.00),
    (gen_random_uuid(), uid, '2025-12', cat_trans,   NULL,              520.00),
    (gen_random_uuid(), uid, '2025-12', NULL,   sub_car_pmt,       300.00),
    (gen_random_uuid(), uid, '2025-12', NULL,   sub_gas,           120.00),
    (gen_random_uuid(), uid, '2025-12', NULL,   sub_car_ins,       100.00),
    (gen_random_uuid(), uid, '2025-12', cat_food,    NULL,              590.00),
    (gen_random_uuid(), uid, '2025-12', NULL,    sub_groceries,     400.00),
    (gen_random_uuid(), uid, '2025-12', NULL,    sub_restaurants,   150.00),
    (gen_random_uuid(), uid, '2025-12', NULL,    sub_coffee,         40.00),
    (gen_random_uuid(), uid, '2025-12', cat_ins,     NULL,              150.00),
    (gen_random_uuid(), uid, '2025-12', NULL,     sub_health_ins,    150.00),
    (gen_random_uuid(), uid, '2025-12', cat_savings, NULL,              350.00),
    (gen_random_uuid(), uid, '2025-12', NULL, sub_emergency,     150.00),
    (gen_random_uuid(), uid, '2025-12', NULL, sub_retirement,    200.00),
    (gen_random_uuid(), uid, '2025-12', cat_student, NULL,              350.00),
    (gen_random_uuid(), uid, '2025-12', NULL, sub_student_pay,   350.00),
    (gen_random_uuid(), uid, '2025-12', cat_personal,NULL,              250.00),
    (gen_random_uuid(), uid, '2025-12', NULL,sub_subscriptions,  50.00),
    (gen_random_uuid(), uid, '2025-12', NULL,sub_entertainment, 150.00),
    (gen_random_uuid(), uid, '2025-12', NULL,sub_clothing,       50.00),
    -- JAN 2026
    (gen_random_uuid(), uid, '2026-01', cat_income,  NULL,             5000.00),
    (gen_random_uuid(), uid, '2026-01', NULL,  sub_paycheck,     5000.00),
    (gen_random_uuid(), uid, '2026-01', cat_housing, NULL,             1380.00),
    (gen_random_uuid(), uid, '2026-01', NULL, sub_rent,         1200.00),
    (gen_random_uuid(), uid, '2026-01', NULL, sub_utilities,     120.00),
    (gen_random_uuid(), uid, '2026-01', NULL, sub_internet,       60.00),
    (gen_random_uuid(), uid, '2026-01', cat_trans,   NULL,              520.00),
    (gen_random_uuid(), uid, '2026-01', NULL,   sub_car_pmt,       300.00),
    (gen_random_uuid(), uid, '2026-01', NULL,   sub_gas,           120.00),
    (gen_random_uuid(), uid, '2026-01', NULL,   sub_car_ins,       100.00),
    (gen_random_uuid(), uid, '2026-01', cat_food,    NULL,              590.00),
    (gen_random_uuid(), uid, '2026-01', NULL,    sub_groceries,     400.00),
    (gen_random_uuid(), uid, '2026-01', NULL,    sub_restaurants,   150.00),
    (gen_random_uuid(), uid, '2026-01', NULL,    sub_coffee,         40.00),
    (gen_random_uuid(), uid, '2026-01', cat_ins,     NULL,              150.00),
    (gen_random_uuid(), uid, '2026-01', NULL,     sub_health_ins,    150.00),
    (gen_random_uuid(), uid, '2026-01', cat_savings, NULL,              350.00),
    (gen_random_uuid(), uid, '2026-01', NULL, sub_emergency,     150.00),
    (gen_random_uuid(), uid, '2026-01', NULL, sub_retirement,    200.00),
    (gen_random_uuid(), uid, '2026-01', cat_student, NULL,              350.00),
    (gen_random_uuid(), uid, '2026-01', NULL, sub_student_pay,   350.00),
    (gen_random_uuid(), uid, '2026-01', cat_personal,NULL,              200.00),
    (gen_random_uuid(), uid, '2026-01', NULL,sub_subscriptions,  50.00),
    (gen_random_uuid(), uid, '2026-01', NULL,sub_entertainment, 100.00),
    (gen_random_uuid(), uid, '2026-01', NULL,sub_clothing,       50.00),
    -- FEB 2026
    (gen_random_uuid(), uid, '2026-02', cat_income,  NULL,             5000.00),
    (gen_random_uuid(), uid, '2026-02', NULL,  sub_paycheck,     5000.00),
    (gen_random_uuid(), uid, '2026-02', cat_housing, NULL,             1380.00),
    (gen_random_uuid(), uid, '2026-02', NULL, sub_rent,         1200.00),
    (gen_random_uuid(), uid, '2026-02', NULL, sub_utilities,     120.00),
    (gen_random_uuid(), uid, '2026-02', NULL, sub_internet,       60.00),
    (gen_random_uuid(), uid, '2026-02', cat_trans,   NULL,              520.00),
    (gen_random_uuid(), uid, '2026-02', NULL,   sub_car_pmt,       300.00),
    (gen_random_uuid(), uid, '2026-02', NULL,   sub_gas,           120.00),
    (gen_random_uuid(), uid, '2026-02', NULL,   sub_car_ins,       100.00),
    (gen_random_uuid(), uid, '2026-02', cat_food,    NULL,              590.00),
    (gen_random_uuid(), uid, '2026-02', NULL,    sub_groceries,     400.00),
    (gen_random_uuid(), uid, '2026-02', NULL,    sub_restaurants,   150.00),
    (gen_random_uuid(), uid, '2026-02', NULL,    sub_coffee,         40.00),
    (gen_random_uuid(), uid, '2026-02', cat_ins,     NULL,              150.00),
    (gen_random_uuid(), uid, '2026-02', NULL,     sub_health_ins,    150.00),
    (gen_random_uuid(), uid, '2026-02', cat_savings, NULL,              350.00),
    (gen_random_uuid(), uid, '2026-02', NULL, sub_emergency,     150.00),
    (gen_random_uuid(), uid, '2026-02', NULL, sub_retirement,    200.00),
    (gen_random_uuid(), uid, '2026-02', cat_student, NULL,              350.00),
    (gen_random_uuid(), uid, '2026-02', NULL, sub_student_pay,   350.00),
    (gen_random_uuid(), uid, '2026-02', cat_personal,NULL,              200.00),
    (gen_random_uuid(), uid, '2026-02', NULL,sub_subscriptions,  50.00),
    (gen_random_uuid(), uid, '2026-02', NULL,sub_entertainment, 100.00),
    (gen_random_uuid(), uid, '2026-02', NULL,sub_clothing,       50.00),
    -- MAR 2026
    (gen_random_uuid(), uid, '2026-03', cat_income,  NULL,             5000.00),
    (gen_random_uuid(), uid, '2026-03', NULL,  sub_paycheck,     5000.00),
    (gen_random_uuid(), uid, '2026-03', cat_housing, NULL,             1380.00),
    (gen_random_uuid(), uid, '2026-03', NULL, sub_rent,         1200.00),
    (gen_random_uuid(), uid, '2026-03', NULL, sub_utilities,     120.00),
    (gen_random_uuid(), uid, '2026-03', NULL, sub_internet,       60.00),
    (gen_random_uuid(), uid, '2026-03', cat_trans,   NULL,              520.00),
    (gen_random_uuid(), uid, '2026-03', NULL,   sub_car_pmt,       300.00),
    (gen_random_uuid(), uid, '2026-03', NULL,   sub_gas,           120.00),
    (gen_random_uuid(), uid, '2026-03', NULL,   sub_car_ins,       100.00),
    (gen_random_uuid(), uid, '2026-03', cat_food,    NULL,              590.00),
    (gen_random_uuid(), uid, '2026-03', NULL,    sub_groceries,     400.00),
    (gen_random_uuid(), uid, '2026-03', NULL,    sub_restaurants,   150.00),
    (gen_random_uuid(), uid, '2026-03', NULL,    sub_coffee,         40.00),
    (gen_random_uuid(), uid, '2026-03', cat_ins,     NULL,              150.00),
    (gen_random_uuid(), uid, '2026-03', NULL,     sub_health_ins,    150.00),
    (gen_random_uuid(), uid, '2026-03', cat_savings, NULL,              350.00),
    (gen_random_uuid(), uid, '2026-03', NULL, sub_emergency,     150.00),
    (gen_random_uuid(), uid, '2026-03', NULL, sub_retirement,    200.00),
    (gen_random_uuid(), uid, '2026-03', cat_student, NULL,              350.00),
    (gen_random_uuid(), uid, '2026-03', NULL, sub_student_pay,   350.00),
    (gen_random_uuid(), uid, '2026-03', cat_personal,NULL,              200.00),
    (gen_random_uuid(), uid, '2026-03', NULL,sub_subscriptions,  50.00),
    (gen_random_uuid(), uid, '2026-03', NULL,sub_entertainment, 100.00),
    (gen_random_uuid(), uid, '2026-03', NULL,sub_clothing,       50.00);

  -- ── Transactions ───────────────────────────────────────────────────────────

  -- ── OCTOBER 2025 — normal month, all within budget ─────────────────────────
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES
    (gen_random_uuid(), uid, '2025-10-01', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 1',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2025-10-15', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 2',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2025-10-01', 1200.00, 'expense', 'Oakwood Apartments',        'October rent',             false, false, NULL, cat_housing, sub_rent,        NULL),
    (gen_random_uuid(), uid, '2025-10-05',   15.99, 'expense', 'Netflix',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2025-10-05',    9.99, 'expense', 'Spotify',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2025-10-10',  300.00, 'expense', 'Toyota Financial Services', 'Car payment',              false, false, NULL, cat_trans,   sub_car_pmt,     NULL),
    (gen_random_uuid(), uid, '2025-10-20',  108.43, 'expense', 'City Utilities',            'Electric + water',         false, false, NULL, cat_housing, sub_utilities,   NULL),
    (gen_random_uuid(), uid, '2025-10-22',   59.99, 'expense', 'Xfinity',                   'Internet',                 false, false, NULL, cat_housing, sub_internet,    NULL),
    (gen_random_uuid(), uid, '2025-10-25',  100.00, 'expense', 'State Farm',                'Car insurance',            false, false, NULL, cat_trans,   sub_car_ins,     NULL),
    (gen_random_uuid(), uid, '2025-10-27',  150.00, 'expense', 'UnitedHealth',              'Health insurance premium', false, false, NULL, cat_ins,     sub_health_ins,  NULL),
    (gen_random_uuid(), uid, '2025-10-28',  350.00, 'expense', 'Navient',                   'Student loan payment',     false, false, NULL, cat_student, sub_student_pay, NULL),
    (gen_random_uuid(), uid, '2025-10-28',  150.00, 'expense', 'Ally Bank',                 'Emergency fund transfer',  false, false, NULL, cat_savings, sub_emergency,   NULL),
    (gen_random_uuid(), uid, '2025-10-28',  200.00, 'expense', 'Fidelity 401k',             '401k contribution',        false, false, NULL, cat_savings, sub_retirement,  NULL),
    (gen_random_uuid(), uid, '2025-10-03',   78.43, 'expense', 'Aldi',                      'Weekly groceries',         false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-10-07',   34.50, 'expense', 'Chipotle',                  'Lunch',                    false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2025-10-09',   14.25, 'expense', 'Starbucks',                 'Coffee run',               false, false, NULL, cat_food,    sub_coffee,      NULL),
    (gen_random_uuid(), uid, '2025-10-11',   62.18, 'expense', 'Walmart',                   'Groceries',                false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-10-12',   45.20, 'expense', 'Shell',                     'Gas',                      false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2025-10-16',   71.34, 'expense', 'Aldi',                      'Weekly groceries',         false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-10-17',   28.75, 'expense', 'Panera Bread',              'Lunch',                    false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2025-10-19',   11.50, 'expense', 'Dutch Bros',                'Coffee',                   false, false, NULL, cat_food,    sub_coffee,      NULL),
    (gen_random_uuid(), uid, '2025-10-23',   38.60, 'expense', 'BP',                        'Gas fill-up',              false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2025-10-24',   67.88, 'expense', 'Aldi',                      'Groceries',                false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-10-29',   24.99, 'expense', 'Amazon',                    'Household item',           false, false, NULL, cat_personal,sub_entertainment,NULL),
    (gen_random_uuid(), uid, '2025-10-30',   18.99, 'expense', 'Walgreens',                 'Personal care',            false, false, NULL, cat_personal,sub_selfcare,    NULL);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2025-10-13', 112.67, 'expense', 'Target', 'Household + personal', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 68.42),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  44.25);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2025-10-21', 95.23, 'expense', 'Walmart', 'Groceries + household', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 72.14),
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 23.09);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2025-10-29', 89.43, 'expense', 'Amazon', 'Order: media + apparel', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_entertainment, 39.99),
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,      49.44);

  -- ── NOVEMBER 2025 — over budget on Restaurants ($186.45 vs $150) ───────────
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES
    (gen_random_uuid(), uid, '2025-11-01', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 1',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2025-11-15', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 2',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2025-11-01', 1200.00, 'expense', 'Oakwood Apartments',        'November rent',            false, false, NULL, cat_housing, sub_rent,        NULL),
    (gen_random_uuid(), uid, '2025-11-05',   15.99, 'expense', 'Netflix',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2025-11-05',    9.99, 'expense', 'Spotify',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2025-11-10',  300.00, 'expense', 'Toyota Financial Services', 'Car payment',              false, false, NULL, cat_trans,   sub_car_pmt,     NULL),
    (gen_random_uuid(), uid, '2025-11-20',  115.67, 'expense', 'City Utilities',            'Electric + water',         false, false, NULL, cat_housing, sub_utilities,   NULL),
    (gen_random_uuid(), uid, '2025-11-22',   59.99, 'expense', 'Xfinity',                   'Internet',                 false, false, NULL, cat_housing, sub_internet,    NULL),
    (gen_random_uuid(), uid, '2025-11-25',  100.00, 'expense', 'State Farm',                'Car insurance',            false, false, NULL, cat_trans,   sub_car_ins,     NULL),
    (gen_random_uuid(), uid, '2025-11-27',  150.00, 'expense', 'UnitedHealth',              'Health insurance premium', false, false, NULL, cat_ins,     sub_health_ins,  NULL),
    (gen_random_uuid(), uid, '2025-11-28',  350.00, 'expense', 'Navient',                   'Student loan payment',     false, false, NULL, cat_student, sub_student_pay, NULL),
    (gen_random_uuid(), uid, '2025-11-28',  150.00, 'expense', 'Ally Bank',                 'Emergency fund transfer',  false, false, NULL, cat_savings, sub_emergency,   NULL),
    (gen_random_uuid(), uid, '2025-11-28',  200.00, 'expense', 'Fidelity 401k',             '401k contribution',        false, false, NULL, cat_savings, sub_retirement,  NULL),
    (gen_random_uuid(), uid, '2025-11-04',   83.21, 'expense', 'Aldi',                      'Weekly groceries',         false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-11-06',   45.80, 'expense', 'Chili''s',                  'Dinner with friends',      false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2025-11-08',   13.50, 'expense', 'Starbucks',                 'Coffee',                   false, false, NULL, cat_food,    sub_coffee,      NULL),
    (gen_random_uuid(), uid, '2025-11-11',   58.77, 'expense', 'Walmart',                   'Groceries',                false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-11-13',   43.40, 'expense', 'Shell',                     'Gas',                      false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2025-11-17',   76.92, 'expense', 'Aldi',                      'Weekly groceries',         false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-11-19',   62.15, 'expense', 'Olive Garden',              'Pre-Thanksgiving dinner',  false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2025-11-24',   35.60, 'expense', 'BP',                        'Gas fill-up',              false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2025-11-26',   88.43, 'expense', 'Aldi',                      'Post-Thanksgiving groceries',false,false,NULL, cat_food,   sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-11-27',   78.50, 'expense', 'Texas Roadhouse',           'Thanksgiving eve dinner',  false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2025-11-29',   14.25, 'expense', 'Dutch Bros',                'Coffee',                   false, false, NULL, cat_food,    sub_coffee,      NULL);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2025-11-29', 134.88, 'expense', 'Target', 'Black Friday shopping', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,       79.99),
    (gen_random_uuid(), txn_id, cat_personal,sub_entertainment,  54.89);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2025-11-14', 76.43, 'expense', 'Amazon', 'Household items', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 32.44),
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 43.99);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2025-11-21', 52.18, 'expense', 'Walgreens', 'Medicine + snacks', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  29.74),
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 22.44);

  -- ── DECEMBER 2025 — over budget on Entertainment ($159.99 vs $150) ──────────
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES
    (gen_random_uuid(), uid, '2025-12-01', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 1',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2025-12-15', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 2',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2025-12-01', 1200.00, 'expense', 'Oakwood Apartments',        'December rent',            false, false, NULL, cat_housing, sub_rent,        NULL),
    (gen_random_uuid(), uid, '2025-12-05',   15.99, 'expense', 'Netflix',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2025-12-05',    9.99, 'expense', 'Spotify',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2025-12-10',  300.00, 'expense', 'Toyota Financial Services', 'Car payment',              false, false, NULL, cat_trans,   sub_car_pmt,     NULL),
    (gen_random_uuid(), uid, '2025-12-16',   29.99, 'expense', 'Disney+',                   'Annual subscription',      false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2025-12-20',  132.18, 'expense', 'City Utilities',            'Electric + water (cold)', false, false, NULL, cat_housing, sub_utilities,   NULL),
    (gen_random_uuid(), uid, '2025-12-22',   59.99, 'expense', 'Xfinity',                   'Internet',                 false, false, NULL, cat_housing, sub_internet,    NULL),
    (gen_random_uuid(), uid, '2025-12-25',  100.00, 'expense', 'State Farm',                'Car insurance',            false, false, NULL, cat_trans,   sub_car_ins,     NULL),
    (gen_random_uuid(), uid, '2025-12-27',  150.00, 'expense', 'UnitedHealth',              'Health insurance premium', false, false, NULL, cat_ins,     sub_health_ins,  NULL),
    (gen_random_uuid(), uid, '2025-12-28',  350.00, 'expense', 'Navient',                   'Student loan payment',     false, false, NULL, cat_student, sub_student_pay, NULL),
    (gen_random_uuid(), uid, '2025-12-28',  150.00, 'expense', 'Ally Bank',                 'Emergency fund transfer',  false, false, NULL, cat_savings, sub_emergency,   NULL),
    (gen_random_uuid(), uid, '2025-12-28',  200.00, 'expense', 'Fidelity 401k',             '401k contribution',        false, false, NULL, cat_savings, sub_retirement,  NULL),
    (gen_random_uuid(), uid, '2025-12-03',   91.67, 'expense', 'Aldi',                      'Weekly groceries',         false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-12-07',   55.20, 'expense', 'Chili''s',                  'Dinner',                   false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2025-12-09',   16.50, 'expense', 'Starbucks',                 'Holiday drinks',           false, false, NULL, cat_food,    sub_coffee,      NULL),
    (gen_random_uuid(), uid, '2025-12-12',   64.35, 'expense', 'Walmart',                   'Groceries + supplies',     false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-12-13',   48.70, 'expense', 'Shell',                     'Gas',                      false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2025-12-14',   85.00, 'expense', 'Ticketmaster',              'Holiday concert tickets',  false, false, NULL, cat_personal,sub_entertainment,NULL),
    (gen_random_uuid(), uid, '2025-12-17',   79.44, 'expense', 'Aldi',                      'Holiday groceries',        false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-12-18',   72.30, 'expense', 'Cheesecake Factory',        'Christmas dinner outing',  false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2025-12-21',   49.99, 'expense', 'Steam',                     'Holiday game sale',        false, false, NULL, cat_personal,sub_entertainment,NULL),
    (gen_random_uuid(), uid, '2025-12-23',   39.80, 'expense', 'BP',                        'Gas before Christmas',     false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2025-12-26',   25.00, 'expense', 'Regal Cinemas',             'Movie',                    false, false, NULL, cat_personal,sub_entertainment,NULL),
    (gen_random_uuid(), uid, '2025-12-30',   18.75, 'expense', 'Dutch Bros',                'Coffee',                   false, false, NULL, cat_food,    sub_coffee,      NULL);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2025-12-19', 187.43, 'expense', 'Target', 'Christmas shopping', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,  112.44),
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries,  74.99);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2025-12-08', 126.78, 'expense', 'Amazon', 'Christmas gifts + household', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,  88.99),
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 37.79);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2025-12-11', 53.42, 'expense', 'Walgreens', 'Medicine + personal care', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  31.99),
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 21.43);

  -- ── JANUARY 2026 — under budget (new year frugality) ──────────────────────
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES
    (gen_random_uuid(), uid, '2026-01-01', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 1',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2026-01-15', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 2',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2026-01-01', 1200.00, 'expense', 'Oakwood Apartments',        'January rent',             false, false, NULL, cat_housing, sub_rent,        NULL),
    (gen_random_uuid(), uid, '2026-01-05',   15.99, 'expense', 'Netflix',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2026-01-05',    9.99, 'expense', 'Spotify',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2026-01-10',  300.00, 'expense', 'Toyota Financial Services', 'Car payment',              false, false, NULL, cat_trans,   sub_car_pmt,     NULL),
    (gen_random_uuid(), uid, '2026-01-20',  102.55, 'expense', 'City Utilities',            'Electric + water',         false, false, NULL, cat_housing, sub_utilities,   NULL),
    (gen_random_uuid(), uid, '2026-01-22',   59.99, 'expense', 'Xfinity',                   'Internet',                 false, false, NULL, cat_housing, sub_internet,    NULL),
    (gen_random_uuid(), uid, '2026-01-25',  100.00, 'expense', 'State Farm',                'Car insurance',            false, false, NULL, cat_trans,   sub_car_ins,     NULL),
    (gen_random_uuid(), uid, '2026-01-27',  150.00, 'expense', 'UnitedHealth',              'Health insurance premium', false, false, NULL, cat_ins,     sub_health_ins,  NULL),
    (gen_random_uuid(), uid, '2026-01-28',  350.00, 'expense', 'Navient',                   'Student loan payment',     false, false, NULL, cat_student, sub_student_pay, NULL),
    (gen_random_uuid(), uid, '2026-01-28',  150.00, 'expense', 'Ally Bank',                 'Emergency fund transfer',  false, false, NULL, cat_savings, sub_emergency,   NULL),
    (gen_random_uuid(), uid, '2026-01-28',  200.00, 'expense', 'Fidelity 401k',             '401k contribution',        false, false, NULL, cat_savings, sub_retirement,  NULL),
    (gen_random_uuid(), uid, '2026-01-04',   65.22, 'expense', 'Aldi',                      'Groceries',                false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2026-01-07',   22.50, 'expense', 'Chipotle',                  'Lunch',                    false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2026-01-09',    8.75, 'expense', 'McDonald''s',               'Coffee + breakfast',       false, false, NULL, cat_food,    sub_coffee,      NULL),
    (gen_random_uuid(), uid, '2026-01-13',   71.88, 'expense', 'Walmart',                   'Groceries',                false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2026-01-14',   40.50, 'expense', 'Shell',                     'Gas',                      false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2026-01-18',   68.34, 'expense', 'Aldi',                      'Weekly groceries',         false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2026-01-21',   28.90, 'expense', 'Panera Bread',              'Lunch',                    false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2026-01-24',   36.80, 'expense', 'BP',                        'Gas fill-up',              false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2026-01-26',   58.11, 'expense', 'Aldi',                      'Groceries',                false, false, NULL, cat_food,    sub_groceries,   NULL);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2026-01-11', 87.65, 'expense', 'Target', 'Cleaning + personal care', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 54.33),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  33.32);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2026-01-17', 62.40, 'expense', 'Amazon', 'Home organization items', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 24.99),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  37.41);

  -- ── FEBRUARY 2026 — over budget on Restaurants ($194.65 vs $150) ───────────
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES
    (gen_random_uuid(), uid, '2026-02-01', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 1',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2026-02-15', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 2',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2026-02-01', 1200.00, 'expense', 'Oakwood Apartments',        'February rent',            false, false, NULL, cat_housing, sub_rent,        NULL),
    (gen_random_uuid(), uid, '2026-02-05',   15.99, 'expense', 'Netflix',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2026-02-05',    9.99, 'expense', 'Spotify',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2026-02-10',  300.00, 'expense', 'Toyota Financial Services', 'Car payment',              false, false, NULL, cat_trans,   sub_car_pmt,     NULL),
    (gen_random_uuid(), uid, '2026-02-20',  109.88, 'expense', 'City Utilities',            'Electric + water',         false, false, NULL, cat_housing, sub_utilities,   NULL),
    (gen_random_uuid(), uid, '2026-02-22',   59.99, 'expense', 'Xfinity',                   'Internet',                 false, false, NULL, cat_housing, sub_internet,    NULL),
    (gen_random_uuid(), uid, '2026-02-25',  100.00, 'expense', 'State Farm',                'Car insurance',            false, false, NULL, cat_trans,   sub_car_ins,     NULL),
    (gen_random_uuid(), uid, '2026-02-27',  150.00, 'expense', 'UnitedHealth',              'Health insurance premium', false, false, NULL, cat_ins,     sub_health_ins,  NULL),
    (gen_random_uuid(), uid, '2026-02-28',  350.00, 'expense', 'Navient',                   'Student loan payment',     false, false, NULL, cat_student, sub_student_pay, NULL),
    (gen_random_uuid(), uid, '2026-02-28',  150.00, 'expense', 'Ally Bank',                 'Emergency fund transfer',  false, false, NULL, cat_savings, sub_emergency,   NULL),
    (gen_random_uuid(), uid, '2026-02-28',  200.00, 'expense', 'Fidelity 401k',             '401k contribution',        false, false, NULL, cat_savings, sub_retirement,  NULL),
    (gen_random_uuid(), uid, '2026-02-03',   82.50, 'expense', 'Aldi',                      'Weekly groceries',         false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2026-02-06',   38.25, 'expense', 'Chipotle',                  'Lunch',                    false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2026-02-08',   12.75, 'expense', 'Starbucks',                 'Coffee',                   false, false, NULL, cat_food,    sub_coffee,      NULL),
    (gen_random_uuid(), uid, '2026-02-11',   69.43, 'expense', 'Walmart',                   'Groceries',                false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2026-02-12',   44.10, 'expense', 'Shell',                     'Gas',                      false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2026-02-14',  127.50, 'expense', 'The Capital Grille',        'Valentine''s Day dinner',  false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2026-02-17',   77.89, 'expense', 'Aldi',                      'Weekly groceries',         false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2026-02-19',   15.50, 'expense', 'Dutch Bros',                'Coffee',                   false, false, NULL, cat_food,    sub_coffee,      NULL),
    (gen_random_uuid(), uid, '2026-02-21',   35.60, 'expense', 'BP',                        'Gas fill-up',              false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2026-02-24',   67.22, 'expense', 'Aldi',                      'Groceries',                false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2026-02-26',   28.90, 'expense', 'Panera Bread',              'Lunch',                    false, false, NULL, cat_food,    sub_restaurants, NULL);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2026-02-07', 98.34, 'expense', 'Target', 'Household + groceries', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 61.15),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  37.19);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2026-02-13', 73.88, 'expense', 'Amazon', 'Valentine''s gift + household', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,  45.99),
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 27.89);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2026-02-23', 104.56, 'expense', 'Walmart', 'Groceries + cleaning supplies', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 81.22),
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 23.34);

  -- ── MARCH 2026 — partial month through Mar 10 ──────────────────────────────
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES
    (gen_random_uuid(), uid, '2026-03-01', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 1',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2026-03-01', 1200.00, 'expense', 'Oakwood Apartments',        'March rent',               false, false, NULL, cat_housing, sub_rent,        NULL),
    (gen_random_uuid(), uid, '2026-03-04',   74.32, 'expense', 'Aldi',                      'Weekly groceries',         false, false, NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2026-03-05',   15.99, 'expense', 'Netflix',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2026-03-05',    9.99, 'expense', 'Spotify',                   NULL,                       false, false, NULL, cat_personal,sub_subscriptions,NULL),
    (gen_random_uuid(), uid, '2026-03-06',   42.80, 'expense', 'Shell',                     'Gas',                      false, false, NULL, cat_trans,   sub_gas,         NULL),
    (gen_random_uuid(), uid, '2026-03-07',   31.50, 'expense', 'Chipotle',                  'Lunch',                    false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2026-03-08',   13.25, 'expense', 'Starbucks',                 'Morning coffee',           false, false, NULL, cat_food,    sub_coffee,      NULL),
    (gen_random_uuid(), uid, '2026-03-10',  300.00, 'expense', 'Toyota Financial Services', 'Car payment',              false, false, NULL, cat_trans,   sub_car_pmt,     NULL);

  INSERT INTO transactions (id, user_id, date, amount, type, merchant, notes, is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
    VALUES (gen_random_uuid(), uid, '2026-03-09', 91.44, 'expense', 'Target', 'Groceries + personal care', true, false, NULL, NULL, NULL, NULL)
    RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 57.83),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  33.61);

  RETURN 'OK';
END $$;


-- ── Step 2: Schedule the reset at 03:00 UTC every night ──────────────────────
--
-- pg_cron must be enabled first:
--   Dashboard → Database → Extensions → search "pg_cron" → Enable
--
-- Remove any existing job with this name before re-adding (idempotent).
SELECT cron.unschedule('reset-demo-data') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reset-demo-data'
);

SELECT cron.schedule(
  'reset-demo-data',          -- job name (must be unique)
  '0 3 * * *',                -- cron expression: 03:00 UTC daily
  'SELECT reset_demo_data();' -- calls the function above directly
);

-- Verify the job was created:
-- SELECT * FROM cron.job WHERE jobname = 'reset-demo-data';
