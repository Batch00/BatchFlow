// Backup file format, version 2, and the checks that guard a restore.
//
// Pure functions only: no Supabase, no React, no DOM. The column lists below are
// the contract with public.restore_backup(payload jsonb) in
// supabase/restore_backup.sql. A column the function does not read is not
// exported, and user_id is never in the file (the function takes it from
// auth.uid()).
//
// Version 1 files (the old export built from app state) are still accepted:
// convertV1ToV2 maps them onto this shape, with recurring_rules and
// paycheck_plans set to null so the restore leaves the existing ones in place.
// When recurring_rules is null, a transaction's recurring_rule_id points at a
// rule that already exists in the account (and keeps its id), so it is checked
// against existingRuleIds and passed through remapIds unchanged.

export const BACKUP_FORMAT = 'batchflow-backup'
export const BACKUP_VERSION = 2

// Table order is also the file order: parents before children.
export const COLUMNS = {
  categories: ['id', 'name', 'type', 'color', 'sort_order', 'created_at'],
  subcategories: ['id', 'category_id', 'name', 'sort_order', 'created_at'],
  recurring_rules: [
    'id', 'label', 'amount', 'type', 'frequency', 'start_date', 'end_date', 'merchant',
    'notes', 'category_id', 'subcategory_id', 'is_paused', 'created_at',
  ],
  transactions: [
    'id', 'date', 'amount', 'type', 'merchant', 'notes', 'is_split', 'category_id',
    'subcategory_id', 'recurring_rule_id', 'is_pending', 'scheduled_date', 'created_at',
  ],
  transaction_splits: ['id', 'transaction_id', 'category_id', 'subcategory_id', 'amount'],
  budget_plans: ['id', 'month_key', 'category_id', 'subcategory_id', 'planned_amount'],
  paycheck_plans: ['id', 'month_key', 'date', 'amount', 'label', 'created_at'],
}

export const TABLES = Object.keys(COLUMNS)

// Tables that may be null in a file: null means "the backup has none of these,
// keep what the account already has" (version 1 files).
const NULLABLE_TABLES = new Set(['recurring_rules', 'paycheck_plans'])

// Every id reference inside the file: { table: { column: referencedTable } }.
// Used both to validate references and to rewrite them in remapIds.
export const REFERENCES = {
  categories: {},
  subcategories: { category_id: 'categories' },
  recurring_rules: { category_id: 'categories', subcategory_id: 'subcategories' },
  transactions: {
    category_id: 'categories',
    subcategory_id: 'subcategories',
    recurring_rule_id: 'recurring_rules',
  },
  transaction_splits: {
    transaction_id: 'transactions',
    category_id: 'categories',
    subcategory_id: 'subcategories',
  },
  budget_plans: { category_id: 'categories', subcategory_id: 'subcategories' },
  paycheck_plans: {},
}

const AMOUNT_COLUMNS = {
  recurring_rules: ['amount'],
  transactions: ['amount'],
  transaction_splits: ['amount'],
  budget_plans: ['planned_amount'],
  paycheck_plans: ['amount'],
}

const TYPES = ['income', 'expense']
const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'yearly']

const LABELS = {
  categories: 'Category',
  subcategories: 'Subcategory',
  recurring_rules: 'Recurring rule',
  transactions: 'Transaction',
  transaction_splits: 'Split row',
  budget_plans: 'Budget plan',
  paycheck_plans: 'Paycheck plan',
}

const MAX_ERRORS_SHOWN = 20

// ── Build ─────────────────────────────────────────────────────────────────────

// Postgres numeric can arrive as a string; the file always holds numbers.
// Anything that does not parse is kept as is so validation reports it.
function toNumber(value) {
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return value
}

// rows: { categories: [...], subcategories: [...], ... } straight from the
// database. Returns the version 2 file object. Only the contract columns are
// copied, so user_id and anything else on the row is left out.
export function buildBackupV2(rows, exportedAt = new Date().toISOString()) {
  const backup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt }
  for (const table of TABLES) {
    const amounts = AMOUNT_COLUMNS[table] ?? []
    backup[table] = (rows?.[table] ?? []).map(row => {
      const out = {}
      for (const col of COLUMNS[table]) {
        const value = row[col] === undefined ? null : row[col]
        out[col] = amounts.includes(col) ? toNumber(value) : value
      }
      return out
    })
  }
  return backup
}

