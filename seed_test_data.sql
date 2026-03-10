-- ============================================================
-- BatchFlow test account seed data
-- User: 36dcf561-c20e-485d-a6b7-a7e706f28623
-- Months: Oct 2025 through Mar 2026
-- Run once in the Supabase SQL editor.
-- ============================================================

DO $$
DECLARE
  uid UUID := '36dcf561-c20e-485d-a6b7-a7e706f28623';

  -- Category IDs (looked up by name)
  cat_income         UUID;
  cat_housing        UUID;
  cat_trans          UUID;
  cat_food           UUID;
  cat_ins            UUID;
  cat_savings        UUID;
  cat_student        UUID;
  cat_personal       UUID;

  -- Subcategory IDs (looked up by name)
  sub_paycheck       UUID;
  sub_rent           UUID;
  sub_utilities      UUID;
  sub_internet       UUID;
  sub_car_pmt        UUID;
  sub_gas            UUID;
  sub_car_ins        UUID;
  sub_groceries      UUID;
  sub_restaurants    UUID;
  sub_coffee         UUID;
  sub_health_ins     UUID;
  sub_retirement     UUID;
  sub_emergency      UUID;
  sub_student_pay    UUID;
  sub_subscriptions  UUID;
  sub_entertainment  UUID;
  sub_clothing       UUID;
  sub_selfcare       UUID;

  txn_id UUID;

