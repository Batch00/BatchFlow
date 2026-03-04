import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { defaultCategories } from '../data/defaultCategories'
import { getMonthKey } from '../utils/formatters'
import { loadData, saveData } from '../utils/storage'
import { getOccurrencesInMonth } from '../utils/recurringUtils'

const AppContext = createContext(null)

// ── Data mappers ─────────────────────────────────────────────────────────────
// Convert DB snake_case rows → app camelCase objects

function dbToCategory(row, allSubRows) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    color: row.color,
    subcategories: allSubRows
      .filter(s => s.category_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => ({ id: s.id, name: s.name })),
  }
}

function dbToTransaction(row) {
  const base = {
    id: row.id,
    date: row.date,
    amount: parseFloat(row.amount),
    type: row.type,
    merchant: row.merchant ?? '',
    notes: row.notes ?? '',
    recurringRuleId: row.recurring_rule_id ?? null,
    isPending: row.is_pending ?? false,
    scheduledDate: row.scheduled_date ?? null,
  }
  if (row.is_split) {
    return {
      ...base,
      categoryId: null,
      subcategoryId: null,
      splits: (row.transaction_splits ?? []).map(s => ({
        categoryId: s.category_id,
        subcategoryId: s.subcategory_id ?? null,
        amount: parseFloat(s.amount),
      })),
    }
  }
  return {
    ...base,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id ?? null,
  }
}

function dbToRecurringRule(row) {
  return {
    id: row.id,
    label: row.label ?? '',
    amount: parseFloat(row.amount),
    type: row.type,
    frequency: row.frequency,
    startDate: row.start_date,
    endDate: row.end_date ?? null,
    merchant: row.merchant ?? '',
    notes: row.notes ?? '',
    categoryId: row.category_id ?? null,
    subcategoryId: row.subcategory_id ?? null,
    isPaused: row.is_paused ?? false,
    createdAt: row.created_at,
  }
}

function dbToPaycheckPlan(row) {
  return {
    id: row.id,
    monthKey: row.month_key,
    date: row.date,
    amount: parseFloat(row.amount),
    label: row.label ?? 'Paycheck',
    createdAt: row.created_at,
  }
}

