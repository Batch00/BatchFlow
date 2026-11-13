// Standalone test for src/utils/backup.js. Run with: node --test tests/backup.test.mjs
// Lives outside src/ so it is never part of the Vite bundle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TABLES, REFERENCES, BACKUP_FORMAT,
  buildBackupV2, validateBackup, convertV1ToV2, remapIds,
} from '../src/utils/backup.js'

// ── Fixtures ────────────────────────────────────────────────────────────────

// Raw database rows, as the export reads them. Ids are readable strings so a
// leftover original id is easy to spot. user_id is present, as on real rows,
// and amounts mix numbers and numeric strings, as Postgres numeric can return.
function dbRows() {
  const u = { user_id: 'user-original' }
  return {
    categories: [
      { ...u, id: 'cat-food', name: 'Food', type: 'expense', color: '#ff0000', sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
      { ...u, id: 'cat-income', name: 'Income', type: 'income', color: '#00ff00', sort_order: 1, created_at: '2026-01-01T00:00:00Z' },
      { ...u, id: 'cat-home', name: 'Home', type: 'expense', color: null, sort_order: 2, created_at: null },
    ],
    subcategories: [
      { ...u, id: 'sub-groceries', category_id: 'cat-food', name: 'Groceries', sort_order: 0, created_at: null },
      { ...u, id: 'sub-dining', category_id: 'cat-food', name: 'Dining', sort_order: 1, created_at: null },
      { ...u, id: 'sub-paycheck', category_id: 'cat-income', name: 'Paycheck', sort_order: 0, created_at: null },
    ],
    recurring_rules: [
      {
        ...u, id: 'rule-pay', label: 'Paycheck', amount: '2500.00', type: 'income', frequency: 'biweekly',
        start_date: '2026-01-02', end_date: null, merchant: 'Employer', notes: null,
        category_id: 'cat-income', subcategory_id: 'sub-paycheck', is_paused: false, created_at: '2026-01-01T00:00:00Z',
      },
    ],
    transactions: [
      {
        ...u, id: 'txn-flat', date: '2026-11-03', amount: '54.21', type: 'expense', merchant: 'Market', notes: null,
        is_split: false, category_id: 'cat-food', subcategory_id: 'sub-groceries', recurring_rule_id: null,
        is_pending: false, scheduled_date: null, created_at: '2026-11-03T12:00:00Z',
      },
      {
        ...u, id: 'txn-pending', date: '2026-11-14', amount: 2500, type: 'income', merchant: 'Employer', notes: null,
        is_split: false, category_id: 'cat-income', subcategory_id: 'sub-paycheck', recurring_rule_id: 'rule-pay',
        is_pending: true, scheduled_date: '2026-11-14', created_at: '2026-11-01T00:00:00Z',
      },
      {
        ...u, id: 'txn-split', date: '2026-11-05', amount: 100, type: 'expense', merchant: 'Big Box', notes: 'mixed',
        is_split: true, category_id: null, subcategory_id: null, recurring_rule_id: null,
        is_pending: false, scheduled_date: null, created_at: '2026-11-05T12:00:00Z',
      },
    ],
    transaction_splits: [
      { id: 'split-a', transaction_id: 'txn-split', category_id: 'cat-food', subcategory_id: 'sub-groceries', amount: '60' },
      { id: 'split-b', transaction_id: 'txn-split', category_id: 'cat-home', subcategory_id: null, amount: 40 },
    ],
    budget_plans: [
      { ...u, id: 'plan-cat', month_key: '2026-11', category_id: 'cat-home', subcategory_id: null, planned_amount: '150.00' },
      { ...u, id: 'plan-sub', month_key: '2026-11', category_id: null, subcategory_id: 'sub-groceries', planned_amount: 400 },
    ],
    paycheck_plans: [
      { ...u, id: 'pay-1', month_key: '2026-11', date: '2026-11-14', amount: '2500', label: 'Paycheck', created_at: null },
    ],
  }
}

// A version 2 file as it would be read back from disk.
function validV2() {
  return JSON.parse(JSON.stringify(buildBackupV2(dbRows(), '2026-11-13T00:00:00.000Z')))
}

// A version 1 file in the shape the old export wrote (app state).
function validV1() {
  return {
    version: 1,
    exportedAt: '2026-10-01T00:00:00.000Z',
    currentMonth: '2026-10',
    categories: [
      { id: 'c1', name: 'Food', type: 'expense', color: '#f00', subcategories: [{ id: 's1', name: 'Groceries' }, { id: 's2', name: 'Dining' }] },
      { id: 'c2', name: 'Income', type: 'income', color: '#0f0', subcategories: [] },
    ],
    transactions: [
      { id: 't1', date: '2026-10-02', amount: 20, type: 'expense', categoryId: 'c1', subcategoryId: 's1', merchant: 'A', notes: '' },
      { id: 't2', date: '2026-10-03', amount: 50, type: 'expense', categoryId: null, subcategoryId: null, merchant: 'B', notes: '',
        splits: [{ categoryId: 'c1', subcategoryId: 's1', amount: 30 }, { categoryId: 'c1', subcategoryId: null, amount: 20 }] },
      // Empty splits array: a flat transaction, not a split.
      { id: 't3', date: '2026-10-04', amount: 1000, type: 'income', categoryId: 'c2', subcategoryId: null, splits: [],
        isPending: true, scheduledDate: '2026-10-04', recurringRuleId: 'old-rule' },
    ],
    budgets: {
      '2026-10': { planned: { c1: 300, c2: 2000 }, subcategoryPlanned: { s1: 200 } },
    },
  }
}

const clone = (o) => JSON.parse(JSON.stringify(o))

// Every reference in `remapped` must point at the row the same reference
// pointed at in `original`, matched by position.
function assertReferencesPreserved(original, remapped) {
  for (const [table, refs] of Object.entries(REFERENCES)) {
    if (!Array.isArray(original[table])) continue
    original[table].forEach((row, i) => {
      for (const [col, target] of Object.entries(refs)) {
        if (row[col] === null || row[col] === undefined) {
          assert.equal(remapped[table][i][col], row[col], `${table}[${i}].${col} stays empty`)
          continue
        }
        const targetIndex = original[target].findIndex(r => r.id === row[col])
        assert.ok(targetIndex >= 0, `${table}[${i}].${col} resolves in the original`)
        assert.equal(remapped[table][i][col], remapped[target][targetIndex].id,
          `${table}[${i}].${col} points at the same row after remapping`)
      }
    })
  }
}

// ── Round trips ─────────────────────────────────────────────────────────────

test('version 2 round trip: build, validate, remap keeps counts and references', () => {
  const rows = dbRows()
  const file = validV2()

  assert.equal(file.format, BACKUP_FORMAT)
  assert.equal(file.version, 2)
  assert.equal(file.exportedAt, '2026-11-13T00:00:00.000Z')
  assert.deepEqual(Object.keys(file), ['format', 'version', 'exportedAt', ...TABLES])
  assert.ok(!JSON.stringify(file).includes('user_id'), 'user_id is left out of the file')
  assert.equal(file.transactions[0].amount, 54.21, 'numeric strings become numbers')
  assert.equal(file.budget_plans[0].planned_amount, 150)

  const check = validateBackup(file)
  assert.deepEqual(check.errors, [])
  assert.equal(check.ok, true)
  assert.equal(check.version, 2)
  assert.equal(check.pending, 1)
  for (const table of TABLES) assert.equal(check.counts[table], rows[table].length, table)

  const remapped = remapIds(file)
  const after = validateBackup(remapped)
  assert.equal(after.ok, true, after.errors.join('\n'))
  assert.deepEqual(after.counts, check.counts)
  assert.equal(after.pending, 1)

  // No original id survives anywhere in the remapped file.
  const text = JSON.stringify(remapped)
  for (const table of TABLES) {
    for (const row of rows[table]) assert.ok(!text.includes(row.id), `original id ${row.id} left behind`)
  }
  // Every new id is a UUID and unique across the whole file.
  const newIds = TABLES.flatMap(t => remapped[t].map(r => r.id))
  assert.equal(new Set(newIds).size, newIds.length)
  for (const id of newIds) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

  assertReferencesPreserved(file, remapped)

  // Pending state and rule links survive.
  const pending = remapped.transactions[1]
  assert.equal(pending.is_pending, true)
  assert.equal(pending.scheduled_date, '2026-11-14')
  assert.equal(pending.recurring_rule_id, remapped.recurring_rules[0].id)

  // The input is not modified.
  assert.deepEqual(file, validV2())
})

test('version 1 file converts and validates', () => {
  const v1 = validV1()
  const check = validateBackup(v1)
  assert.deepEqual(check.errors, [])
  assert.equal(check.ok, true)
  assert.equal(check.version, 1)
  assert.deepEqual(check.counts, {
    categories: 2,
    subcategories: 2,
    recurring_rules: null,
    transactions: 3,
    transaction_splits: 2,
    budget_plans: 3,
    paycheck_plans: null,
  })
  assert.equal(check.pending, 0, 'version 1 restores everything as confirmed')

  const v2 = convertV1ToV2(v1)
  assert.equal(v2.format, BACKUP_FORMAT)
  assert.equal(v2.version, 2)
  assert.equal(v2.recurring_rules, null)
  assert.equal(v2.paycheck_plans, null)
  assert.deepEqual(v2.categories.map(c => c.sort_order), [0, 1])
  assert.deepEqual(v2.subcategories.map(s => [s.category_id, s.sort_order]), [['c1', 0], ['c1', 1]])

  const [t1, t2, t3] = v2.transactions
  assert.equal(t1.is_split, false)
  assert.equal(t1.category_id, 'c1')
  assert.equal(t2.is_split, true)
  assert.equal(t2.category_id, null)
  assert.equal(v2.transaction_splits.filter(s => s.transaction_id === 't2').length, 2)
  assert.equal(t3.is_split, false, 'an empty splits array is flat')
  assert.equal(t3.is_pending, false)
  assert.equal(t3.scheduled_date, null)
  assert.equal(t3.recurring_rule_id, null)

  const planned = v2.budget_plans.map(p => [p.month_key, p.category_id, p.subcategory_id, p.planned_amount])
  assert.deepEqual(planned, [
    ['2026-10', 'c1', null, 300],
    ['2026-10', 'c2', null, 2000],
    ['2026-10', null, 's1', 200],
  ])

  const remapped = remapIds(v2)
  const after = validateBackup(remapped)
  assert.equal(after.ok, true, after.errors.join('\n'))
  assert.deepEqual(after.counts, check.counts)
  assertReferencesPreserved(v2, remapped)
  assert.equal(remapped.recurring_rules, null)
  assert.equal(remapped.paycheck_plans, null)
})

test('a file with no version field is read as version 1', () => {
  const v1 = validV1()
  delete v1.version
  const check = validateBackup(v1)
  assert.equal(check.ok, true, check.errors.join('\n'))
  assert.equal(check.version, 1)
})

test('remapIds refuses a dangling reference', () => {
  const file = validV2()
  file.transactions[0].category_id = 'cat-missing'
  assert.throws(() => remapIds(file), /cat-missing/)
})

// ── One test per validation rule ────────────────────────────────────────────

// Applies `mutate` to a fresh valid file and asserts the result is rejected
// with an error matching `pattern`.
function rejects(name, mutate, pattern, base = validV2) {
  test(`rejects: ${name}`, () => {
    const file = clone(base())
    const replaced = mutate(file)
    const check = validateBackup(replaced === undefined ? file : replaced)
    assert.equal(check.ok, false)
    assert.ok(check.errors.some(e => pattern.test(e)), `expected ${pattern}, got:\n${check.errors.join('\n')}`)
  })
}

// Shape
rejects('not an object', () => [], /not a BatchFlow backup/)
rejects('null', () => null, /not a BatchFlow backup/)
rejects('unsupported version', f => { f.version = 3 }, /Unsupported backup version/)
rejects('wrong format marker', f => { f.format = 'other-app' }, /format is not/)
rejects('required table missing', f => { delete f.transactions }, /"transactions" is missing/)
rejects('required table not a list', f => { f.categories = {} }, /"categories" is missing or is not a list/)
rejects('optional table of the wrong type', f => { f.recurring_rules = 'none' }, /"recurring_rules" must be a list or null/)
rejects('row that is not an object', f => { f.subcategories.push('oops') }, /Subcategory 4 is not an object/)

// Ids
rejects('row without an id', f => { delete f.categories[0].id }, /Category 1 has no id/)
rejects('duplicate id', f => { f.transactions[1].id = f.transactions[0].id }, /repeats the id/)

// Required fields
rejects('category without a name', f => { f.categories[0].name = ' ' }, /Category 1 has no name/)
rejects('subcategory without a category', f => { f.subcategories[0].category_id = null }, /Subcategory 1 has no category_id/)
rejects('split row without a transaction', f => { f.transaction_splits[0].transaction_id = null }, /Split row 1 has no transaction_id/)
rejects('split row without a category', f => { f.transaction_splits[0].category_id = null }, /Split row 1 has no category_id/)
rejects('rule without a start date', f => { f.recurring_rules[0].start_date = null }, /Recurring rule 1: start_date is not a valid/)
rejects('paycheck plan without a date', f => { delete f.paycheck_plans[0].date }, /Paycheck plan 1: date is not a valid/)

// Allowed values
rejects('category type', f => { f.categories[0].type = 'transfer' }, /Category 1 has type "transfer"/)
rejects('transaction type', f => { f.transactions[0].type = 'refund' }, /Transaction 1 has type "refund"/)
rejects('rule type', f => { f.recurring_rules[0].type = 'savings' }, /Recurring rule 1 has type "savings"/)
rejects('rule frequency', f => { f.recurring_rules[0].frequency = 'daily' }, /frequency "daily"/)
rejects('is_pending not a boolean', f => { f.transactions[0].is_pending = 'yes' }, /Transaction 1: is_pending is not true or false/)

// Finite amounts
rejects('transaction amount as text', f => { f.transactions[0].amount = '12.50' }, /Transaction 1: amount is not a finite number/)
rejects('transaction amount infinite', f => { f.transactions[0].amount = Infinity }, /not a finite number/)
rejects('split amount missing', f => { delete f.transaction_splits[0].amount }, /Split row 1: amount is not a finite number/)
rejects('rule amount NaN', f => { f.recurring_rules[0].amount = NaN }, /Recurring rule 1: amount is not a finite number/)
rejects('budget plan amount', f => { f.budget_plans[0].planned_amount = null }, /Budget plan 1: planned_amount is not a finite number/)
rejects('paycheck amount', f => { f.paycheck_plans[0].amount = 'lots' }, /Paycheck plan 1: amount is not a finite number/)

// Dates
rejects('impossible transaction date', f => { f.transactions[0].date = '2026-02-30' }, /Transaction 1: date is not a valid/)
rejects('transaction date in the wrong format', f => { f.transactions[0].date = '11/03/2026' }, /not a valid YYYY-MM-DD date/)
rejects('bad scheduled date', f => { f.transactions[1].scheduled_date = '2026-13-01' }, /Transaction 2: scheduled_date is not a valid/)
rejects('bad rule end date', f => { f.recurring_rules[0].end_date = 'never' }, /Recurring rule 1: end_date is not a valid/)
rejects('bad budget month', f => { f.budget_plans[0].month_key = '2026-13' }, /Budget plan 1: month_key is not a valid YYYY-MM month/)
rejects('bad paycheck month', f => { f.paycheck_plans[0].month_key = '2026-1' }, /Paycheck plan 1: month_key is not a valid/)
rejects('bad created_at', f => { f.categories[0].created_at = 'yesterday' }, /Category 1: created_at is not a valid timestamp/)

// References
rejects('subcategory to a missing category', f => { f.subcategories[0].category_id = 'cat-gone' }, /Subcategory 1 refers to category "cat-gone"/)
rejects('transaction to a missing category', f => { f.transactions[0].category_id = 'cat-gone' }, /Transaction 1 refers to category "cat-gone"/)
rejects('transaction to a missing subcategory', f => { f.transactions[0].subcategory_id = 'sub-gone' }, /Transaction 1 refers to subcategory "sub-gone"/)
rejects('transaction to a missing recurring rule', f => { f.transactions[1].recurring_rule_id = 'rule-gone' }, /Transaction 2 refers to recurring rule "rule-gone"/)
rejects('transaction to a rule when the file has no rules', f => { f.recurring_rules = null }, /file has no recurring rules/)
rejects('split to a missing transaction', f => { f.transaction_splits[0].transaction_id = 'txn-gone' }, /Split row 1 refers to transaction "txn-gone"/)
rejects('split to a missing category', f => { f.transaction_splits[0].category_id = 'cat-gone' }, /Split row 1 refers to category "cat-gone"/)
rejects('split to a missing subcategory', f => { f.transaction_splits[0].subcategory_id = 'sub-gone' }, /Split row 1 refers to subcategory "sub-gone"/)
rejects('split to a transaction that is not a split', f => { f.transaction_splits[0].transaction_id = 'txn-flat' }, /not marked as a split/)
rejects('budget plan to a missing category', f => { f.budget_plans[0].category_id = 'cat-gone' }, /Budget plan 1 refers to category "cat-gone"/)
rejects('budget plan to a missing subcategory', f => { f.budget_plans[1].subcategory_id = 'sub-gone' }, /Budget plan 2 refers to subcategory "sub-gone"/)
rejects('budget plan with both targets', f => { f.budget_plans[0].subcategory_id = 'sub-dining' }, /exactly one of category_id or subcategory_id/)
rejects('budget plan with neither target', f => { f.budget_plans[0].category_id = null }, /exactly one of category_id or subcategory_id/)
rejects('rule to a missing category', f => { f.recurring_rules[0].category_id = 'cat-gone' }, /Recurring rule 1 refers to category "cat-gone"/)
rejects('rule to a missing subcategory', f => { f.recurring_rules[0].subcategory_id = 'sub-gone' }, /Recurring rule 1 refers to subcategory "sub-gone"/)

// Split rules
rejects('non-split transaction without a category', f => { f.transactions[0].category_id = null }, /Transaction 1 has no category and is not a split/)
rejects('split transaction with no split rows', f => { f.transaction_splits = [] }, /Transaction 3 is a split but has no split rows/)
rejects('split transaction with its own category', f => { f.transactions[2].category_id = 'cat-food' }, /Transaction 3 is a split but also has its own category/)

// Version 1
rejects('v1 budgets not an object', f => { f.budgets = [] }, /"budgets" is missing or is not an object/, validV1)
rejects('v1 transactions missing', f => { delete f.transactions }, /"transactions" is missing/, validV1)
rejects('v1 splits not a list', f => { f.transactions[1].splits = 'x' }, /Transaction 2 has splits that are not a list/, validV1)
rejects('v1 budget to a missing category', f => { f.budgets['2026-10'].planned['c-gone'] = 10 }, /refers to category "c-gone"/, validV1)
rejects('v1 split to a missing category', f => { f.transactions[1].splits[0].categoryId = 'c-gone' }, /Split row 1 refers to category "c-gone"/, validV1)
rejects('v1 flat transaction without a category', f => { f.transactions[0].categoryId = null }, /no category and is not a split/, validV1)
