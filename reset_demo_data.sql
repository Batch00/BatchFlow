-- ============================================================
-- BatchFlow demo account reset script
-- User: c079f26a-b70b-4eb7-a04a-e0c17769facc (demo@batch-apps.com)
-- Run nightly to wipe all demo data, then follow with seed_demo_data.sql
-- ============================================================

DO $$
DECLARE
  uid UUID := 'c079f26a-b70b-4eb7-a04a-e0c17769facc';
BEGIN

  -- Delete transaction splits first (FK constraint)
  DELETE FROM transaction_splits
  WHERE transaction_id IN (
    SELECT id FROM transactions WHERE user_id = uid
  );

  -- Delete transactions
  DELETE FROM transactions WHERE user_id = uid;

  -- Delete budget plans
  DELETE FROM budget_plans WHERE user_id = uid;

  -- Delete recurring rules
  DELETE FROM recurring_rules WHERE user_id = uid;

  -- Delete subcategories (before categories due to FK)
  DELETE FROM subcategories WHERE user_id = uid;

  -- Delete categories
  DELETE FROM categories WHERE user_id = uid;

  RAISE NOTICE 'Demo account reset complete for user %', uid;

END $$;