// Build the full multi-month budgets map from all budget_plan rows
function dbToBudgets(planRows) {
  const budgets = {}
  for (const row of planRows) {
    if (!budgets[row.month_key]) {
      budgets[row.month_key] = { planned: {}, subcategoryPlanned: {} }
    }
    if (row.category_id) {
      budgets[row.month_key].planned[row.category_id] = parseFloat(row.planned_amount)
    } else {
      budgets[row.month_key].subcategoryPlanned[row.subcategory_id] = parseFloat(row.planned_amount)
    }
  }
  return budgets
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AppProvider({ children }) {
  const { user } = useAuth()

  // currentMonth is UI state only — persisted in localStorage, not Supabase
  const [currentMonth, setCurrentMonthState] = useState(
    () => loadData('currentMonth', getMonthKey())
  )
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState({})
  const [recurringRules, setRecurringRules] = useState([])
  const [paycheckPlans, setPaycheckPlans] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Theme ─────────────────────────────────────────────────────────────────────
  const [theme, setThemeState] = useState(() => {
    const t = loadData('theme', 'dark')
    return t === 'system' ? 'dark' : t
  })

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme)
    saveData('theme', newTheme)
    supabase.auth.updateUser({ data: { theme: newTheme } }).catch(() => {})
  }, [])

  // Apply/remove .dark class on <html> and update PWA theme-color meta tags
  useEffect(() => {
    const root = document.documentElement
    const dark = theme === 'dark'
    if (dark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    const lightMeta = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')
    const darkMeta = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')
    if (lightMeta) lightMeta.content = dark ? '#0f172a' : '#4f46e5'
    if (darkMeta) darkMeta.content = dark ? '#0f172a' : '#4f46e5'
  }, [theme])

  // Sync theme from Supabase user metadata on login
  useEffect(() => {
    if (!user) return
    const remoteTheme = user.user_metadata?.theme
    if (remoteTheme && remoteTheme !== 'system') {
      const local = loadData('theme', 'dark')
      if (remoteTheme !== local) setTheme(remoteTheme)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDark = theme === 'dark'

  // ── refreshTransactions ──────────────────────────────────────────────────────
  // Re-fetches all transactions from Supabase and replaces local state.
  // Called by the Dashboard on mount to guarantee fresh data.

  const refreshTransactions = useCallback(async () => {
    if (!user) return
    const { data: txRows, error } = await supabase
      .from('transactions')
      .select('*, transaction_splits(*)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
    if (!error && txRows) {
      setTransactions(txRows.map(dbToTransaction))
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time subscription ────────────────────────────────────────────────────
  // Listen for INSERT / UPDATE / DELETE on `transactions` so all open pages
  // (Dashboard, Transactions, Analytics, Calendar) stay in sync automatically.

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`transactions:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        async (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload

          if (eventType === 'DELETE') {
            setTransactions(prev => prev.filter(t => t.id !== oldRow.id))
            return
          }

          // INSERT or UPDATE: re-fetch the full row (with splits) from DB
          const { data } = await supabase
            .from('transactions')
            .select('*, transaction_splits(*)')
            .eq('id', newRow.id)
            .single()

          if (!data || data.user_id !== user.id) return
          const txn = dbToTransaction(data)

          if (eventType === 'INSERT') {
            // Deduplicate: our own mutations already update local state optimistically
            setTransactions(prev =>
              prev.some(t => t.id === txn.id) ? prev : [txn, ...prev]
            )
          } else {
            // UPDATE: overwrite with authoritative server data
            setTransactions(prev =>
              prev.some(t => t.id === txn.id)
                ? prev.map(t => t.id === txn.id ? txn : t)
                : prev
            )
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refs so callbacks can read latest state without stale closures
  const transactionsRef = useRef(transactions)
  useEffect(() => { transactionsRef.current = transactions }, [transactions])

  const recurringRulesRef = useRef(recurringRules)
  useEffect(() => { recurringRulesRef.current = recurringRules }, [recurringRules])

  const currentMonthRef = useRef(currentMonth)
  useEffect(() => { currentMonthRef.current = currentMonth }, [currentMonth])

  // ── Recurring instance generation ────────────────────────────────────────────
  // Generates pending transaction instances for a month from active recurring rules.
  // txnsOverride / rulesOverride are used when calling right after loadAll() before
  // refs are updated with the freshly fetched data.

  const generateRecurringInstances = useCallback(async (monthKey, txnsOverride, rulesOverride) => {
    if (!user) return
    const rules = rulesOverride ?? recurringRulesRef.current
    const currentTxns = txnsOverride ?? transactionsRef.current

    const activeRules = rules.filter(r => !r.isPaused)
    if (activeRules.length === 0) return

    const toInsert = []
    for (const rule of activeRules) {
      const dates = getOccurrencesInMonth(rule, monthKey)
      for (const date of dates) {
        // Skip if an instance already exists for this rule + scheduled date
        const exists = currentTxns.some(
          t => t.recurringRuleId === rule.id && t.scheduledDate === date
        )
        if (!exists) {
          toInsert.push({
            user_id: user.id,
            date,
            scheduled_date: date,
            amount: rule.amount,
            type: rule.type,
            merchant: rule.merchant || null,
            notes: rule.notes || null,
            is_split: false,
            category_id: rule.categoryId || null,
            subcategory_id: rule.subcategoryId || null,
            recurring_rule_id: rule.id,
            is_pending: true,
          })
        }
      }
    }

    if (toInsert.length === 0) return

    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert(toInsert)
      .select('*, transaction_splits(*)')

    if (error) {
      // 23505 = unique_violation — instances already exist (race condition safety net)
      if (error.code !== '23505') {
        console.error('Failed to generate recurring instances:', error)
      }
      return
    }

    if (inserted?.length) {
      setTransactions(prev => {
        const existingIds = new Set(prev.map(t => t.id))
        const newOnes = inserted.filter(r => !existingIds.has(r.id)).map(dbToTransaction)
        return newOnes.length > 0 ? [...newOnes, ...prev] : prev
      })
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      // Logged out — clear all data
      setCategories([])
      setTransactions([])
      setBudgets({})
      setRecurringRules([])
      setPaycheckPlans([])
      setLoading(false)
      return
    }

    setLoading(true)

    async function seedDefaults() {
      // IMPORTANT: do NOT pass `id` here. defaultCategories uses plain string IDs
      // like 'income' and 'housing' which are not valid UUIDs. The DB schema uses
      // `id uuid PRIMARY KEY`, so inserting those strings would fail with:
      //   "invalid input syntax for type uuid: "income""
      // Let Postgres generate UUIDs and map them back by name.
      const catInserts = defaultCategories.map((c, i) => ({
        user_id: user.id,
        name: c.name,
        type: c.type,
        color: c.color ?? '#6366f1',
        sort_order: i,
      }))
      const { data: insertedCats, error: catErr } = await supabase
        .from('categories').insert(catInserts).select()
      if (catErr) {
        console.error('seedDefaults — categories insert failed:', catErr)
        return []
      }

      // Map original string key → DB-generated UUID so subcategory rows can
      // reference the correct parent.
      const catIdMap = {}
      defaultCategories.forEach(c => {
        const dbRow = insertedCats.find(row => row.name === c.name)
        if (dbRow) catIdMap[c.id] = dbRow.id
      })

      const subInserts = defaultCategories.flatMap(c =>
        (c.subcategories ?? []).map((s, si) => ({
          // No `id` — let the DB generate a UUID
          category_id: catIdMap[c.id],   // DB UUID, not the old string key
          user_id: user.id,
          name: s.name,
          sort_order: si,
        }))
      )
      let insertedSubs = []
      if (subInserts.length > 0) {
        const { data, error: subErr } = await supabase
          .from('subcategories').insert(subInserts).select()
        if (subErr) console.error('seedDefaults — subcategories insert failed:', subErr)
        else insertedSubs = data ?? []
      }
      return (insertedCats ?? []).map(row => dbToCategory(row, insertedSubs))
    }

    async function loadAll() {
      // Fetch all user data in parallel — no month scoping needed; Analytics needs all months
      const [
        { data: catRows,      error: catErr      },
        { data: subRows,      error: subErr      },
        { data: txRows,       error: txErr       },
        { data: planRows,     error: planErr     },
        { data: ruleRows,     error: ruleErr     },
        { data: paycheckRows, error: paycheckErr },
      ] = await Promise.all([
        supabase.from('categories')      .select('*')                      .eq('user_id', user.id).order('sort_order'),
        supabase.from('subcategories')   .select('*')                      .eq('user_id', user.id).order('sort_order'),
        supabase.from('transactions')    .select('*, transaction_splits(*)').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('budget_plans')    .select('*')                      .eq('user_id', user.id),
        supabase.from('recurring_rules') .select('*')                      .eq('user_id', user.id).order('created_at'),
        supabase.from('paycheck_plans')  .select('*')                      .eq('user_id', user.id).order('date'),
      ])

      if (catErr || subErr || txErr || planErr || ruleErr || paycheckErr) {
        // RLS "permission denied" shows up here as an error (not empty data).
        // Empty data with no error = RLS silently filtering — check Supabase policies.
        console.error('loadAll — query errors:', { catErr, subErr, txErr, planErr, ruleErr, paycheckErr })
        setLoading(false)
        return
      }
      console.debug('loadAll — row counts:', {
        categories: catRows.length,
        subcategories: subRows.length,
        transactions: txRows.length,
        budgetPlans: planRows.length,
        recurringRules: (ruleRows ?? []).length,
        paycheckPlans: (paycheckRows ?? []).length,
      })

      const isNewAccount = catRows.length === 0
      const cats = isNewAccount
        ? await seedDefaults()
        : catRows.map(row => dbToCategory(row, subRows ?? []))

      // New accounts get dark mode by default; existing accounts keep their stored preference
      if (isNewAccount) setTheme('dark')

      const mappedTxns = (txRows ?? []).map(dbToTransaction)
      const mappedRules = (ruleRows ?? []).map(dbToRecurringRule)

      const mappedPaychecks = (paycheckRows ?? []).map(dbToPaycheckPlan)

      setCategories(cats)
      setTransactions(mappedTxns)
      setBudgets(dbToBudgets(planRows ?? []))
      setRecurringRules(mappedRules)
      setPaycheckPlans(mappedPaychecks)
      setLoading(false)

      // Generate pending instances for the currently viewed month.
      // Pass mapped data directly since refs haven't been updated yet.
      await generateRecurringInstances(currentMonthRef.current, mappedTxns, mappedRules)
    }

    loadAll()
  }, [user?.id]) // re-run on login / logout

  // ── setCurrentMonth ─────────────────────────────────────────────────────────

  const setCurrentMonth = useCallback((monthKey) => {
    setCurrentMonthState(monthKey)
    saveData('currentMonth', monthKey)
    // Generate pending instances for the newly selected month (uses refs for current state)
    generateRecurringInstances(monthKey)
  }, [generateRecurringInstances])

  // ── Transactions ─────────────────────────────────────────────────────────────

  const addTransaction = useCallback(async (transaction) => {
    const isSplit = transaction.categoryId === null && Array.isArray(transaction.splits)

    const { data: txRow, error: txErr } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        date: transaction.date,
        amount: transaction.amount,
        type: transaction.type,
        merchant: transaction.merchant || null,
        notes: transaction.notes || null,
        is_split: isSplit,
        category_id: isSplit ? null : transaction.categoryId,
        subcategory_id: isSplit ? null : (transaction.subcategoryId || null),
        recurring_rule_id: transaction.recurringRuleId ?? null,
        is_pending: transaction.isPending ?? false,
        scheduled_date: transaction.scheduledDate ?? null,
      })
      .select()
      .single()

    if (txErr) { console.error('Failed to add transaction:', txErr); return null }

    let splitRows = []
    if (isSplit && transaction.splits.length > 0) {
      const { data: inserted, error: splitErr } = await supabase
        .from('transaction_splits')
        .insert(transaction.splits.map(s => ({
          transaction_id: txRow.id,
          category_id: s.categoryId,
          subcategory_id: s.subcategoryId || null,
          amount: s.amount,
        })))
        .select()
      if (splitErr) console.error('Failed to add splits:', splitErr)
      splitRows = inserted ?? []
    }

    const newTransaction = dbToTransaction({ ...txRow, transaction_splits: splitRows })
    setTransactions(prev => [newTransaction, ...prev])
    return newTransaction
  }, [user])

  const updateTransaction = useCallback(async (id, updates) => {
    // Use ref so we always read the latest transactions without stale closure
    const existing = transactionsRef.current.find(t => t.id === id)
    if (!existing) return

    const isSplit = updates.categoryId === null && Array.isArray(updates.splits)

    const updateFields = {
      date: updates.date,
      amount: updates.amount,
      type: updates.type,
      merchant: updates.merchant || null,
      notes: updates.notes || null,
      is_split: isSplit,
      category_id: isSplit ? null : updates.categoryId,
      subcategory_id: isSplit ? null : (updates.subcategoryId || null),
    }
    // Only include recurring fields if explicitly provided in updates
    if ('recurringRuleId' in updates) {
      updateFields.recurring_rule_id = updates.recurringRuleId ?? null
    }
    if ('isPending' in updates) {
      updateFields.is_pending = updates.isPending
    }

    const { error: txErr } = await supabase
      .from('transactions')
      .update(updateFields)
      .eq('id', id)
      .eq('user_id', user.id) // defense-in-depth: RLS enforces this server-side too

    if (txErr) { console.error('Failed to update transaction:', txErr); return }

    // Replace splits whenever the transaction was or is now a split
    if (existing.splits || isSplit) {
      await supabase.from('transaction_splits').delete().eq('transaction_id', id)
    }

    let newSplitRows = []
    if (isSplit && updates.splits.length > 0) {
      const { data: inserted, error: splitErr } = await supabase
        .from('transaction_splits')
        .insert(updates.splits.map(s => ({
          transaction_id: id,
          category_id: s.categoryId,
          subcategory_id: s.subcategoryId || null,
          amount: s.amount,
        })))
        .select()
      if (splitErr) console.error('Failed to update splits:', splitErr)
      newSplitRows = inserted ?? []
    }

    const updatedTransaction = dbToTransaction({
      id,
      user_id: user.id,
      date: updates.date,
      amount: updates.amount,
      type: updates.type,
      merchant: updates.merchant || null,
      notes: updates.notes || null,
      is_split: isSplit,
      category_id: isSplit ? null : updates.categoryId,
      subcategory_id: isSplit ? null : (updates.subcategoryId || null),
      transaction_splits: newSplitRows,
      recurring_rule_id: 'recurringRuleId' in updates ? (updates.recurringRuleId ?? null) : (existing.recurringRuleId ?? null),
      is_pending: 'isPending' in updates ? updates.isPending : (existing.isPending ?? false),
      scheduled_date: existing.scheduledDate ?? null,
    })

    setTransactions(prev => prev.map(t => t.id === id ? updatedTransaction : t))
  }, [user])

  const deleteTransaction = useCallback(async (id) => {
    // transaction_splits cascade-delete from the DB schema
    const { error } = await supabase.from('transactions').delete()
      .eq('id', id).eq('user_id', user.id) // defense-in-depth: RLS enforces this server-side too
    if (error) { console.error('Failed to delete transaction:', error); return }
    setTransactions(prev => prev.filter(t => t.id !== id))
  }, [user])

  const confirmTransaction = useCallback(async (id) => {
    const { error } = await supabase
      .from('transactions')
      .update({ is_pending: false })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) { console.error('Failed to confirm transaction:', error); return }
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, isPending: false } : t))
  }, [user])

  // ── Recurring Rules ───────────────────────────────────────────────────────────

  const addRecurringRule = useCallback(async (ruleData) => {
    const { data: row, error } = await supabase
      .from('recurring_rules')
      .insert({
        user_id: user.id,
        label: ruleData.label,
        amount: ruleData.amount,
        type: ruleData.type,
        frequency: ruleData.frequency,
        start_date: ruleData.startDate,
        end_date: ruleData.endDate || null,
        merchant: ruleData.merchant || null,
        notes: ruleData.notes || null,
        category_id: ruleData.categoryId || null,
        subcategory_id: ruleData.subcategoryId || null,
        is_paused: false,
      })
      .select()
      .single()

    if (error) { console.error('Failed to add recurring rule:', error); return null }
    const newRule = dbToRecurringRule(row)
    setRecurringRules(prev => [...prev, newRule])
    return newRule
  }, [user])

  const updateRecurringRule = useCallback(async (id, updates) => {
    const { data: row, error } = await supabase
      .from('recurring_rules')
      .update({
        label: updates.label,
        amount: updates.amount,
        type: updates.type,
        frequency: updates.frequency,
        start_date: updates.startDate,
        end_date: updates.endDate || null,
        merchant: updates.merchant || null,
        notes: updates.notes || null,
        category_id: updates.categoryId || null,
        subcategory_id: updates.subcategoryId || null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) { console.error('Failed to update recurring rule:', error); return null }
    const updatedRule = dbToRecurringRule(row)
    setRecurringRules(prev => prev.map(r => r.id === id ? updatedRule : r))

    // Propagate editable fields to confirmed (past) instances so calendar and
    // transaction list stay consistent with the updated rule across all months.
    await supabase.from('transactions')
      .update({
        merchant: updates.merchant || null,
        notes: updates.notes || null,
        amount: updates.amount,
        type: updates.type,
        category_id: updates.categoryId || null,
        subcategory_id: updates.subcategoryId || null,
      })
      .eq('recurring_rule_id', id)
      .eq('is_pending', false)
      .eq('user_id', user.id)

    setTransactions(prev => prev.map(t =>
      t.recurringRuleId === id && !t.isPending
        ? {
            ...t,
            merchant: updates.merchant || '',
            notes: updates.notes || '',
            amount: updates.amount,
            type: updates.type,
            categoryId: updates.categoryId || null,
            subcategoryId: updates.subcategoryId || null,
          }
        : t
    ))

    // Delete ALL pending instances for this rule. Patching fields in-place is not
    // enough because schedule changes (start_date / frequency / end_date) would leave
    // instances with stale scheduled_dates, causing duplicates the next time
    // generateRecurringInstances runs. Deleting and regenerating is always correct.
    await supabase.from('transactions')
      .delete()
      .eq('recurring_rule_id', id)
      .eq('is_pending', true)
      .eq('user_id', user.id)

    setTransactions(prev => prev.filter(t => !(t.recurringRuleId === id && t.isPending)))

    // Regenerate fresh pending instances for the current month based on the updated rule.
    await generateRecurringInstances(currentMonthRef.current)

    return updatedRule
  }, [user, generateRecurringInstances])

  const pauseRecurringRule = useCallback(async (id, isPaused) => {
    const { error } = await supabase
      .from('recurring_rules')
      .update({ is_paused: isPaused })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) { console.error('Failed to pause/resume recurring rule:', error); return }
    setRecurringRules(prev => prev.map(r => r.id === id ? { ...r, isPaused } : r))
  }, [user])

  const deleteRecurringRule = useCallback(async (id) => {
    // Delete pending instances for this rule (confirmed instances stay, auto-detach via ON DELETE SET NULL)
    await supabase.from('transactions')
      .delete()
      .eq('recurring_rule_id', id)
      .eq('is_pending', true)
      .eq('user_id', user.id)

    const { error } = await supabase.from('recurring_rules').delete()
      .eq('id', id).eq('user_id', user.id)

    if (error) { console.error('Failed to delete recurring rule:', error); return }

    // Remove pending instances from local state; detach confirmed instances
    setTransactions(prev =>
      prev
        .filter(t => !(t.recurringRuleId === id && t.isPending))
        .map(t => t.recurringRuleId === id ? { ...t, recurringRuleId: null } : t)
    )
    setRecurringRules(prev => prev.filter(r => r.id !== id))
  }, [user])

  // ── Paycheck Plans ────────────────────────────────────────────────────────────

  const addPaycheckPlan = useCallback(async ({ label, date, amount, monthKey }) => {
    const { data: row, error } = await supabase
      .from('paycheck_plans')
      .insert({ user_id: user.id, month_key: monthKey, date, amount, label })
      .select()
      .single()
    if (error) { console.error('Failed to add paycheck plan:', error); return null }
    const plan = dbToPaycheckPlan(row)
    setPaycheckPlans(prev => [...prev, plan])
    return plan
  }, [user])

  const updatePaycheckPlan = useCallback(async (id, { label, date, amount }) => {
    const { data: row, error } = await supabase
      .from('paycheck_plans')
      .update({ label, date, amount })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) { console.error('Failed to update paycheck plan:', error); return }
    const updated = dbToPaycheckPlan(row)
    setPaycheckPlans(prev => prev.map(p => p.id === id ? updated : p))
  }, [user])

  const deletePaycheckPlan = useCallback(async (id) => {
    const { error } = await supabase
      .from('paycheck_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) { console.error('Failed to delete paycheck plan:', error); return }
    setPaycheckPlans(prev => prev.filter(p => p.id !== id))
  }, [user])

  // ── Budgets ───────────────────────────────────────────────────────────────────
  // Budget writes use an optimistic update so typing into budget fields feels instant.
  // We use DELETE + INSERT instead of upsert to avoid issues with partial unique indexes.

  const setBudgetAmount = useCallback(async (monthKey, categoryId, amount) => {
    // Optimistic update
    setBudgets(prev => ({
      ...prev,
      [monthKey]: {
        planned: { ...(prev[monthKey]?.planned ?? {}), [categoryId]: amount },
        subcategoryPlanned: prev[monthKey]?.subcategoryPlanned ?? {},
      },
    }))

    await supabase.from('budget_plans').delete()
      .eq('user_id', user.id).eq('month_key', monthKey).eq('category_id', categoryId)

    const { error } = await supabase.from('budget_plans').insert({
      user_id: user.id,
      month_key: monthKey,
      category_id: categoryId,
      subcategory_id: null,
      planned_amount: amount,
    })
    if (error) console.error('Failed to set budget amount:', error)
  }, [user])

  const setSubcategoryBudgetAmount = useCallback(async (monthKey, subcategoryId, amount) => {
    // Optimistic update
    setBudgets(prev => ({
      ...prev,
      [monthKey]: {
        planned: prev[monthKey]?.planned ?? {},
        subcategoryPlanned: { ...(prev[monthKey]?.subcategoryPlanned ?? {}), [subcategoryId]: amount },
      },
    }))

    await supabase.from('budget_plans').delete()
      .eq('user_id', user.id).eq('month_key', monthKey).eq('subcategory_id', subcategoryId)

    const { error } = await supabase.from('budget_plans').insert({
      user_id: user.id,
      month_key: monthKey,
      category_id: null,
      subcategory_id: subcategoryId,
      planned_amount: amount,
    })
    if (error) console.error('Failed to set subcategory budget amount:', error)
  }, [user])

  const getMonthBudget = useCallback((monthKey) => {
    return budgets[monthKey] ?? { planned: {}, subcategoryPlanned: {} }
  }, [budgets])

  const resetMonthBudget = useCallback(async (monthKey) => {
    const { error } = await supabase.from('budget_plans').delete()
      .eq('user_id', user.id).eq('month_key', monthKey)
    if (error) { console.error('Failed to reset month budget:', error); return }
    setBudgets(prev => { const next = { ...prev }; delete next[monthKey]; return next })
  }, [user])

  const copyBudget = useCallback(async (fromKey, toKey) => {
    const source = budgets[fromKey]
    if (!source) return

    // Build the flat rows to copy
    const inserts = [
      ...Object.entries(source.planned ?? {}).map(([catId, amt]) => ({
        user_id: user.id, month_key: toKey, category_id: catId, subcategory_id: null, planned_amount: amt,
      })),
      ...Object.entries(source.subcategoryPlanned ?? {}).map(([subId, amt]) => ({
        user_id: user.id, month_key: toKey, category_id: null, subcategory_id: subId, planned_amount: amt,
      })),
    ]

    // Delete target month's existing plans then insert copies
    await supabase.from('budget_plans').delete().eq('user_id', user.id).eq('month_key', toKey)

    if (inserts.length > 0) {
      const { error } = await supabase.from('budget_plans').insert(inserts)
      if (error) { console.error('Failed to copy budget plans:', error); return }
    }

    setBudgets(prev => ({
      ...prev,
      [toKey]: {
        planned: { ...source.planned },
        subcategoryPlanned: { ...source.subcategoryPlanned },
      },
    }))
  }, [user, budgets])

  // ── Categories ────────────────────────────────────────────────────────────────

  const addCategory = useCallback(async (category) => {
    const sortOrder = categories.filter(c => c.type === category.type).length

    const { data: row, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: category.name,
        type: category.type,
        color: category.color ?? '#6366f1',
        sort_order: sortOrder,
      })
      .select().single()

    if (error) { console.error('Failed to add category:', error); return }
    setCategories(prev => [...prev, { ...row, subcategories: [] }])
  }, [user, categories])

  const updateCategory = useCallback(async (id, updates) => {
    const { error } = await supabase
      .from('categories').update({ name: updates.name, color: updates.color })
      .eq('id', id).eq('user_id', user.id) // defense-in-depth: RLS enforces this server-side too
    if (error) { console.error('Failed to update category:', error); return }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [user])

  const deleteCategory = useCallback(async (id) => {
    // Subcategories and budget_plans cascade-delete from the DB schema
    const { error } = await supabase.from('categories').delete()
      .eq('id', id).eq('user_id', user.id) // defense-in-depth: RLS enforces this server-side too
    if (error) { console.error('Failed to delete category:', error); return }
    setCategories(prev => prev.filter(c => c.id !== id))
  }, [user])

  const addSubcategory = useCallback(async (categoryId, name) => {
    const category = categories.find(c => c.id === categoryId)
    const sortOrder = category?.subcategories.length ?? 0

    const { data: row, error } = await supabase
      .from('subcategories')
      .insert({ category_id: categoryId, user_id: user.id, name, sort_order: sortOrder })
      .select().single()

    if (error) { console.error('Failed to add subcategory:', error); return }
    setCategories(prev => prev.map(c =>
      c.id === categoryId
        ? { ...c, subcategories: [...c.subcategories, { id: row.id, name: row.name }] }
        : c
    ))
  }, [user, categories])

  const updateSubcategory = useCallback(async (categoryId, subId, name) => {
    const { error } = await supabase.from('subcategories').update({ name })
      .eq('id', subId).eq('user_id', user.id) // defense-in-depth: RLS enforces this server-side too
    if (error) { console.error('Failed to update subcategory:', error); return }
    setCategories(prev => prev.map(c =>
      c.id === categoryId
        ? { ...c, subcategories: c.subcategories.map(s => s.id === subId ? { ...s, name } : s) }
        : c
    ))
  }, [user])

  const deleteSubcategory = useCallback(async (categoryId, subId) => {
    // budget_plans rows referencing this subcategory cascade-delete
    const { error } = await supabase.from('subcategories').delete()
      .eq('id', subId).eq('user_id', user.id) // defense-in-depth: RLS enforces this server-side too
    if (error) { console.error('Failed to delete subcategory:', error); return }
    setCategories(prev => prev.map(c =>
      c.id === categoryId
        ? { ...c, subcategories: c.subcategories.filter(s => s.id !== subId) }
        : c
    ))
  }, [user])

  const moveCategory = useCallback(async (id, direction) => {
    const idx = categories.findIndex(c => c.id === id)
    if (idx === -1) return
    const type = categories[idx].type
    const sameTypeIndices = categories.map((c, i) => i).filter(i => categories[i].type === type)
    const posInGroup = sameTypeIndices.indexOf(idx)
    const targetPos = direction === 'up' ? posInGroup - 1 : posInGroup + 1
    if (targetPos < 0 || targetPos >= sameTypeIndices.length) return
    const targetIdx = sameTypeIndices[targetPos]

    const next = [...categories]
    ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
    setCategories(next) // optimistic

    // Persist all sort_orders for this type group to keep them consistent
    await Promise.all(
      next
        .filter(c => c.type === type)
        .map((c, i) => supabase.from('categories').update({ sort_order: i })
          .eq('id', c.id).eq('user_id', user.id)) // defense-in-depth
    )
  }, [user, categories])

  const moveSubcategory = useCallback(async (categoryId, fromSubId, toSubId) => {
    setCategories(prev => prev.map(c => {
      if (c.id !== categoryId) return c
      const subs = [...c.subcategories]
      const fromIdx = subs.findIndex(s => s.id === fromSubId)
      const toIdx = subs.findIndex(s => s.id === toSubId)
      if (fromIdx === -1 || toIdx === -1) return c
      const [item] = subs.splice(fromIdx, 1)
      subs.splice(toIdx, 0, item)
      // Fire-and-forget sort_order updates for all subs in the new order
      subs.forEach((s, i) =>
        supabase.from('subcategories').update({ sort_order: i })
          .eq('id', s.id).eq('user_id', user.id) // defense-in-depth
      )
      return { ...c, subcategories: subs }
    }))
  }, [user])

  // ── Clear month data ──────────────────────────────────────────────────────────

  const clearMonthData = useCallback(async (monthKey) => {
    // Deletes all transactions and budget plans for a single month.
    // transaction_splits cascade-delete from the DB schema.
    await supabase.from('transactions').delete()
      .eq('user_id', user.id)
      .like('date', `${monthKey}%`)
    setTransactions(prev => prev.filter(t => !t.date?.startsWith(monthKey)))

    await supabase.from('budget_plans').delete()
      .eq('user_id', user.id)
      .eq('month_key', monthKey)
    setBudgets(prev => { const next = { ...prev }; delete next[monthKey]; return next })

    await supabase.from('paycheck_plans').delete()
      .eq('user_id', user.id)
      .eq('month_key', monthKey)
    setPaycheckPlans(prev => prev.filter(p => p.monthKey !== monthKey))
  }, [user])

  // ── Clear all user data (for account deletion) ────────────────────────────────

  const clearAllData = useCallback(async () => {
    // Deleting categories cascades to subcategories and budget_plans.
    // Deleting transactions cascades to transaction_splits.
    await Promise.all([
      supabase.from('transactions').delete().eq('user_id', user.id),
      supabase.from('categories').delete().eq('user_id', user.id),
      supabase.from('recurring_rules').delete().eq('user_id', user.id),
      supabase.from('paycheck_plans').delete().eq('user_id', user.id),
    ])
    setCategories([])
    setTransactions([])
    setBudgets({})
    setRecurringRules([])
    setPaycheckPlans([])
  }, [user])

  // ── Import all data (for Settings restore) ────────────────────────────────────

  const importAllData = useCallback(async (backup) => {
    // Delete everything for this user; subcategories + budget_plans cascade from categories
    await Promise.all([
      supabase.from('transactions').delete().eq('user_id', user.id),
      supabase.from('categories').delete().eq('user_id', user.id),
    ])

    // Insert categories
    const catInserts = (backup.categories ?? []).map((c, i) => ({
      id: c.id, user_id: user.id, name: c.name, type: c.type,
      color: c.color ?? '#6366f1', sort_order: i,
    }))
    if (catInserts.length > 0) {
      await supabase.from('categories').insert(catInserts)
    }

    // Insert subcategories
    const subInserts = (backup.categories ?? []).flatMap((c, _ci) =>
      (c.subcategories ?? []).map((s, si) => ({
        id: s.id, category_id: c.id, user_id: user.id, name: s.name, sort_order: si,
      }))
    )
    if (subInserts.length > 0) {
      await supabase.from('subcategories').insert(subInserts)
    }

    // Insert flat (non-split) transactions
    const flatTxns = (backup.transactions ?? []).filter(t => !t.splits)
    if (flatTxns.length > 0) {
      await supabase.from('transactions').insert(flatTxns.map(t => ({
        id: t.id, user_id: user.id, date: t.date, amount: t.amount, type: t.type,
        merchant: t.merchant || null, notes: t.notes || null,
        is_split: false, category_id: t.categoryId, subcategory_id: t.subcategoryId || null,
      })))
    }

    // Insert split transactions sequentially (each needs its splits row after)
    for (const t of (backup.transactions ?? []).filter(t => t.splits)) {
      const { data: txRow } = await supabase
        .from('transactions')
        .insert({
          id: t.id, user_id: user.id, date: t.date, amount: t.amount, type: t.type,
          merchant: t.merchant || null, notes: t.notes || null,
          is_split: true, category_id: null, subcategory_id: null,
        })
        .select().single()

      if (txRow && t.splits?.length > 0) {
        await supabase.from('transaction_splits').insert(
          t.splits.map(s => ({
            transaction_id: txRow.id,
            category_id: s.categoryId,
            subcategory_id: s.subcategoryId || null,
            amount: s.amount,
          }))
        )
      }
    }

    // Insert budget plans
    const planInserts = []
    for (const [monthKey, monthData] of Object.entries(backup.budgets ?? {})) {
      for (const [catId, amt] of Object.entries(monthData.planned ?? {})) {
        planInserts.push({
          user_id: user.id, month_key: monthKey,
          category_id: catId, subcategory_id: null, planned_amount: amt,
        })
      }
      for (const [subId, amt] of Object.entries(monthData.subcategoryPlanned ?? {})) {
        planInserts.push({
          user_id: user.id, month_key: monthKey,
          category_id: null, subcategory_id: subId, planned_amount: amt,
        })
      }
    }
    if (planInserts.length > 0) {
      await supabase.from('budget_plans').insert(planInserts)
    }

    window.location.reload()
  }, [user])

  // ── Derived ───────────────────────────────────────────────────────────────────

  const currentMonthTransactions = useMemo(
    () => transactions.filter(t => t.date?.startsWith(currentMonth)),
    [transactions, currentMonth]
  )

  const currentMonthBudget = useMemo(
    () => budgets[currentMonth] ?? { planned: {}, subcategoryPlanned: {} },
    [budgets, currentMonth]
  )

  const currentMonthPaycheckPlans = useMemo(
    () => paycheckPlans.filter(p => p.monthKey === currentMonth),
    [paycheckPlans, currentMonth]
  )

  const value = useMemo(() => ({
    currentMonth,
    setCurrentMonth,
    categories,
    transactions,
    currentMonthTransactions,
    budgets,
    currentMonthBudget,
    loading,
    theme,
    setTheme,
    isDark,
    recurringRules,
    paycheckPlans,
    currentMonthPaycheckPlans,
    addPaycheckPlan,
    updatePaycheckPlan,
    deletePaycheckPlan,
    refreshTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    confirmTransaction,
    addRecurringRule,
    updateRecurringRule,
    pauseRecurringRule,
    deleteRecurringRule,
    generateRecurringInstances,
    setBudgetAmount,
    getMonthBudget,
    addCategory,
    updateCategory,
    deleteCategory,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory,
    moveCategory,
    resetMonthBudget,
    setSubcategoryBudgetAmount,
    copyBudget,
    moveSubcategory,
    importAllData,
    clearMonthData,
    clearAllData,
  }), [
    currentMonth, setCurrentMonth,
    categories, transactions, currentMonthTransactions,
    budgets, currentMonthBudget, loading,
    theme, setTheme, isDark,
    recurringRules, paycheckPlans, currentMonthPaycheckPlans,
    addPaycheckPlan, updatePaycheckPlan, deletePaycheckPlan,
    refreshTransactions,
    addTransaction, updateTransaction, deleteTransaction, confirmTransaction,
    addRecurringRule, updateRecurringRule, pauseRecurringRule, deleteRecurringRule, generateRecurringInstances,
    setBudgetAmount, getMonthBudget,
    resetMonthBudget, setSubcategoryBudgetAmount, copyBudget, moveSubcategory,
    addCategory, updateCategory, deleteCategory,
    addSubcategory, updateSubcategory, deleteSubcategory,
    moveCategory, importAllData, clearMonthData, clearAllData,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
