import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Pause, Play, RefreshCw, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatSignedCurrency, formatDate, getTodayString } from '../utils/formatters'
import { disabledCls, readOnlyProps } from '../components/common/ReadOnly'
import { FREQUENCY_LABELS, getNextOccurrence } from '../utils/recurringUtils'

// ── Rule form modal ────────────────────────────────────────────────────────────

function RuleModal({ isOpen, onClose, editingRule }) {
  const { categories, addRecurringRule, updateRecurringRule } = useApp()

  const emptyForm = () => ({
    label: '',
    amount: '',
    frequency: 'monthly',
    startDate: getTodayString(),
    endDate: '',
    categoryId: '',
    subcategoryId: '',
    merchant: '',
    notes: '',
  })

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (editingRule) {
      setForm({
        label: editingRule.label,
        amount: String(editingRule.amount),
        frequency: editingRule.frequency,
        startDate: editingRule.startDate,
        endDate: editingRule.endDate ?? '',
        categoryId: editingRule.categoryId ?? '',
        subcategoryId: editingRule.subcategoryId ?? '',
        merchant: editingRule.merchant ?? '',
        notes: editingRule.notes ?? '',
      })
    } else {
      setForm(emptyForm())
    }
    setErrors({})
  }, [isOpen, editingRule]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCategory = categories.find(c => c.id === form.categoryId)
  const availableSubs = selectedCategory?.subcategories ?? []

  const setField = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Clear subcategory when category changes
      if (field === 'categoryId') next.subcategoryId = ''
      return next
    })
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }))
  }

  const validate = () => {
    const errs = {}
    if (!form.label.trim()) errs.label = 'Label is required'
    const amt = parseFloat(form.amount)
    if (!form.amount || isNaN(amt) || amt <= 0) errs.amount = 'Enter a valid amount'
    if (!form.categoryId) errs.categoryId = 'Select a category'
    if (!form.startDate) errs.startDate = 'Start date is required'
    if (form.endDate && form.endDate < form.startDate) errs.endDate = 'End date must be after start date'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSaving(true)
    const ruleData = {
      label: form.label.trim(),
      amount: parseFloat(form.amount),
      type: selectedCategory?.type ?? 'expense',
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate || null,
      categoryId: form.categoryId,
      subcategoryId: form.subcategoryId || null,
      merchant: form.merchant.trim() || null,
      notes: form.notes.trim() || null,
    }

    if (editingRule) {
      await updateRecurringRule(editingRule.id, ruleData)
    } else {
      await addRecurringRule(ruleData)
    }
    setSaving(false)
    onClose()
  }

  if (!isOpen) return null

  // Group categories by type for the dropdown
  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 rounded-t-2xl z-10">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {editingRule ? 'Edit Recurring Rule' : 'Add Recurring Rule'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Label <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Netflix, Rent, Paycheck..."
              value={form.label}
              onChange={e => setField('label', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                errors.label ? 'border-red-300' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
              }`}
            />
            {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label}</p>}
          </div>

          {/* Amount + Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
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
                  onBlur={() => {
                    const num = parseFloat(form.amount)
                    if (!isNaN(num) && num > 0) setField('amount', num.toFixed(2))
                  }}
                  className={`w-full pl-7 pr-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                    errors.amount ? 'border-red-300' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
                  }`}
                />
              </div>
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Frequency</label>
              <select
                value={form.frequency}
                onChange={e => setField('frequency', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              value={form.categoryId}
              onChange={e => setField('categoryId', e.target.value)}
              className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                errors.categoryId ? 'border-red-300' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
              }`}
            >
              <option value="">Select a category...</option>
              {incomeCategories.length > 0 && (
                <optgroup label="Income">
                  {incomeCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {expenseCategories.length > 0 && (
                <optgroup label="Expenses">
                  {expenseCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId}</p>}
          </div>

          {/* Subcategory — only shown when selected category has subcategories */}
          {availableSubs.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Subcategory <span className="text-slate-400">(optional)</span>
              </label>
              <select
                value={form.subcategoryId}
                onChange={e => setField('subcategoryId', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="">None</option>
                {availableSubs.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Start date + End date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Start Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setField('startDate', e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                  errors.startDate ? 'border-red-300' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
                }`}
              />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                End Date <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setField('endDate', e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                  errors.endDate ? 'border-red-300' : 'border-slate-200 dark:border-slate-600 focus:border-indigo-400'
                }`}
              />
              {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate}</p>}
            </div>
          </div>

          {/* Merchant */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Merchant <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Netflix, Landlord..."
              value={form.merchant}
              onChange={e => setField('merchant', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Optional notes..."
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition-colors bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>

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
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingRule ? 'Save Changes' : 'Add Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Meta line — wraps onto as many lines as it needs and never truncates. Each part
// is kept whole so a date or a category never splits across the wrap point.
function MetaLine({ parts, className = '' }) {
  const shown = parts.filter(Boolean)
  if (shown.length === 0) return null
  return (
    <p className={`mt-0.5 text-xs text-slate-400 dark:text-slate-500 leading-snug ${className}`}>
      {shown.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-0.5 text-slate-300 dark:text-slate-600">·</span>}
          {part}
        </span>
      ))}
    </p>
  )
}

// ── Main Recurring view ────────────────────────────────────────────────────────

export default function Recurring() {
  const { recurringRules, categories, transactions, pauseRecurringRule, deleteRecurringRule, readOnly } = useApp()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const getCategoryName = (categoryId) =>
    categories.find(c => c.id === categoryId)?.name ?? 'Unknown'

  const getCategoryColor = (categoryId) =>
    categories.find(c => c.id === categoryId)?.color ?? '#94a3b8'

  const getSubcategoryName = (categoryId, subcategoryId) => {
    if (!subcategoryId) return null
    const cat = categories.find(c => c.id === categoryId)
    return cat?.subcategories.find(s => s.id === subcategoryId)?.name ?? null
  }

  // Count pending instances for a rule (across all months)
  const getPendingCount = (ruleId) =>
    transactions.filter(t => t.recurringRuleId === ruleId && t.isPending).length

  const openAdd = () => {
    if (readOnly) return
    setEditingRule(null)
    setModalOpen(true)
  }

  const openEdit = (rule) => {
    if (readOnly) return
    setEditingRule(rule)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    await deleteRecurringRule(id)
    setConfirmDeleteId(null)
  }

  const sortedRules = [...recurringRules].sort((a, b) => {
    // Paused rules always go to the bottom
    if (a.isPaused !== b.isPaused) return a.isPaused ? 1 : -1
    // Within active rules sort by next occurrence date ascending (most imminent first)
    const aNext = getNextOccurrence(a)
    const bNext = getNextOccurrence(b)
    if (!aNext && !bNext) return a.label.localeCompare(b.label)
    if (!aNext) return 1
    if (!bNext) return -1
    return aNext.localeCompare(bNext)
  })

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Recurring</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {recurringRules.length} rule{recurringRules.length !== 1 ? 's' : ''}
            {recurringRules.filter(r => !r.isPaused).length !== recurringRules.length && (
              <> · {recurringRules.filter(r => r.isPaused).length} paused</>
            )}
          </p>
        </div>
        <button
          onClick={openAdd}
          disabled={readOnly}
          {...readOnlyProps(readOnly, 'Add Rule')}
          className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0 ${disabledCls}`}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Rule</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Empty state */}
      {recurringRules.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 sm:p-12 text-center">
          <RefreshCw size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">No recurring rules yet</p>
          {!readOnly && (
            <>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                Add a rule to automatically generate transactions each month.
              </p>
              <button
                onClick={openAdd}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Add your first rule
              </button>
            </>
          )}
        </div>
      )}

      {/* Rules list */}
      {sortedRules.length > 0 && (
        <div className="space-y-2">
          {sortedRules.map(rule => {
            const catColor = getCategoryColor(rule.categoryId)
            const catName = getCategoryName(rule.categoryId)
            const subName = getSubcategoryName(rule.categoryId, rule.subcategoryId)
            const nextDate = getNextOccurrence(rule)
            const pendingCount = getPendingCount(rule.id)

            return (
              <div
                key={rule.id}
                className={`bg-white dark:bg-slate-800 rounded-xl border transition-colors ${
                  rule.isPaused
                    ? 'border-slate-200 dark:border-slate-700 opacity-60'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3 px-4 sm:px-5 py-3">
                  {/* Color dot — aligned to the label, which is the row's identity,
                      rather than floating beside the middle of the meta text */}
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ backgroundColor: catColor }}
                  />

                  {/* Main info — label on its own line so it always has room, then two
                      meta lines that wrap freely. Nothing here truncates. */}
                  <div className="flex-1 min-w-0">
                    {/* The amount deliberately leads the meta line rather than sitting
                        beside the label: pairing it with the label forces longer labels
                        ("401k Contribution", "Paycheck (15th)") to wrap at 360px, which
                        measured taller overall than letting the amount flow here. */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">
                        {rule.label}
                      </span>
                      {rule.isPaused && (
                        <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex-shrink-0">
                          Paused
                        </span>
                      )}
                    </div>

                    <MetaLine parts={[
                      <span className={`font-medium whitespace-nowrap tabular-nums ${rule.type === 'income' ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
                        {formatSignedCurrency(rule.amount, rule.type)}
                      </span>,
                      <span className="whitespace-nowrap">{FREQUENCY_LABELS[rule.frequency]}</span>,
                      <span>{catName}{subName ? ` · ${subName}` : ''}</span>,
                      // Most rules name the merchant the same as the label; only worth
                      // a slot when it actually says something new.
                      rule.merchant && rule.merchant.toLowerCase() !== rule.label.toLowerCase()
                        ? <span>{rule.merchant}</span>
                        : null,
                    ]} />

                    <MetaLine parts={[
                      nextDate && !rule.isPaused
                        ? <span className="text-indigo-500 dark:text-indigo-400 whitespace-nowrap">Next {formatDate(nextDate)}</span>
                        : null,
                      !nextDate && !rule.isPaused && rule.endDate
                        ? <span className="whitespace-nowrap">Ended</span>
                        : null,
                      <span className="whitespace-nowrap">Starts {formatDate(rule.startDate)}</span>,
                      rule.endDate ? <span className="whitespace-nowrap">Ends {formatDate(rule.endDate)}</span> : null,
                      pendingCount > 0 ? <span className="whitespace-nowrap">{pendingCount} pending</span> : null,
                    ]} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1">
                    <button
                      onClick={() => pauseRecurringRule(rule.id, !rule.isPaused)}
                      disabled={readOnly}
                      {...readOnlyProps(readOnly, rule.isPaused ? 'Resume' : 'Pause')}
                      className={`p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors ${disabledCls}`}
                    >
                      {rule.isPaused ? <Play size={15} /> : <Pause size={15} />}
                    </button>
                    <button
                      onClick={() => openEdit(rule)}
                      disabled={readOnly}
                      {...readOnlyProps(readOnly, 'Edit rule')}
                      className={`p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${disabledCls}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(rule.id)}
                      disabled={readOnly}
                      {...readOnlyProps(readOnly, 'Delete rule')}
                      className={`p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors ${disabledCls}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Delete confirmation inline */}
                {confirmDeleteId === rule.id && (
                  <div className="px-5 pb-4 pt-0">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                      <p className="text-sm text-red-700 dark:text-red-400 font-medium">Delete this rule?</p>
                      <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
                        Pending auto-generated instances will be removed. Confirmed transactions will remain.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Delete Rule
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <RuleModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingRule={editingRule}
      />
    </div>
  )
}
