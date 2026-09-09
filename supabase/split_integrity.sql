-- ============================================================================
-- Split-transaction integrity
--
-- Invariant: a transaction with is_split = true must have at least one row in
-- transaction_splits, and must not carry a category of its own. A row that
-- breaks this is unrenderable — the app has no category to show for it and no
-- split rows to list — and before the accompanying client fix it crashed the
-- whole page rather than the single row.
--
-- Run the sections in order in the Supabase SQL editor. Sections 1 and 2 are
-- read-only / repair; sections 3-5 install the guards.
--
-- IMPORTANT — what can and cannot be enforced at write time:
-- PostgREST runs every HTTP request in its own transaction, so the app creates a
-- split as two separate transactions (insert the parent, then insert its rows).
-- Any trigger that fires on INSERT INTO transactions — including a DEFERRABLE
-- one, since deferral only lasts to the end of that same single-statement
-- transaction — would reject every legitimate split at creation time. So the
-- INSERT path is deliberately left unguarded here and is covered client-side
-- instead (addTransaction now deletes the parent row if its splits fail to
-- land). Sections 3-5 cover every path that CAN be enforced synchronously, and
-- section 6 offers a sweep for anything that slips through.
-- ============================================================================


-- ── 1. Detect ───────────────────────────────────────────────────────────────
-- Run this first. It should return zero rows before you install the guards;
-- anything it returns has to be repaired by section 2 or the guards will make
-- those rows uneditable.

select t.id, t.user_id, t.date, t.amount, t.merchant, t.category_id
from transactions t
where t.is_split
  and not exists (select 1 from transaction_splits s where s.transaction_id = t.id);

-- Also check the other half of the invariant (a split carrying its own category),
-- which section 3's CHECK constraint will reject:
select t.id, t.user_id, t.date, t.amount, t.merchant, t.category_id
from transactions t
where t.is_split and t.category_id is not null;


-- ── 2. Repair ───────────────────────────────────────────────────────────────
-- Demote flagged splits that have no rows to plain uncategorised transactions.
-- They keep their amount, date, merchant and notes; only the bad flag is cleared.
-- Re-categorise them in the app afterwards (they show as "Unknown").

update transactions t
set is_split = false
where t.is_split
  and not exists (select 1 from transaction_splits s where s.transaction_id = t.id);

-- Clear stray categories from genuine splits (their categories live in the rows).
update transactions
set category_id = null, subcategory_id = null
where is_split and category_id is not null;


-- ── 3. Column-level invariant ───────────────────────────────────────────────
-- A split holds its categories in transaction_splits, never on the parent row.
-- Cheap, immediate, and catches a whole class of half-written updates.

alter table transactions
  drop constraint if exists transactions_split_has_no_category;

alter table transactions
  add constraint transactions_split_has_no_category
  check (not is_split or category_id is null);


-- ── 4. Guard the UPDATE path ────────────────────────────────────────────────
-- Rejects any update that leaves the row flagged as a split with nothing under
-- it: flipping is_split on with no rows present, or keeping it on after the rows
-- have gone. The client writes new split rows BEFORE flipping the flag, so a
-- legitimate save always has rows in place by the time this runs.

create or replace function assert_split_has_rows()
returns trigger
language plpgsql
as $$
begin
  if new.is_split
     and not exists (select 1 from transaction_splits s where s.transaction_id = new.id)
  then
    raise exception
      'transaction % would be marked is_split with no rows in transaction_splits', new.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_split_has_rows on transactions;

create trigger transactions_split_has_rows
  after update of is_split, category_id on transactions
  for each row
  when (new.is_split)
  execute function assert_split_has_rows();


-- ── 5. Guard the DELETE path ────────────────────────────────────────────────
-- Rejects removing the last split row while the parent is still flagged — the
-- "deleted the splits without clearing the flag" case. Statement-level with a
-- transition table so it evaluates once, after the whole delete has been
-- applied, and so deleting-and-replacing rows in one statement is still fine.
--
-- The parent-row lookup is what makes this safe under ON DELETE CASCADE: when a
-- transaction is deleted its splits go with it, and by the time this fires the
-- parent is already gone, so the join matches nothing and the delete proceeds.

create or replace function assert_splits_not_orphaned()
returns trigger
language plpgsql
as $$
declare
  bad_id uuid;
begin
  select t.id into bad_id
  from transactions t
  where t.id in (select distinct d.transaction_id from removed d)
    and t.is_split
    and not exists (select 1 from transaction_splits s where s.transaction_id = t.id)
  limit 1;

  if bad_id is not null then
    raise exception
      'removing these rows would leave transaction % marked is_split with no splits', bad_id
      using errcode = 'check_violation',
            hint = 'Set is_split = false on the transaction first, or insert the replacement rows before deleting the old ones.';
  end if;

  return null;
end;
$$;

drop trigger if exists transaction_splits_not_orphaned on transaction_splits;

create trigger transaction_splits_not_orphaned
  after delete on transaction_splits
  referencing old table as removed
  for each statement
  execute function assert_splits_not_orphaned();


-- ── 6. Optional: sweep the unguardable INSERT path ──────────────────────────
-- Covers the one gap above — a parent inserted with is_split = true whose splits
-- never arrived (client crash, dropped connection mid-save). The client rolls
-- this back itself now; this is the backstop if it never got the chance to.
-- Only demotes rows older than an hour so an in-flight save is never touched.

create or replace function repair_orphaned_splits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  repaired integer;
begin
  update transactions t
  set is_split = false
  where t.is_split
    and t.created_at < now() - interval '1 hour'
    and not exists (select 1 from transaction_splits s where s.transaction_id = t.id);

  get diagnostics repaired = row_count;
  return repaired;
end;
$$;

-- Requires a created_at column on transactions. If there isn't one, either add it
-- or drop that predicate from the function above and run the sweep manually
-- rather than on a schedule.
--
-- Schedule it daily alongside the existing demo-data job:
-- select cron.schedule('repair-orphaned-splits', '15 3 * * *', $$select repair_orphaned_splits()$$);


-- ── Verify ──────────────────────────────────────────────────────────────────
-- Both should raise; run them in a transaction you roll back.
--
-- begin;
--   -- expect: "would be marked is_split with no rows"
--   update transactions set is_split = true, category_id = null
--   where id = '<some-non-split-transaction-id>';
-- rollback;
--
-- begin;
--   -- expect: "would leave transaction ... marked is_split with no splits"
--   delete from transaction_splits where transaction_id = '<some-split-transaction-id>';
-- rollback;
