import { useState, useMemo, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, CheckCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatSignedCurrency, formatDate } from '../utils/formatters'
import { disabledCls, readOnlyProps } from '../components/common/ReadOnly'
import TransactionModal from '../components/transactions/TransactionModal'

// Compute tomorrow's date string (YYYY-MM-DD) to gate pending visibility
function getTomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Pending recurring transactions are hidden until 1 day before their scheduled date
function isVisiblePending(t, tomorrowStr) {
  if (!t.isPending || !t.recurringRuleId) return true
  const scheduledDate = t.scheduledDate || t.date
  return scheduledDate <= tomorrowStr
}

export default function Transactions() {
  const {
    currentMonthTransactions,
    categories,
    deleteTransaction,
    confirmTransaction,
    updateTransaction,
    readOnly,
  } = useApp()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [undoToast, setUndoToast] = useState(null) // { id, timeoutId, snapshot }

  const tomorrowStr = useMemo(() => getTomorrowStr(), [])

  const getCategoryName = (categoryId) =>
    categories.find(c => c.id === categoryId)?.name ?? 'Unknown'

  const getCategoryColor = (categoryId) =>
    categories.find(c => c.id === categoryId)?.color ?? '#94a3b8'

  const getSubcategoryName = (categoryId, subcategoryId) => {
    if (!subcategoryId) return null
    const cat = categories.find(c => c.id === categoryId)
    return cat?.subcategories.find(s => s.id === subcategoryId)?.name ?? null
  }

  const getSplitCategoryColor = (split) =>
    categories.find(c => c.id === split.categoryId)?.color ?? '#94a3b8'

  // Apply visibility filter then split into pending / completed sections
  const visibleTransactions = useMemo(
    () => currentMonthTransactions.filter(t => isVisiblePending(t, tomorrowStr)),
    [currentMonthTransactions, tomorrowStr]
  )

  const pendingList = useMemo(
    () => visibleTransactions.filter(t => t.isPending).sort((a, b) => b.date.localeCompare(a.date)),
    [visibleTransactions]
  )
  const completedList = useMemo(
    () => visibleTransactions.filter(t => !t.isPending).sort((a, b) => b.date.localeCompare(a.date)),
    [visibleTransactions]
  )

  // Clear undo toast on unmount
  useEffect(() => {
    return () => {
      if (undoToast) clearTimeout(undoToast.timeoutId)
    }
  }, [undoToast])

  const openAdd = () => {
    if (readOnly) return
    setEditingTransaction(null)
    setModalOpen(true)
  }

  const openEdit = (transaction) => {
    if (readOnly) return
    setEditingTransaction(transaction)
    setModalOpen(true)
  }

  const handleDelete = (id) => {
    if (readOnly) return
    if (window.confirm('Delete this transaction?')) {
      deleteTransaction(id)
    }
  }

  const handleConfirm = useCallback((id) => {
    if (readOnly) return
    // Snapshot the transaction before confirming so undo can revert it
    const snapshot = currentMonthTransactions.find(t => t.id === id)
    confirmTransaction(id)

    // Clear any existing undo toast
    if (undoToast) clearTimeout(undoToast.timeoutId)

    const timeoutId = setTimeout(() => setUndoToast(null), 5000)
    setUndoToast({ id, timeoutId, snapshot })
  }, [currentMonthTransactions, confirmTransaction, undoToast, readOnly])

  const handleUndo = useCallback(() => {
    if (!undoToast) return
    clearTimeout(undoToast.timeoutId)
    const { snapshot } = undoToast
    // Revert the transaction back to pending
    updateTransaction(snapshot.id, { ...snapshot, isPending: true })
    setUndoToast(null)
  }, [undoToast, updateTransaction])

  // Row action buttons — one inline column on the right at every width. Tap targets
  // stay ~32px on touch via p-2; the icons themselves are small so the column costs
  // little horizontal room, which is what lets the row stay a single block.
  function RowActions({ t, className = '' }) {
    return (
      <div className={`flex items-center gap-0.5 flex-shrink-0 -mr-1 ${className}`}>
        {t.isPending && (
          <button
            onClick={() => handleConfirm(t.id)}
            disabled={readOnly}
            {...readOnlyProps(readOnly, 'Mark as confirmed')}
            className={`p-2 sm:p-1.5 rounded-lg text-amber-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors ${disabledCls}`}
          >
            <CheckCircle size={15} />
          </button>
        )}
        <button
          onClick={() => openEdit(t)}
          disabled={readOnly}
          {...readOnlyProps(readOnly, 'Edit')}
          className={`p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors ${disabledCls}`}
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => handleDelete(t.id)}
          disabled={readOnly}
          {...readOnlyProps(readOnly, 'Delete')}
          className={`p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${disabledCls}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    )
  }

  // Meta line — category, date and notes. Allowed to wrap onto as many lines as it
  // needs; the date is kept whole so it is never the thing that gets clipped.
  function MetaLine({ parts }) {
    return (
      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 leading-snug">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-0.5 text-slate-300 dark:text-slate-600">·</span>}
            {part}
          </span>
        ))}
      </p>
    )
  }

  // Render a single transaction row (shared between pending and completed sections)
  function renderTransaction(t) {
    const isSplit = Boolean(t.splits)
    const color = isSplit ? getSplitCategoryColor(t.splits[0]) : getCategoryColor(t.categoryId)
    const subName = isSplit ? null : getSubcategoryName(t.categoryId, t.subcategoryId)

    const metaParts = []
    if (isSplit) {
      metaParts.push(`${t.splits.length} categories`)
    } else {
      metaParts.push(subName
        ? `${getCategoryName(t.categoryId)} · ${subName}`
        : getCategoryName(t.categoryId))
    }
    metaParts.push(<span className="whitespace-nowrap">{formatDate(t.date)}</span>)
    if (t.notes) metaParts.push(<span className="italic">{t.notes}</span>)

    return (
      <div key={t.id} className={t.isPending ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
        <div className="group px-4 sm:px-5 py-2.5 sm:py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
          <div className="flex items-center gap-3 sm:gap-3.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />

            <div className="flex-1 min-w-0">
              {/* Title + amount share one line; the amount never wraps or shrinks */}
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {t.merchant || (isSplit ? 'Split Transaction' : getCategoryName(t.categoryId))}
                  </span>
                  {isSplit && (
                    <span className="flex-shrink-0 text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                      Split
                    </span>
                  )}
                  {t.recurringRuleId && (
                    <RefreshCw size={11} className="flex-shrink-0 text-slate-400" />
                  )}
                </span>
                <span className={`text-sm font-semibold flex-shrink-0 tabular-nums whitespace-nowrap ${
                  t.type === 'income' ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-100'
                }`}>
                  {formatSignedCurrency(t.amount, t.type)}
                </span>
              </div>

              <MetaLine parts={metaParts} />
            </div>

            {/* Actions stay inline at every width. On pointer devices they fade in on
                hover; on touch there is no hover, so they are always visible. */}
            <RowActions
              t={t}
              className={t.isPending ? '' : 'sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity'}
            />
          </div>
        </div>

        {/* Split sub-rows */}
        {isSplit && t.splits.map((split, idx) => {
          const isLast = idx === t.splits.length - 1
          const splitSub = getSubcategoryName(split.categoryId, split.subcategoryId)
          return (
            <div
              key={idx}
              className="flex items-start gap-2.5 sm:gap-3.5 pl-7 sm:pl-10 pr-4 sm:pr-5 py-2 bg-slate-50/60 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700"
            >
              <span className="text-slate-300 dark:text-slate-600 text-xs flex-shrink-0 select-none leading-5">
                {isLast ? '└' : '├'}
              </span>
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                style={{ backgroundColor: getSplitCategoryColor(split) }}
              />
              <p className="flex-1 min-w-0 text-xs text-slate-500 dark:text-slate-400 leading-5">
                {getCategoryName(split.categoryId)}
                {splitSub && <> · {splitSub}</>}
              </p>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex-shrink-0 tabular-nums whitespace-nowrap leading-5">
                {formatSignedCurrency(split.amount, t.type)}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const totalVisible = pendingList.length + completedList.length

  return (
    <div className="space-y-4 max-w-3xl pb-24">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {totalVisible} transaction{totalVisible !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openAdd}
          disabled={readOnly}
          {...readOnlyProps(readOnly, 'Add Transaction')}
          className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex-shrink-0 ${disabledCls}`}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Transaction</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Empty state */}
      {totalVisible === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 sm:p-12 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm">No transactions yet for this month.</p>
          {!readOnly && (
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Click "Add Transaction" to get started.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending section */}
          {pendingList.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 px-1">
                Pending
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/60 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                {pendingList.map(t => renderTransaction(t))}
              </div>
            </div>
          )}

          {/* Completed section */}
          {completedList.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">
                Completed
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                {completedList.map(t => renderTransaction(t))}
              </div>
            </div>
          )}
        </div>
      )}

      <TransactionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingTransaction={editingTransaction}
      />

      {/* FAB — fixed to viewport bottom-right */}
      {!readOnly && (
        <button
          onClick={openAdd}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors flex items-center justify-center"
          title="Add Transaction"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Undo confirm toast */}
      {undoToast && (
        <div className="fixed bottom-24 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 flex items-center justify-center gap-3 bg-slate-800 dark:bg-slate-700 text-white text-sm px-5 py-3 rounded-xl shadow-xl border border-slate-700 dark:border-slate-600">
          <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
          <span>Transaction confirmed</span>
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors ml-1"
          >
            <RotateCcw size={13} />
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