BEGIN

  -- --------------------------------------------------------
  -- Safety guard: abort if this user already has transactions
  -- --------------------------------------------------------
  IF EXISTS (SELECT 1 FROM transactions WHERE user_id = uid LIMIT 1) THEN
    RAISE EXCEPTION 'Test user already has transactions. Aborting to prevent duplicate seed.';
  END IF;

  -- --------------------------------------------------------
  -- Look up category IDs
  -- --------------------------------------------------------
  SELECT id INTO cat_income   FROM categories WHERE user_id = uid AND name = 'Income';
  SELECT id INTO cat_housing  FROM categories WHERE user_id = uid AND name = 'Housing';
  SELECT id INTO cat_trans    FROM categories WHERE user_id = uid AND name = 'Transportation';
  SELECT id INTO cat_food     FROM categories WHERE user_id = uid AND name = 'Food';
  SELECT id INTO cat_ins      FROM categories WHERE user_id = uid AND name = 'Insurance';
  SELECT id INTO cat_savings  FROM categories WHERE user_id = uid AND name = 'Savings';
  SELECT id INTO cat_student  FROM categories WHERE user_id = uid AND name = 'Student Loans';
  SELECT id INTO cat_personal FROM categories WHERE user_id = uid AND name = 'Personal';

  -- --------------------------------------------------------
  -- Look up subcategory IDs
  -- --------------------------------------------------------
  SELECT id INTO sub_paycheck      FROM subcategories WHERE user_id = uid AND name = 'Paycheck';
  SELECT id INTO sub_rent          FROM subcategories WHERE user_id = uid AND name = 'Rent / Mortgage';
  SELECT id INTO sub_utilities     FROM subcategories WHERE user_id = uid AND name = 'Utilities';
  SELECT id INTO sub_internet      FROM subcategories WHERE user_id = uid AND name = 'Internet';
  SELECT id INTO sub_car_pmt       FROM subcategories WHERE user_id = uid AND name = 'Car Payment';
  SELECT id INTO sub_gas           FROM subcategories WHERE user_id = uid AND name = 'Gas';
  SELECT id INTO sub_car_ins       FROM subcategories WHERE user_id = uid AND name = 'Car Insurance';
  SELECT id INTO sub_groceries     FROM subcategories WHERE user_id = uid AND name = 'Groceries';
  SELECT id INTO sub_restaurants   FROM subcategories WHERE user_id = uid AND name = 'Restaurants';
  SELECT id INTO sub_coffee        FROM subcategories WHERE user_id = uid AND name = 'Coffee';
  SELECT id INTO sub_health_ins    FROM subcategories WHERE user_id = uid AND name = 'Health Insurance';
  SELECT id INTO sub_retirement    FROM subcategories WHERE user_id = uid AND name = 'Retirement';
  SELECT id INTO sub_emergency     FROM subcategories WHERE user_id = uid AND name = 'Emergency Fund';
  SELECT id INTO sub_student_pay   FROM subcategories WHERE user_id = uid AND name = 'Student Loan Payment';
  SELECT id INTO sub_subscriptions FROM subcategories WHERE user_id = uid AND name = 'Subscriptions';
  SELECT id INTO sub_entertainment FROM subcategories WHERE user_id = uid AND name = 'Entertainment';
  SELECT id INTO sub_clothing      FROM subcategories WHERE user_id = uid AND name = 'Clothing';
  SELECT id INTO sub_selfcare      FROM subcategories WHERE user_id = uid AND name = 'Self Care';

  -- ========================================================
  -- BUDGET PLANS
  -- Same base structure for all 6 months; Dec bumps
  -- entertainment budget to $150 to reflect holiday intent.
  -- ========================================================

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
    -- DEC 2025 (entertainment bumped to $150 for holiday intent)
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

  -- ========================================================
  -- TRANSACTIONS
  -- ========================================================

  -- --------------------------------------------------------
  -- OCTOBER 2025 — normal month, all within budget
  -- Restaurants total: ~$114   (budget $150) ✓
  -- --------------------------------------------------------

  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES
    -- Income
    (gen_random_uuid(), uid, '2025-10-01', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 1',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    (gen_random_uuid(), uid, '2025-10-15', 2500.00, 'income',  'Employer Direct Deposit',   'Paycheck 2',               false, false, NULL, cat_income,  sub_paycheck,    NULL),
    -- Fixed / recurring
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
    -- Variable
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

  -- Split: Target — groceries + personal care (Oct 13)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2025-10-13', 112.67, 'expense', 'Target', 'Household + personal', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 68.42),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  44.25);

  -- Split: Walmart — groceries + household supplies (Oct 21)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2025-10-21', 95.23, 'expense', 'Walmart', 'Groceries + household', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 72.14),
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 23.09);

  -- Split: Amazon — entertainment + clothing (Oct 29)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2025-10-29', 89.43, 'expense', 'Amazon', 'Order: media + apparel', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_entertainment, 39.99),
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,      49.44);

  -- --------------------------------------------------------
  -- NOVEMBER 2025 — over budget on Restaurants
  -- Restaurants total: $45.80 + $62.15 + $78.50 = $186.45
  -- Budget: $150  →  over by $36.45
  -- --------------------------------------------------------

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
    (gen_random_uuid(), uid, '2025-11-26',   88.43, 'expense', 'Aldi',                      'Post-Thanksgiving groceries',false,false,NULL, cat_food,    sub_groceries,   NULL),
    (gen_random_uuid(), uid, '2025-11-27',   78.50, 'expense', 'Texas Roadhouse',           'Thanksgiving eve dinner',  false, false, NULL, cat_food,    sub_restaurants, NULL),
    (gen_random_uuid(), uid, '2025-11-29',   14.25, 'expense', 'Dutch Bros',                'Coffee',                   false, false, NULL, cat_food,    sub_coffee,      NULL);

  -- Split: Target Black Friday (Nov 29)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2025-11-29', 134.88, 'expense', 'Target', 'Black Friday shopping', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,       79.99),
    (gen_random_uuid(), txn_id, cat_personal,sub_entertainment,  54.89);

  -- Split: Amazon household (Nov 14)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2025-11-14', 76.43, 'expense', 'Amazon', 'Household items', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 32.44),
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 43.99);

  -- Split: Walgreens — medicine + groceries (Nov 21)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2025-11-21', 52.18, 'expense', 'Walgreens', 'Medicine + snacks', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  29.74),
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 22.44);

  -- --------------------------------------------------------
  -- DECEMBER 2025 — over budget on Entertainment
  -- Entertainment total: $25.00 + $85.00 + $49.99 = $159.99
  -- Budget: $150  →  over by $9.99
  -- --------------------------------------------------------

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
    (gen_random_uuid(), uid, '2025-12-20',  132.18, 'expense', 'City Utilities',            'Electric + water (cold month)',false,false,NULL,cat_housing, sub_utilities,   NULL),
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

  -- Split: Target Christmas run (Dec 19)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2025-12-19', 187.43, 'expense', 'Target', 'Christmas shopping', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,  112.44),
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries,  74.99);

  -- Split: Amazon gifts + household (Dec 08)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2025-12-08', 126.78, 'expense', 'Amazon', 'Christmas gifts + household', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,  88.99),
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 37.79);

  -- Split: Walgreens — medicine + personal care (Dec 11)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2025-12-11', 53.42, 'expense', 'Walgreens', 'Medicine + personal care', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  31.99),
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 21.43);

  -- --------------------------------------------------------
  -- JANUARY 2026 — under budget (new year frugality)
  -- Restaurants total: $22.50 + $28.90 = $51.40  (budget $150) ✓
  -- Groceries also light; skipped entertainment entirely
  -- --------------------------------------------------------

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

  -- Split: Target — cleaning + personal care (Jan 11)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2026-01-11', 87.65, 'expense', 'Target', 'Cleaning + personal care', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 54.33),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  33.32);

  -- Split: Amazon home organization (Jan 17)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2026-01-17', 62.40, 'expense', 'Amazon', 'Home organization items', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 24.99),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  37.41);

  -- --------------------------------------------------------
  -- FEBRUARY 2026 — over budget on Restaurants (Valentine's)
  -- Restaurants total: $38.25 + $127.50 + $28.90 = $194.65
  -- Budget: $150  →  over by $44.65
  -- --------------------------------------------------------

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

  -- Split: Target — groceries + household (Feb 07)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2026-02-07', 98.34, 'expense', 'Target', 'Household + groceries', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 61.15),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  37.19);

  -- Split: Amazon — gift + household (Feb 13)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2026-02-13', 73.88, 'expense', 'Amazon', 'Valentine''s gift + household', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_personal,sub_clothing,  45.99),
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 27.89);

  -- Split: Walmart — groceries + cleaning supplies (Feb 23)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2026-02-23', 104.56, 'expense', 'Walmart', 'Groceries + cleaning supplies', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 81.22),
    (gen_random_uuid(), txn_id, cat_housing, sub_utilities, 23.34);

  -- --------------------------------------------------------
  -- MARCH 2026 — partial month through Mar 10
  -- --------------------------------------------------------

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

  -- Split: Target — groceries + personal care (Mar 09)
  INSERT INTO transactions
    (id, user_id, date, amount, type, merchant, notes,
     is_split, is_pending, scheduled_date, category_id, subcategory_id, recurring_rule_id)
  VALUES (gen_random_uuid(), uid, '2026-03-09', 91.44, 'expense', 'Target', 'Groceries + personal care', true, false, NULL, NULL, NULL, NULL)
  RETURNING id INTO txn_id;
  INSERT INTO transaction_splits (id, transaction_id, category_id, subcategory_id, amount) VALUES
    (gen_random_uuid(), txn_id, cat_food,    sub_groceries, 57.83),
    (gen_random_uuid(), txn_id, cat_personal,sub_selfcare,  33.61);

END $$;