// ── Validate ──────────────────────────────────────────────────────────────────

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isBlank(v) {
  return v === null || v === undefined
}

function isValidDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function isValidMonthKey(v) {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

function isFiniteAmount(v) {
  return typeof v === 'number' && Number.isFinite(v)
}

function emptyCounts() {
  return Object.fromEntries(TABLES.map(t => [t, 0]))
}

function result(ok, errors, version, counts, pending = 0) {
  const shown = errors.length > MAX_ERRORS_SHOWN
    ? [...errors.slice(0, MAX_ERRORS_SHOWN), `...and ${errors.length - MAX_ERRORS_SHOWN} more problems.`]
    : errors
  return { ok, errors: shown, version, counts, pending, droppedBudgetEntries: 0 }
}

// Checks a version 2 object. Collects every problem rather than stopping at the
// first, so the person sees the whole picture. existingRuleIds: ids of the
// recurring rules already in the account, used only when the file has none.
function validateV2(data, existingRuleIds = new Set()) {
  const errors = []
  if (data.format !== BACKUP_FORMAT) {
    errors.push(`The file's format is not "${BACKUP_FORMAT}".`)
  }

  // Shape first: if a table is not an array nothing else can be checked.
  for (const table of TABLES) {
    const value = data[table]
    if (NULLABLE_TABLES.has(table) && isBlank(value)) continue
    if (!Array.isArray(value)) {
      errors.push(NULLABLE_TABLES.has(table)
        ? `"${table}" must be a list or null.`
        : `"${table}" is missing or is not a list.`)
    }
  }
  if (errors.length > 0) return result(false, errors, 2, null)

  const rowsOf = (table) => (Array.isArray(data[table]) ? data[table] : [])

  // Ids: every row needs a unique non-empty string id. These sets are what the
  // reference checks below look ids up in.
  const ids = {}
  for (const table of TABLES) {
    ids[table] = new Set()
    rowsOf(table).forEach((row, i) => {
      const where = `${LABELS[table]} ${i + 1}`
      if (!isPlainObject(row)) {
        errors.push(`${where} is not an object.`)
        return
      }
      if (typeof row.id !== 'string' || row.id === '') {
        errors.push(`${where} has no id.`)
      } else if (ids[table].has(row.id)) {
        errors.push(`${where} repeats the id "${row.id}".`)
      } else {
        ids[table].add(row.id)
      }
    })
  }

  const rulesIncluded = Array.isArray(data.recurring_rules)

  // Generic per-row helpers. `where` names the row in messages.
  const need = (cond, where, msg) => { if (!cond) errors.push(`${where} ${msg}`) }
  // Column problems read "Transaction 3: amount is not a finite number."
  const field = (cond, where, col, msg) => { if (!cond) errors.push(`${where}: ${col} ${msg}`) }
  const optString = (row, col, where) =>
    field(isBlank(row[col]) || typeof row[col] === 'string', where, col, 'is not text.')
  const optBool = (row, col, where) =>
    field(isBlank(row[col]) || typeof row[col] === 'boolean', where, col, 'is not true or false.')
  const optInt = (row, col, where) =>
    field(isBlank(row[col]) || Number.isInteger(row[col]), where, col, 'is not a whole number.')
  const optTimestamp = (row, col, where) =>
    field(isBlank(row[col]) || (typeof row[col] === 'string' && Number.isFinite(Date.parse(row[col]))),
      where, col, 'is not a valid timestamp.')
  const reqName = (row, col, where) =>
    need(typeof row[col] === 'string' && row[col].trim() !== '', where, `has no ${col}.`)
  const reqAmount = (row, col, where) =>
    field(isFiniteAmount(row[col]), where, col, 'is not a finite number.')
  const reqDate = (row, col, where) =>
    field(isValidDate(row[col]), where, col, 'is not a valid YYYY-MM-DD date.')
  const optDate = (row, col, where) =>
    field(isBlank(row[col]) || isValidDate(row[col]), where, col, 'is not a valid YYYY-MM-DD date.')
  const reqMonth = (row, col, where) =>
    field(isValidMonthKey(row[col]), where, col, 'is not a valid YYYY-MM month.')
  const reqType = (row, where) =>
    need(TYPES.includes(row.type), where, `has type "${row.type}", which must be income or expense.`)

  // References: a non-null id must exist in the referenced table in this file.
  const checkRefs = (table, row, where) => {
    for (const [col, target] of Object.entries(REFERENCES[table])) {
      const ref = row[col]
      if (isBlank(ref)) continue
      if (target === 'recurring_rules' && !rulesIncluded) {
        // The account's existing rules are kept, so a link to one of them is valid.
        if (!existingRuleIds.has(ref)) {
          errors.push(`${where} refers to recurring rule "${ref}", which is not in the file or in your account.`)
        }
      } else if (typeof ref !== 'string' || !ids[target].has(ref)) {
        errors.push(`${where} refers to ${LABELS[target].toLowerCase()} "${ref}", which is not in the file.`)
      }
    }
  }

  const eachRow = (table, fn) => {
    rowsOf(table).forEach((row, i) => {
      if (!isPlainObject(row)) return
      const where = `${LABELS[table]} ${i + 1}`
      fn(row, where)
      checkRefs(table, row, where)
    })
  }

  eachRow('categories', (row, where) => {
    reqName(row, 'name', where)
    reqType(row, where)
    optString(row, 'color', where)
    optInt(row, 'sort_order', where)
    optTimestamp(row, 'created_at', where)
  })

  eachRow('subcategories', (row, where) => {
    reqName(row, 'name', where)
    need(!isBlank(row.category_id), where, 'has no category_id.')
    optInt(row, 'sort_order', where)
    optTimestamp(row, 'created_at', where)
  })

  eachRow('recurring_rules', (row, where) => {
    optString(row, 'label', where)
    reqAmount(row, 'amount', where)
    reqType(row, where)
    need(FREQUENCIES.includes(row.frequency), where,
      `has frequency "${row.frequency}", which must be one of ${FREQUENCIES.join(', ')}.`)
    reqDate(row, 'start_date', where)
    optDate(row, 'end_date', where)
    optString(row, 'merchant', where)
    optString(row, 'notes', where)
    optBool(row, 'is_paused', where)
    optTimestamp(row, 'created_at', where)
  })

  // Split rows per transaction, for the "split needs rows" rule.
  const splitCount = new Map()
  for (const s of rowsOf('transaction_splits')) {
    if (isPlainObject(s) && typeof s.transaction_id === 'string') {
      splitCount.set(s.transaction_id, (splitCount.get(s.transaction_id) ?? 0) + 1)
    }
  }
  const splitTxnIds = new Set()
  let pending = 0

  eachRow('transactions', (row, where) => {
    reqDate(row, 'date', where)
    reqAmount(row, 'amount', where)
    reqType(row, where)
    optString(row, 'merchant', where)
    optString(row, 'notes', where)
    optBool(row, 'is_split', where)
    optBool(row, 'is_pending', where)
    optDate(row, 'scheduled_date', where)
    optTimestamp(row, 'created_at', where)
    if (row.is_pending === true) pending++
    if (row.is_split === true) {
      splitTxnIds.add(row.id)
      need(isBlank(row.category_id) && isBlank(row.subcategory_id), where,
        'is a split but also has its own category.')
      need((splitCount.get(row.id) ?? 0) > 0, where, 'is a split but has no split rows.')
    } else {
      need(!isBlank(row.category_id), where, 'has no category and is not a split.')
    }
  })

  eachRow('transaction_splits', (row, where) => {
    need(!isBlank(row.transaction_id), where, 'has no transaction_id.')
    need(!isBlank(row.category_id), where, 'has no category_id.')
    reqAmount(row, 'amount', where)
    if (typeof row.transaction_id === 'string' && ids.transactions.has(row.transaction_id)) {
      need(splitTxnIds.has(row.transaction_id), where,
        `belongs to transaction "${row.transaction_id}", which is not marked as a split.`)
    }
  })

  eachRow('budget_plans', (row, where) => {
    reqMonth(row, 'month_key', where)
    reqAmount(row, 'planned_amount', where)
    need(isBlank(row.category_id) !== isBlank(row.subcategory_id), where,
      'must have exactly one of category_id or subcategory_id.')
  })

  eachRow('paycheck_plans', (row, where) => {
    reqMonth(row, 'month_key', where)
    reqDate(row, 'date', where)
    reqAmount(row, 'amount', where)
    optString(row, 'label', where)
    optTimestamp(row, 'created_at', where)
  })

  const counts = emptyCounts()
  for (const table of TABLES) {
    counts[table] = Array.isArray(data[table]) ? data[table].length : null
  }
  return result(errors.length === 0, errors, 2, counts, pending)
}

// Version 1 structure check, done before conversion so convertV1ToV2 only ever
// sees the shapes it expects.
function checkV1Shape(data) {
  const errors = []
  if (!Array.isArray(data.categories)) errors.push('"categories" is missing or is not a list.')
  if (!Array.isArray(data.transactions)) errors.push('"transactions" is missing or is not a list.')
  if (!isPlainObject(data.budgets)) errors.push('"budgets" is missing or is not an object.')
  if (errors.length > 0) return errors

  data.categories.forEach((c, i) => {
    if (!isPlainObject(c)) { errors.push(`Category ${i + 1} is not an object.`); return }
    if (!isBlank(c.subcategories) && !Array.isArray(c.subcategories)) {
      errors.push(`Category ${i + 1} has subcategories that are not a list.`)
    } else {
      (c.subcategories ?? []).forEach((s, si) => {
        if (!isPlainObject(s)) errors.push(`Category ${i + 1}, subcategory ${si + 1} is not an object.`)
      })
    }
  })
  data.transactions.forEach((t, i) => {
    if (!isPlainObject(t)) { errors.push(`Transaction ${i + 1} is not an object.`); return }
    if (!isBlank(t.splits) && !Array.isArray(t.splits)) {
      errors.push(`Transaction ${i + 1} has splits that are not a list.`)
    } else {
      (t.splits ?? []).forEach((s, si) => {
        if (!isPlainObject(s)) errors.push(`Transaction ${i + 1}, split ${si + 1} is not an object.`)
      })
    }
  })
  for (const [monthKey, month] of Object.entries(data.budgets)) {
    if (!isPlainObject(month)) { errors.push(`Budget month ${monthKey} is not an object.`); continue }
    for (const key of ['planned', 'subcategoryPlanned']) {
      if (!isBlank(month[key]) && !isPlainObject(month[key])) {
        errors.push(`Budget month ${monthKey} has ${key} that is not an object.`)
      }
    }
  }
  return errors
}

// data: a parsed backup file of any version. Returns
// { ok, errors, version, counts, pending, droppedBudgetEntries }. counts has one
// entry per table (null for a table the file leaves out) and is what the
// restore should report back. pending is the number of transactions that will
// be restored as pending. droppedBudgetEntries is the number of version 1
// budget entries skipped because their category or subcategory is not in the
// file (always 0 for version 2, which stays strict).
// options.existingRuleIds: iterable of the account's current recurring rule ids.
export function validateBackup(data, { existingRuleIds } = {}) {
  if (!isPlainObject(data)) {
    return result(false, ['The file is not a BatchFlow backup (expected a JSON object).'], null, null)
  }
  const ruleIds = new Set(existingRuleIds ?? [])
  // Very early exports had no version field; their shape is version 1.
  const version = data.version === undefined ? 1 : data.version
  if (version === 2) return validateV2(data, ruleIds)
  if (version === 1) {
    const shapeErrors = checkV1Shape(data)
    if (shapeErrors.length > 0) return result(false, shapeErrors, 1, null)
    const { backup, droppedBudgetEntries } = convertV1ToV2(data, { existingRuleIds: ruleIds })
    return { ...validateV2(backup, ruleIds), version: 1, droppedBudgetEntries }
  }
  return result(false, [`Unsupported backup version: ${JSON.stringify(data.version)}.`], null, null)
}

// ── Convert ───────────────────────────────────────────────────────────────────

const defaultNewId = () => crypto.randomUUID()

// Maps the version 1 shape (nested subcategories, camelCase transactions with a
// splits array, the budgets map) to version 2. Returns
// { backup, droppedBudgetEntries }.
// - isPending and scheduledDate are kept when the file has them.
// - recurringRuleId is kept only when it is in existingRuleIds (the rules in the
//   account now, which a version 1 restore keeps with their ids), else null.
// - Budget entries whose category or subcategory is not in the file are
//   dropped and counted: they can only be leftovers of a deleted category.
// - Split rows and budget plans had no ids in version 1, so they get new ones.
export function convertV1ToV2(data, { existingRuleIds, newId = defaultNewId } = {}) {
  const ruleIds = new Set(existingRuleIds ?? [])
  const categories = []
  const subcategories = []
  ;(data.categories ?? []).forEach((c, i) => {
    categories.push({
      id: c.id ?? null,
      name: c.name ?? null,
      type: c.type ?? null,
      color: c.color ?? null,
      sort_order: i,
      created_at: null,
    })
    ;(c.subcategories ?? []).forEach((s, si) => {
      subcategories.push({
        id: s.id ?? null,
        category_id: c.id ?? null,
        name: s.name ?? null,
        sort_order: si,
        created_at: null,
      })
    })
  })

  const transactions = []
  const transaction_splits = []
  for (const t of data.transactions ?? []) {
    // An empty splits array is a flat transaction, as in the old import.
    const isSplit = Array.isArray(t.splits) && t.splits.length > 0
    transactions.push({
      id: t.id ?? null,
      date: t.date ?? null,
      amount: t.amount ?? null,
      type: t.type ?? null,
      merchant: t.merchant || null,
      notes: t.notes || null,
      is_split: isSplit,
      category_id: isSplit ? null : (t.categoryId ?? null),
      subcategory_id: isSplit ? null : (t.subcategoryId || null),
      recurring_rule_id: ruleIds.has(t.recurringRuleId) ? t.recurringRuleId : null,
      is_pending: t.isPending === true,
      scheduled_date: t.scheduledDate ?? null,
      created_at: null,
    })
    if (isSplit) {
      for (const s of t.splits) {
        transaction_splits.push({
          id: newId(),
          transaction_id: t.id ?? null,
          category_id: s.categoryId ?? null,
          subcategory_id: s.subcategoryId || null,
          amount: s.amount ?? null,
        })
      }
    }
  }

  const categoryIds = new Set(categories.map(c => c.id))
  const subcategoryIds = new Set(subcategories.map(s => s.id))
  const budget_plans = []
  let droppedBudgetEntries = 0
  for (const [monthKey, month] of Object.entries(data.budgets ?? {})) {
    for (const [catId, amount] of Object.entries(month?.planned ?? {})) {
      if (!categoryIds.has(catId)) { droppedBudgetEntries++; continue }
      budget_plans.push({
        id: newId(), month_key: monthKey, category_id: catId, subcategory_id: null, planned_amount: amount,
      })
    }
    for (const [subId, amount] of Object.entries(month?.subcategoryPlanned ?? {})) {
      if (!subcategoryIds.has(subId)) { droppedBudgetEntries++; continue }
      budget_plans.push({
        id: newId(), month_key: monthKey, category_id: null, subcategory_id: subId, planned_amount: amount,
      })
    }
  }

  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: data.exportedAt ?? null,
    categories,
    subcategories,
    recurring_rules: null,
    transactions,
    transaction_splits,
    budget_plans,
    paycheck_plans: null,
  }
  return { backup, droppedBudgetEntries }
}

