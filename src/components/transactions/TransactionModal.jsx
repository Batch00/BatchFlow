import { useState, useEffect, useRef, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { X, ChevronDown, Check, Search, RefreshCw } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { getTodayString } from '../../utils/formatters'
import { FREQUENCY_LABELS } from '../../utils/recurringUtils'
import {
  getSubcategoryPlanned,
  getSubcategorySpent,
  getCategoryEffectivePlanned,
  getCategorySpent,
} from '../../utils/budgetUtils'

let _splitIdCounter = 0
const newSplitId = () => `split-${++_splitIdCounter}`

const emptyForm = () => ({
  amount: '',
  date: getTodayString(),
  merchant: '',
  notes: '',
  splits: [],
})

const emptyRecurring = () => ({
  label: '',
  frequency: 'monthly',
  startDate: '',
  endDate: '',
})

export default function TransactionModal({ isOpen, onClose, editingTransaction = null }) {
  const {
    categories,
    transactions,
    recurringRules,
    addTransaction,
    updateTransaction,
    addRecurringRule,
    updateRecurringRule,
    currentMonthTransactions,
    currentMonthBudget,
    currentMonth,
  } = useApp()

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [merchantFocused, setMerchantFocused] = useState(false)

  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringForm, setRecurringForm] = useState(emptyRecurring)
  const [recurringErrors, setRecurringErrors] = useState({})

  // Ref for the scrollable picker panel - used to preserve scroll position
  const pickerScrollRef = useRef(null)

  // Unique merchant names derived from all past transactions, preserving recency order
  const merchantOptions = useMemo(() => {
    const seen = new Set()
    const result = []
    for (const t of transactions) {
      if (t.merchant && !seen.has(t.merchant)) {
        seen.add(t.merchant)
        result.push(t.merchant)
      }
    }
    return result
  }, [transactions])

  // Suggestions matching current merchant input
  const merchantSuggestions = useMemo(() => {
    const val = form.merchant.trim()
    if (!val || !merchantFocused) return []
    const q = val.toLowerCase()
    return merchantOptions
      .filter(m => m.toLowerCase().includes(q) && m !== form.merchant)
      .slice(0, 6)
  }, [form.merchant, merchantFocused, merchantOptions])

  // Populate form when modal opens
  useEffect(() => {
    if (!isOpen) return
    if (editingTransaction) {
      if (editingTransaction.splits) {
        setForm({
          amount: String(editingTransaction.amount),
          date: editingTransaction.date,
          merchant: editingTransaction.merchant ?? '',
          notes: editingTransaction.notes ?? '',
          splits: editingTransaction.splits.map(s => ({
            id: newSplitId(),
            categoryId: s.categoryId,
            subcategoryId: s.subcategoryId ?? '',
            amount: String(s.amount),
          })),
        })
      } else {
        setForm({
          amount: String(editingTransaction.amount),
          date: editingTransaction.date,
          merchant: editingTransaction.merchant ?? '',
          notes: editingTransaction.notes ?? '',
          splits: [{
            id: newSplitId(),
            categoryId: editingTransaction.categoryId ?? '',
            subcategoryId: editingTransaction.subcategoryId ?? '',
            amount: String(editingTransaction.amount),
          }],
        })
      }

      // Pre-fill recurring section if this transaction is linked to a rule
      const ruleId = editingTransaction.recurringRuleId
      const rule = ruleId ? recurringRules.find(r => r.id === ruleId) : null
      if (rule) {
        setIsRecurring(true)
        setRecurringForm({
          label: rule.label,
          frequency: rule.frequency,
          startDate: rule.startDate,
          endDate: rule.endDate ?? '',
        })
      } else {
        setIsRecurring(false)
        setRecurringForm(emptyRecurring())
      }
    } else {
      // Default date to today if it falls within the viewed month; otherwise use the 1st of that month.
      const todayStr = getTodayString()
      const defaultDate = todayStr.startsWith(currentMonth) ? todayStr : `${currentMonth}-01`
      setForm({ ...emptyForm(), date: defaultDate })
      setIsRecurring(false)
      setRecurringForm(emptyRecurring())
    }
    setErrors({})
    setRecurringErrors({})
    setPickerOpen(false)
    setPickerSearch('')
  }, [isOpen, editingTransaction]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive the locked type from the first split that has a category selected
  const lockedType = (() => {
    for (const s of form.splits) {
      const cat = categories.find(c => c.id === s.categoryId)
      if (cat) return cat.type
    }
    return null
  })()

  // Recurring toggle is only available for simple (non-split) transactions
  const canBeRecurring = form.splits.length <= 1

  // Base transactions excluding the editing transaction (for accurate "remaining budget" display)
  const baseTransactions = editingTransaction
    ? currentMonthTransactions.filter(t => t.id !== editingTransaction.id)
    : currentMonthTransactions

  const totalAmount = parseFloat(form.amount) || 0
  const assignedAmount = form.splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const remaining = parseFloat((totalAmount - assignedAmount).toFixed(2))

  // Update top-level field (amount, date, merchant, notes)
  const setField = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-sync: when total amount changes with exactly 1 split row, update that row's amount
      if (field === 'amount' && prev.splits.length === 1) {
        next.splits = [{ ...prev.splits[0], amount: value }]
      }
      return next
    })
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }))
  }

  // Format a raw amount string to two decimal places on blur (e.g. "50" -> "50.00")
  const formatAmountOnBlur = (value, setter) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0) setter(num.toFixed(2))
  }

  // Update the amount field on a specific split row
  const setSplitAmount = (id, value) => {
    setForm(prev => ({
      ...prev,
      splits: prev.splits.map(s => s.id !== id ? s : { ...s, amount: value }),
    }))
    if (errors.splits) setErrors(prev => ({ ...prev, splits: null }))
  }

  // Remove a split row (also deselects it in the picker)
  const removeSplit = (id) => {
    setForm(prev => ({ ...prev, splits: prev.splits.filter(s => s.id !== id) }))
  }

  // ── Picker helpers ─────────────────────────────────────────────────────────

  const isSubSelected = (catId, subId) =>
    form.splits.some(s => s.categoryId === catId && s.subcategoryId === subId)

  const isCatSelected = (catId) =>
    form.splits.some(s => s.categoryId === catId && !s.subcategoryId)

  // Amount to pre-fill when selecting a new item
  const prefillAmount = () => {
    const pre = Math.max(0, remaining)
    return pre > 0 ? String(pre) : ''
  }

  // Use flushSync so the DOM is fully updated before we restore scroll,
  // preventing the jump on first selection.
  const withScrollPreserved = (fn) => {
    const scrollTop = pickerScrollRef.current?.scrollTop ?? 0
    flushSync(fn)
    if (pickerScrollRef.current) pickerScrollRef.current.scrollTop = scrollTop
  }

  const toggleSubItem = (catId, subId) => {
    withScrollPreserved(() => {
      if (errors.splits) setErrors(prev => ({ ...prev, splits: null }))
      if (isSubSelected(catId, subId)) {
        setForm(prev => ({
          ...prev,
          splits: prev.splits.filter(s => !(s.categoryId === catId && s.subcategoryId === subId)),
        }))
      } else {
        setForm(prev => ({
          ...prev,
          splits: [...prev.splits, {
            id: newSplitId(),
            categoryId: catId,
            subcategoryId: subId,
            amount: prefillAmount(),
          }],
        }))
      }
    })
  }

  const toggleCatItem = (catId) => {
    withScrollPreserved(() => {
      if (errors.splits) setErrors(prev => ({ ...prev, splits: null }))
      if (isCatSelected(catId)) {
        setForm(prev => ({
          ...prev,
          splits: prev.splits.filter(s => !(s.categoryId === catId && !s.subcategoryId)),
        }))
      } else {
        setForm(prev => ({
          ...prev,
          splits: [...prev.splits, {
            id: newSplitId(),
            categoryId: catId,
            subcategoryId: '',
            amount: prefillAmount(),
          }],
        }))
      }
    })
  }

  // ── Budget remaining calculations ─────────────────────────────────────────

  const getSubRemainingDisplay = (subId) => {
    const planned = getSubcategoryPlanned(currentMonthBudget, subId)
    if (!planned) return null
    const spent = getSubcategorySpent(baseTransactions, subId)
    const formAssigned = form.splits
      .filter(s => s.subcategoryId === subId)
      .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
    return planned - spent - formAssigned
  }

  const getCatRemainingDisplay = (cat) => {
    const planned = getCategoryEffectivePlanned(cat, currentMonthBudget)
    if (!planned) return null
    const spent = getCategorySpent(baseTransactions, cat.id)
    const formAssigned = form.splits
      .filter(s => s.categoryId === cat.id && !s.subcategoryId)
      .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
    return planned - spent - formAssigned
  }

  const formatBudgetRemaining = (val) => {
    if (val === null) return null
    const abs = Math.abs(val).toFixed(2)
    return val < 0 ? `-$${abs}` : `$${abs}`
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = () => {
    const errs = {}
    const amt = parseFloat(form.amount)
    if (!form.amount || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount'
    if (form.splits.length === 0) errs.splits = 'Select at least one budget item'
    if (form.splits.some(s => !s.categoryId)) errs.splits = 'Every row needs a category'
    if (!errs.amount && Math.abs(remaining) >= 0.01) {
      errs.splits = remaining > 0
        ? `$${remaining.toFixed(2)} still unassigned`
        : `Over-assigned by $${Math.abs(remaining).toFixed(2)}`
    }
    return errs
  }

  const validateRecurring = () => {
    const errs = {}
    if (!recurringForm.label.trim()) errs.label = 'Label is required'
    if (!recurringForm.startDate) errs.startDate = 'Start date is required'
    if (recurringForm.endDate && recurringForm.endDate < recurringForm.startDate) {
      errs.endDate = 'End date must be after start date'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    const recErrs = isRecurring && canBeRecurring ? validateRecurring() : {}
    if (Object.keys(errs).length > 0 || Object.keys(recErrs).length > 0) {
      setErrors(errs)
      setRecurringErrors(recErrs)
      return
    }

    const totalAmt = parseFloat(form.amount)
    const type = lockedType ?? 'expense'

    let payload
    if (form.splits.length === 1) {
      // Backward-compatible flat format
      const s = form.splits[0]
      const cat = categories.find(c => c.id === s.categoryId)
      payload = {
        amount: totalAmt,
        date: form.date,
        type: cat?.type ?? type,
        categoryId: s.categoryId,
        subcategoryId: s.subcategoryId || null,
        merchant: form.merchant.trim() || null,
        notes: form.notes.trim() || null,
      }
    } else {
      payload = {
        amount: totalAmt,
        date: form.date,
        type,
        categoryId: null,
        subcategoryId: null,
        merchant: form.merchant.trim() || null,
        notes: form.notes.trim() || null,
        splits: form.splits.map(s => ({
          categoryId: s.categoryId,
          subcategoryId: s.subcategoryId || null,
          amount: parseFloat(s.amount),
        })),
      }
    }

    // Handle recurring rule create / update / detach
    if (isRecurring && canBeRecurring) {
      const singleSplit = form.splits[0]
      const cat = categories.find(c => c.id === singleSplit?.categoryId)
      const ruleData = {
        label: recurringForm.label.trim(),
        frequency: recurringForm.frequency,
        startDate: recurringForm.startDate || form.date,
        endDate: recurringForm.endDate || null,
        amount: totalAmt,
        type: cat?.type ?? type,
        merchant: form.merchant.trim() || null,
        notes: form.notes.trim() || null,
        categoryId: singleSplit?.categoryId || null,
        subcategoryId: singleSplit?.subcategoryId || null,
      }

      const existingRuleId = editingTransaction?.recurringRuleId
      if (existingRuleId) {
        // Update the existing rule
        await updateRecurringRule(existingRuleId, ruleData)
        payload.recurringRuleId = existingRuleId
      } else {
        // Create a new rule and link this transaction to it
        const newRule = await addRecurringRule(ruleData)
        payload.recurringRuleId = newRule?.id ?? null
        payload.scheduledDate = form.date
        payload.isPending = false
      }
    } else if (!isRecurring && editingTransaction?.recurringRuleId) {
      // User turned off recurring — detach this instance from the rule
      payload.recurringRuleId = null
    }

    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, payload)
    } else {
      await addTransaction(payload)
    }
    onClose()
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  // All hooks must be called before any conditional return. The early-exit
  // for isOpen===false lives just before the JSX return, after all hooks and
  // derived values are computed.

  const remainingColor =
    Math.abs(remaining) < 0.01
      ? 'text-emerald-600'
      : remaining < 0
      ? 'text-red-500'
      : 'text-amber-500'

  // Only show categories matching the locked type (or all if none locked yet)
  const visibleCategories = lockedType
    ? categories.filter(c => c.type === lockedType)
    : categories

  // Real-time search filter: matches on category name or subcategory name
  const searchFilteredCategories = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return visibleCategories
    return visibleCategories.reduce((acc, cat) => {
      const catMatch = cat.name.toLowerCase().includes(q)
      if (cat.subcategories.length === 0) {
        if (catMatch) acc.push(cat)
      } else {
        const subs = catMatch
          ? cat.subcategories
          : cat.subcategories.filter(s => s.name.toLowerCase().includes(q))
        if (subs.length > 0) acc.push({ ...cat, subcategories: subs })
      }
      return acc
    }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCategories, pickerSearch])

  const incomeFiltered = searchFilteredCategories.filter(c => c.type === 'income')
  const expenseFiltered = searchFilteredCategories.filter(c => c.type === 'expense')

  // Trigger button label
  const selectedLabels = form.splits.map(s => {
    const cat = categories.find(c => c.id === s.categoryId)
    if (!cat) return null
    const sub = cat.subcategories.find(sub => sub.id === s.subcategoryId)
    return sub?.name ?? cat.name
  }).filter(Boolean)

  const triggerLabel = selectedLabels.length === 0
    ? null
    : selectedLabels.length <= 2
    ? selectedLabels.join(', ')
    : `${selectedLabels.length} items selected`

  // Render a single selectable row (subcategory or standalone category).
  const renderPickerRow = ({ key, catId, subId, name, rem, isSelected, toggleFn, indent }) => {
    const existingSplit = isSelected
      ? form.splits.find(s => s.categoryId === catId && (subId ? s.subcategoryId === subId : !s.subcategoryId))
      : null
    const remStr = formatBudgetRemaining(rem)
    return (
      <div
        key={key}
        className={`flex items-center gap-2 ${indent} py-2 text-sm transition-colors ${
          isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
        }`}
      >
        {/* Checkbox + name */}
        <button
          type="button"
          onClick={toggleFn}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
          }`}>
            {isSelected && <Check size={10} className="text-white" />}
          </span>
          <span className={`flex-1 truncate ${
            isSelected ? 'text-indigo-700 dark:text-indigo-400 font-medium' : `text-slate-700 dark:text-slate-300${!subId ? ' font-medium' : ''}`
          }`}>
            {name}
          </span>
        </button>

        {/* Right side: amount input when selected, budget remaining when not */}
        {isSelected && existingSplit ? (
          <>
            <div className="relative w-20 flex-shrink-0">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs select-none">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={existingSplit.amount}
                onChange={e => setSplitAmount(existingSplit.id, e.target.value)}
                onBlur={() => formatAmountOnBlur(existingSplit.amount, v => setSplitAmount(existingSplit.id, v))}
                className="w-full pl-5 pr-1 py-1 text-xs border border-indigo-200 dark:border-indigo-700 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
            <button
              type="button"
              onClick={() => removeSplit(existingSplit.id)}
              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          remStr !== null && (
            <span className={`text-xs tabular-nums flex-shrink-0 ${rem < 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {remStr}
            </span>
          )
        )}
      </div>
    )
  }

  // Render one group of categories (income or expense)
  const renderCategoryGroup = (cats) =>
    cats.map(cat => (
      <div key={cat.id}>
        {cat.subcategories.length > 0 ? (
          <>
            <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-widest uppercase text-indigo-500 dark:text-indigo-400 select-none">
              {cat.name}
            </div>
            {cat.subcategories.map(sub => renderPickerRow({
              key: sub.id,
              catId: cat.id,
              subId: sub.id,
              name: sub.name,
              rem: getSubRemainingDisplay(sub.id),
              isSelected: isSubSelected(cat.id, sub.id),
              toggleFn: () => toggleSubItem(cat.id, sub.id),
              indent: 'px-4',
            }))}
          </>
        ) : (
          renderPickerRow({
            key: cat.id,
            catId: cat.id,
            subId: null,
            name: cat.name,
            rem: getCatRemainingDisplay(cat),
            isSelected: isCatSelected(cat.id),
            toggleFn: () => toggleCatItem(cat.id),
            indent: 'px-3',
          })
        )}
      </div>
    ))

  const hasPickerError = errors.splits && form.splits.length === 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal card */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl z-10">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Amount + Date — stacked on mobile, side by side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-hidden">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Amount <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setField('amount', e.target.value)}
                  onBlur={() => formatAmountOnBlur(form.amount, v => setField('amount', v))}
                  className={`w-full pl-7 pr-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                    errors.amount
                      ? 'border-red-300 focus:border-red-400'
                      : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
                  }`}
                />
              </div>
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.date}
                onChange={e => setField('date', e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                  errors.date
                    ? 'border-red-300 focus:border-red-400'
                    : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
                }`}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date}</p>}
            </div>
          </div>

          {/* Merchant with autocomplete */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Merchant</label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Target, Netflix..."
                value={form.merchant}
                onChange={e => setField('merchant', e.target.value)}
                onFocus={() => setMerchantFocused(true)}
                onBlur={() => setTimeout(() => setMerchantFocused(false), 150)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              {merchantSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden">
                  {merchantSuggestions.map(m => (
                    <button
                      key={m}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setField('merchant', m); setMerchantFocused(false) }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors border-b border-slate-50 dark:border-slate-600 last:border-0"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Notes</label>
            <input
              type="text"
              placeholder="Optional notes..."
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Budget item picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Budget Item <span className="text-red-400">*</span>
              </label>
              {(form.splits.length > 0 || form.amount) && (
                <span className={`text-xs font-medium ${remainingColor}`}>
                  {Math.abs(remaining) < 0.01
                    ? 'Fully assigned'
                    : remaining > 0
                    ? `$${remaining.toFixed(2)} remaining`
                    : `$${Math.abs(remaining).toFixed(2)} over`}
                </span>
              )}
            </div>

            {/* Picker trigger button */}
            <button
              type="button"
              onClick={() => setPickerOpen(v => !v)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                hasPickerError
                  ? 'border-red-300'
                  : pickerOpen
                  ? 'border-indigo-400 ring-2 ring-indigo-200'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <span className={`truncate ${triggerLabel ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                {triggerLabel ?? 'Choose Budget Item(s)...'}
              </span>
              <ChevronDown
                size={15}
                className={`text-slate-400 flex-shrink-0 ml-2 transition-transform ${pickerOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Picker panel - search bar + scrollable list */}
            {pickerOpen && (
              <div className={`mt-1 border rounded-xl bg-white dark:bg-slate-800 shadow-sm overflow-hidden ${
                hasPickerError ? 'border-red-200' : 'border-slate-200 dark:border-slate-700'
              }`}>
                {/* Search input */}
                <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Search categories..."
                      className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Scrollable category list */}
                <div
                  ref={pickerScrollRef}
                  className="overflow-y-auto"
                  style={{ maxHeight: '192px' }}
                >
                  {searchFilteredCategories.length === 0 && (
                    <p className="px-4 py-3 text-sm text-slate-400 dark:text-slate-500">
                      {pickerSearch ? 'No matches found.' : 'No categories available.'}
                    </p>
                  )}

                  {/* Show type section headers only when both types are visible and unlocked */}
                  {!lockedType && incomeFiltered.length > 0 && expenseFiltered.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-400 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 sticky top-0">
                        Income
                      </div>
                      {renderCategoryGroup(incomeFiltered)}
                      <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-400 bg-slate-50 dark:bg-slate-800 border-t border-b border-slate-100 dark:border-slate-700 sticky top-0">
                        Expenses
                      </div>
                      {renderCategoryGroup(expenseFiltered)}
                    </>
                  )}

                  {/* Single type visible (locked or only one type exists after filtering) */}
                  {(lockedType || incomeFiltered.length === 0 || expenseFiltered.length === 0) && (
                    renderCategoryGroup(searchFilteredCategories)
                  )}
                </div>
              </div>
            )}

            {errors.splits && <p className="text-xs text-red-500 mt-1.5">{errors.splits}</p>}
          </div>

          {/* Recurring toggle — only for single-category transactions */}
          {canBeRecurring && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              {/* Toggle row */}
              <button
                type="button"
                onClick={() => {
                  setIsRecurring(v => !v)
                  setRecurringErrors({})
                  if (!isRecurring && !recurringForm.startDate) {
                    setRecurringForm(prev => ({ ...prev, startDate: form.date || getTodayString() }))
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <RefreshCw size={15} className={isRecurring ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                  <span className={`text-sm font-medium ${isRecurring ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    Make this recurring
                  </span>
                </div>
                {/* Toggle pill */}
                <span className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  isRecurring ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}>
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                    isRecurring ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </span>
              </button>

              {/* Recurring options — shown when toggle is on */}
              {isRecurring && (
                <div className="px-4 py-3 space-y-3 border-t border-slate-200 dark:border-slate-700">
                  {/* Label */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Rule Label <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder='e.g. Netflix, Rent, Salary...'
                      value={recurringForm.label}
                      onChange={e => {
                        setRecurringForm(prev => ({ ...prev, label: e.target.value }))
                        if (recurringErrors.label) setRecurringErrors(prev => ({ ...prev, label: null }))
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                        recurringErrors.label ? 'border-red-300' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
                      }`}
                    />
                    {recurringErrors.label && <p className="text-xs text-red-500 mt-1">{recurringErrors.label}</p>}
                  </div>

                  {/* Frequency */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Frequency</label>
                    <select
                      value={recurringForm.frequency}
                      onChange={e => setRecurringForm(prev => ({ ...prev, frequency: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Start date + End date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                        Start Date <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={recurringForm.startDate}
                        onChange={e => {
                          setRecurringForm(prev => ({ ...prev, startDate: e.target.value }))
                          if (recurringErrors.startDate) setRecurringErrors(prev => ({ ...prev, startDate: null }))
                        }}
                        className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                          recurringErrors.startDate ? 'border-red-300' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
                        }`}
                      />
                      {recurringErrors.startDate && <p className="text-xs text-red-500 mt-1">{recurringErrors.startDate}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                        End Date <span className="text-slate-400">(optional)</span>
                      </label>
                      <input
                        type="date"
                        value={recurringForm.endDate}
                        onChange={e => {
                          setRecurringForm(prev => ({ ...prev, endDate: e.target.value }))
                          if (recurringErrors.endDate) setRecurringErrors(prev => ({ ...prev, endDate: null }))
                        }}
                        className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                          recurringErrors.endDate ? 'border-red-300' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
                        }`}
                      />
                      {recurringErrors.endDate && <p className="text-xs text-red-500 mt-1">{recurringErrors.endDate}</p>}
                    </div>
                  </div>

                  {editingTransaction?.recurringRuleId && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Rule changes apply to future auto-generated instances. This instance is saved independently.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {editingTransaction ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
