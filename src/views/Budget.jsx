import { useState, useMemo } from 'react'
import { RotateCcw, Check, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatCurrency, formatMonthLabel } from '../utils/formatters'
import { disabledCls, readOnlyProps } from '../components/common/ReadOnly'
import {
  getCategoryPlanned,
  getSubcategoryPlanned,
  getCategoryEffectivePlanned,
  getTotalPlannedByType,
  getUnbudgetedAmount,
} from '../utils/budgetUtils'
import BudgetEmptyState from '../components/budget/BudgetEmptyState'

// Width of the amount column. Narrow on mobile so category and subcategory names
// keep enough room to sit on one line; roomier once there is space for it.
const AMOUNT_COL = 'w-24 sm:w-32'

// ── Inline-editable amount input (shared pattern) ─────────────────────────────

function AmountInput({ value: planned, onUpdate, readOnly, inputClass = '', displayClass = '' }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const commit = () => {
    const num = Math.max(0, parseFloat(value) || 0)
    onUpdate(num)
    setEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur()
    if (e.key === 'Escape') { setEditing(false) }
  }

  if (editing && !readOnly) {
    return (
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`${AMOUNT_COL} flex-shrink-0 text-right text-sm border border-indigo-400 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${inputClass}`}
      />
    )
  }

  // Read-only accounts show the same figure without the affordance to edit it
  if (readOnly) {
    return (
      <span className={`${AMOUNT_COL} flex-shrink-0 text-right text-sm px-2 py-1 whitespace-nowrap tabular-nums ${displayClass}`}>
        {planned > 0
          ? <span className="text-slate-700 dark:text-slate-300">{formatCurrency(planned)}</span>
          : <span className="text-slate-300 dark:text-slate-600">—</span>
        }
      </span>
    )
  }

  return (
    <button
      onClick={() => { setEditing(true); setValue(planned > 0 ? planned.toFixed(2) : '') }}
      className={`${AMOUNT_COL} flex-shrink-0 text-right text-sm px-2 py-1 rounded-lg whitespace-nowrap tabular-nums hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${displayClass}`}
    >
      {planned > 0
        ? <span className="text-slate-700 dark:text-slate-300">{formatCurrency(planned)}</span>
        : <span className="text-slate-300 dark:text-slate-600 italic">Set</span>
      }
    </button>
  )
}

// ── Inline name editor (shared between category and subcategory rows) ──────────

function InlineNameInput({ value, onCommit, onCancel, className = '' }) {
  const [draft, setDraft] = useState(value)

  const commit = () => {
    const trimmed = draft.trim()
    onCommit(trimmed || value)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit() }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <>
      <input
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        className={`flex-1 min-w-0 text-sm border border-indigo-300 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-indigo-200 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${className}`}
      />
      <button
        type="button"
        onMouseDown={e => e.preventDefault()} // keep focus on input
        onClick={commit}
        className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex-shrink-0 transition-colors"
        title="Save"
      >
        <Check size={13} />
      </button>
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={onCancel}
        className="p-1.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex-shrink-0 transition-colors"
        title="Cancel"
      >
        <X size={13} />
      </button>
    </>
  )
}

// ── Subcategory row with editable name + editable amount ──────────────────────

