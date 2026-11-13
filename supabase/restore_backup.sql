-- Atomic restore for BatchFlow backups (format version 2).
--
-- Replaces the signed-in user's budget data with the rows in the payload, inside
-- the single transaction PostgREST opens for the call. Any error rolls the whole
-- restore back, so the account is either fully restored or left exactly as it was.
--
-- SECURITY INVOKER: it runs as the calling user, so row level security and the
-- demo_block_writes triggers apply as they do for any other write. user_id always
-- comes from auth.uid(), never from the payload.
--
-- The client sends rows that are already validated and carry fresh ids (see
-- src/utils/backup.js). recurring_rules and paycheck_plans may be null: that
-- means "the backup has none of these" (version 1 files), and the existing rows
-- in those two tables are left in place.
--
-- search_path is public, not empty, on purpose: the split integrity triggers and
-- demo_block_writes use unqualified table names and inherit this setting.
--
-- Applied by hand in the Supabase SQL editor.

create or replace function public.restore_backup(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  has_rules boolean;
  has_paychecks boolean;
  n_categories integer := 0;
  n_subcategories integer := 0;
  n_rules integer := 0;
  n_transactions integer := 0;
  n_splits integer := 0;
  n_budget_plans integer := 0;
  n_paychecks integer := 0;
  bad_id uuid;
  k text;
begin
  if uid is null then
    raise exception 'restore_backup: not signed in' using errcode = '28000';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object'
     or (payload->>'version') is distinct from '2' then
    raise exception 'restore_backup: payload is not a version 2 backup'
      using errcode = '22023';
  end if;

  foreach k in array array['categories', 'subcategories', 'transactions',
                           'transaction_splits', 'budget_plans'] loop
    if jsonb_typeof(payload->k) is distinct from 'array' then
      raise exception 'restore_backup: "%" must be an array', k using errcode = '22023';
    end if;
  end loop;

  foreach k in array array['recurring_rules', 'paycheck_plans'] loop
    if jsonb_typeof(payload->k) is not null
       and jsonb_typeof(payload->k) not in ('array', 'null') then
      raise exception 'restore_backup: "%" must be an array or null', k using errcode = '22023';
    end if;
  end loop;

  has_rules := jsonb_typeof(payload->'recurring_rules') = 'array';
  has_paychecks := jsonb_typeof(payload->'paycheck_plans') = 'array';

  -- Delete. Order matters: transactions first (their splits cascade), because
  -- transaction_splits.category_id is ON DELETE RESTRICT and a non-split
  -- transaction may not lose its category.
  delete from public.transactions where user_id = uid;
  delete from public.budget_plans where user_id = uid;
  if has_paychecks then
    delete from public.paycheck_plans where user_id = uid;
  end if;
  if has_rules then
    delete from public.recurring_rules where user_id = uid;
  end if;
  delete from public.subcategories where user_id = uid;
  delete from public.categories where user_id = uid;

  -- Insert, parents before children.
  insert into public.categories (id, user_id, name, type, color, sort_order, created_at)
  select r.id, uid, r.name, r.type, coalesce(r.color, '#6366f1'),
         coalesce(r.sort_order, 0), coalesce(r.created_at, now())
  from jsonb_to_recordset(payload->'categories')
    as r(id uuid, name text, type text, color text, sort_order integer, created_at timestamptz);
  get diagnostics n_categories = row_count;

  insert into public.subcategories (id, category_id, user_id, name, sort_order, created_at)
  select r.id, r.category_id, uid, r.name, coalesce(r.sort_order, 0), coalesce(r.created_at, now())
  from jsonb_to_recordset(payload->'subcategories')
    as r(id uuid, category_id uuid, name text, sort_order integer, created_at timestamptz);
  get diagnostics n_subcategories = row_count;

  if has_rules then
    insert into public.recurring_rules
      (id, user_id, label, amount, type, frequency, start_date, end_date, merchant, notes,
       category_id, subcategory_id, is_paused, created_at)
    select r.id, uid, coalesce(r.label, ''), r.amount, r.type, r.frequency, r.start_date,
           r.end_date, r.merchant, r.notes, r.category_id, r.subcategory_id,
           coalesce(r.is_paused, false), coalesce(r.created_at, now())
    from jsonb_to_recordset(payload->'recurring_rules')
      as r(id uuid, label text, amount numeric, type text, frequency text, start_date date,
           end_date date, merchant text, notes text, category_id uuid, subcategory_id uuid,
           is_paused boolean, created_at timestamptz);
    get diagnostics n_rules = row_count;
  end if;

  insert into public.transactions
    (id, user_id, date, amount, type, merchant, notes, is_split, category_id, subcategory_id,
     recurring_rule_id, is_pending, scheduled_date, created_at)
  select r.id, uid, r.date, r.amount, r.type, r.merchant, r.notes, coalesce(r.is_split, false),
         r.category_id, r.subcategory_id, r.recurring_rule_id, coalesce(r.is_pending, false),
         r.scheduled_date, coalesce(r.created_at, now())
  from jsonb_to_recordset(payload->'transactions')
    as r(id uuid, date date, amount numeric, type text, merchant text, notes text,
         is_split boolean, category_id uuid, subcategory_id uuid, recurring_rule_id uuid,
         is_pending boolean, scheduled_date date, created_at timestamptz);
  get diagnostics n_transactions = row_count;

  insert into public.transaction_splits (id, transaction_id, category_id, subcategory_id, amount)
  select coalesce(r.id, gen_random_uuid()), r.transaction_id, r.category_id, r.subcategory_id, r.amount
  from jsonb_to_recordset(payload->'transaction_splits')
    as r(id uuid, transaction_id uuid, category_id uuid, subcategory_id uuid, amount numeric);
  get diagnostics n_splits = row_count;

  insert into public.budget_plans (id, user_id, month_key, category_id, subcategory_id, planned_amount)
  select coalesce(r.id, gen_random_uuid()), uid, r.month_key, r.category_id, r.subcategory_id,
         coalesce(r.planned_amount, 0)
  from jsonb_to_recordset(payload->'budget_plans')
    as r(id uuid, month_key text, category_id uuid, subcategory_id uuid, planned_amount numeric);
  get diagnostics n_budget_plans = row_count;

  if has_paychecks then
    insert into public.paycheck_plans (id, user_id, month_key, date, amount, label, created_at)
    select coalesce(r.id, gen_random_uuid()), uid, r.month_key, r.date, r.amount,
           coalesce(r.label, 'Paycheck'), coalesce(r.created_at, now())
    from jsonb_to_recordset(payload->'paycheck_plans')
      as r(id uuid, month_key text, date date, amount numeric, label text, created_at timestamptz);
    get diagnostics n_paychecks = row_count;
  end if;

  -- The insert path has no trigger for this invariant, so check it here: every
  -- split transaction must have at least one split row.
  select t.id into bad_id
  from public.transactions t
  where t.user_id = uid
    and t.is_split
    and not exists (select 1 from public.transaction_splits s where s.transaction_id = t.id)
  limit 1;
  if bad_id is not null then
    raise exception 'restore_backup: a split transaction in the backup has no split rows'
      using errcode = 'check_violation';
  end if;

  return jsonb_build_object(
    'categories', n_categories,
    'subcategories', n_subcategories,
    'recurring_rules', case when has_rules then n_rules end,
    'transactions', n_transactions,
    'transaction_splits', n_splits,
    'budget_plans', n_budget_plans,
    'paycheck_plans', case when has_paychecks then n_paychecks end
  );
end;
$$;

revoke execute on function public.restore_backup(jsonb) from public, anon;
grant execute on function public.restore_backup(jsonb) to authenticated;

notify pgrst, 'reload schema';