// ── Remap ─────────────────────────────────────────────────────────────────────

// Returns a copy of a validated version 2 object in which every row id is new
// and every reference is rewritten through the same map. Restoring with fresh
// ids means a backup never collides with rows owned by another account, so it
// can be restored into any account. A reference into a table the file leaves
// out (null) points at a row the restore keeps in the account, so it is passed
// through unchanged. Throws if any other reference has no target, which
// validateBackup rules out beforehand.
export function remapIds(v2, newId = defaultNewId) {
  const maps = {}
  for (const table of TABLES) {
    maps[table] = new Map()
    for (const row of v2[table] ?? []) {
      if (maps[table].has(row.id)) throw new Error(`remapIds: duplicate ${table} id ${row.id}`)
      maps[table].set(row.id, newId())
    }
  }

  const out = { ...v2 }
  for (const table of TABLES) {
    if (!Array.isArray(v2[table])) {
      out[table] = v2[table] ?? null
      continue
    }
    out[table] = v2[table].map(row => {
      const copy = { ...row, id: maps[table].get(row.id) }
      for (const [col, target] of Object.entries(REFERENCES[table])) {
        const ref = row[col]
        if (isBlank(ref)) continue
        if (!Array.isArray(v2[target])) continue
        if (!maps[target].has(ref)) {
          throw new Error(`remapIds: ${table}.${col} refers to missing ${target} id ${ref}`)
        }
        copy[col] = maps[target].get(ref)
      }
      return copy
    })
  }
  return out
}