function SubcategoryBudgetRow({ categoryId, subcategory, planned, onUpdate, readOnly }) {
  const { updateSubcategory } = useApp()
  const [nameEditing, setNameEditing] = useState(false)

  const startNameEdit = () => { if (!readOnly) setNameEditing(true) }

  const commitName = (trimmed) => {
    if (trimmed && trimmed !== subcategory.name) {
      updateSubcategory(categoryId, subcategory.id, trimmed)
    }
    setNameEditing(false)
  }

  return (
    <div className="flex items-center py-2 pl-4 sm:pl-7 border-b border-slate-50 dark:border-slate-700 last:border-0 gap-2">
      {/* Left: dot + name (or name input) */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
        {nameEditing ? (
          <InlineNameInput
            value={subcategory.name}
            onCommit={commitName}
            onCancel={() => setNameEditing(false)}
          />
        ) : (
          <span
            className="text-sm text-slate-500 dark:text-slate-400 cursor-default select-none truncate"
            onDoubleClick={startNameEdit}
            title={readOnly ? subcategory.name : `${subcategory.name} — double-click to rename`}
          >
            {subcategory.name}
          </span>
        )}
      </div>
      {/* Right: amount input — always visible */}
      {!nameEditing && <AmountInput value={planned} onUpdate={onUpdate} readOnly={readOnly} />}
    </div>
  )
}

// ── Category section: header shows read-only sum, rows show subcategory inputs ─

function CategoryBudgetSection({ category, monthBudget, onUpdateCategory, onUpdateSubcategory, readOnly }) {
  const { updateCategory } = useApp()
  const [nameEditing, setNameEditing] = useState(false)
  const hasSubcategories = category.subcategories.length > 0

  const startNameEdit = () => { if (!readOnly) setNameEditing(true) }

  const commitName = (trimmed) => {
    if (trimmed && trimmed !== category.name) {
      updateCategory(category.id, { name: trimmed, color: category.color })
    }
    setNameEditing(false)
  }

  const nameTitle = readOnly ? category.name : `${category.name} — double-click to rename`

  if (!hasSubcategories) {
    // No subcategories — single-amount row
    return (
      <div className="flex items-center py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0 gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
          {nameEditing ? (
            <InlineNameInput
              value={category.name}
              onCommit={commitName}
              onCancel={() => setNameEditing(false)}
              className="font-medium"
            />
          ) : (
            <span
              className="text-sm text-slate-700 dark:text-slate-300 cursor-default select-none truncate"
              onDoubleClick={startNameEdit}
              title={nameTitle}
            >
              {category.name}
            </span>
          )}
        </div>
        {!nameEditing && (
          <AmountInput
            value={getCategoryPlanned(monthBudget, category.id)}
            onUpdate={onUpdateCategory}
            readOnly={readOnly}
          />
        )}
      </div>
    )
  }

  const total = getCategoryEffectivePlanned(category, monthBudget)

  return (
    <div className="border-b border-slate-100 dark:border-slate-700 last:border-0">
      {/* Category header — name (double-click to rename) + read-only total */}
      <div className="flex items-center py-2.5 gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />
          {nameEditing ? (
            <InlineNameInput
              value={category.name}
              onCommit={commitName}
              onCancel={() => setNameEditing(false)}
              className="font-medium"
            />
          ) : (
            <span
              className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-default select-none truncate"
              onDoubleClick={startNameEdit}
              title={nameTitle}
            >
              {category.name}
            </span>
          )}
        </div>
        {!nameEditing && (
          <span className={`${AMOUNT_COL} flex-shrink-0 text-right text-sm font-semibold text-slate-700 dark:text-slate-300 px-2 whitespace-nowrap tabular-nums`}>
            {total > 0
              ? formatCurrency(total)
              : <span className="text-slate-300 dark:text-slate-600 font-normal">—</span>
            }
          </span>
        )}
      </div>

      {/* Subcategory rows */}
      {category.subcategories.map(sub => (
        <SubcategoryBudgetRow
          key={sub.id}
          categoryId={category.id}
          subcategory={sub}
          planned={getSubcategoryPlanned(monthBudget, sub.id)}
          onUpdate={(amount) => onUpdateSubcategory(sub.id, amount)}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}

// ── Budget (main view) ────────────────────────────────────────────────────────

export default function Budget() {
  const {
    categories, currentMonth, currentMonthBudget, currentMonthTransactions,
    setBudgetAmount, setSubcategoryBudgetAmount, budgets, copyBudget, resetMonthBudget,
    readOnly,
  } = useApp()

  const [bypassEmptyState, setBypassEmptyState] = useState(false)

  // A month is active when it has at least one non-zero planned amount
  const monthHasBudget =
    Object.values(budgets[currentMonth]?.planned ?? {}).some(v => v > 0) ||
    Object.values(budgets[currentMonth]?.subcategoryPlanned ?? {}).some(v => v > 0)
  const monthHasTransactions = currentMonthTransactions.some(t => !t.isPending)
  const isUninitialized = !monthHasBudget && !monthHasTransactions && !bypassEmptyState

  // Nearest months in either direction that have non-zero planned amounts
  const { prevMonth, nextMonth } = useMemo(() => {
    const keysWithData = Object.keys(budgets).filter(k =>
      Object.values(budgets[k]?.planned ?? {}).some(v => v > 0) ||
      Object.values(budgets[k]?.subcategoryPlanned ?? {}).some(v => v > 0)
    )
    const prev = keysWithData.filter(k => k < currentMonth).sort().reverse()[0] ?? null
    const next = keysWithData.filter(k => k > currentMonth).sort()[0] ?? null
    return { prevMonth: prev, nextMonth: next }
  }, [budgets, currentMonth])

  const handleReset = () => {
    if (readOnly) return
    if (window.confirm(`Reset the budget for ${formatMonthLabel(currentMonth)}? All planned amounts will be cleared.`)) {
      resetMonthBudget(currentMonth)
    }
  }

  if (isUninitialized) {
    // A read-only account can't create or copy a budget, so show a plain message
    // rather than a call to action that would do nothing.
    if (readOnly) {
      return (
        <div className="max-w-2xl bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No budget has been set for {formatMonthLabel(currentMonth)}.
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Use the month selector to browse a month with data.
          </p>
        </div>
      )
    }
    return (
      <BudgetEmptyState
        currentMonth={currentMonth}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
        onCopy={(sourceKey) => copyBudget(sourceKey, currentMonth)}
        onScratch={() => setBypassEmptyState(true)}
      />
    )
  }

  const incomeCategories = categories.filter(c => c.type === 'income')
  const expenseCategories = categories.filter(c => c.type === 'expense')

  const plannedIncome = getTotalPlannedByType(categories, currentMonthBudget, 'income')
  const plannedExpenses = getTotalPlannedByType(categories, currentMonthBudget, 'expense')
  const unbudgeted = getUnbudgetedAmount(categories, currentMonthBudget)

  const renderSection = (title, cats) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{title}</h3>
      {cats.map(cat => (
        <CategoryBudgetSection
          key={cat.id}
          category={cat}
          monthBudget={currentMonthBudget}
          onUpdateCategory={(amount) => setBudgetAmount(currentMonth, cat.id, amount)}
          onUpdateSubcategory={(subId, amount) => setSubcategoryBudgetAmount(currentMonth, subId, amount)}
          readOnly={readOnly}
        />
      ))}
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Monthly summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monthly Plan</h3>
          <button
            onClick={handleReset}
            disabled={readOnly}
            {...readOnlyProps(readOnly, 'Reset month budget')}
            className={`flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 ${disabledCls}`}
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-400 min-w-0 truncate">Planned income</span>
            <span className="font-semibold text-emerald-600 whitespace-nowrap tabular-nums">{formatCurrency(plannedIncome)}</span>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-400 min-w-0 truncate">Planned expenses</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap tabular-nums">{formatCurrency(plannedExpenses)}</span>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-700 pt-2.5 flex justify-between gap-3 text-sm font-semibold">
            <span className="text-slate-700 dark:text-slate-300 min-w-0 truncate">Unbudgeted</span>
            <span className={`whitespace-nowrap tabular-nums ${
              Math.abs(unbudgeted) < 0.01
                ? 'text-emerald-600'
                : unbudgeted < 0
                  ? 'text-red-500'
                  : 'text-amber-500'
            }`}>
              {formatCurrency(unbudgeted)}
            </span>
          </div>
        </div>
        {Math.abs(unbudgeted) < 0.01 && plannedIncome > 0 && (
          <p className="mt-3 text-xs text-emerald-600 font-medium">Every dollar is assigned.</p>
        )}
      </div>

      {renderSection('Income', incomeCategories)}
      {renderSection('Expenses', expenseCategories)}
    </div>
  )
}
