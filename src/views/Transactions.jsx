import { useState, useMemo, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, CheckCircle, RefreshCw, RotateCcw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatCurrency, formatDate } from '../utils/formatters'
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
    setEditingTransaction(null)
    setModalOpen(true)
  }

  const openEdit = (transaction) => {
    setEditingTransaction(transaction)
    setModalOpen(true)
  }

  const handleDelete = (id) => {
    if (window.confirm('Delete this transaction?')) {
      deleteTransaction(id)
    }
  }

  const handleConfirm = useCallback((id) => {
    // Snapshot the transaction before confirming so undo can revert it
    const snapshot = currentMonthTransactions.find(t => t.id === id)
    confirmTransaction(id)

    // Clear any existing undo toast
    if (undoToast) clearTimeout(undoToast.timeoutId)

    const timeoutId = setTimeout(() => setUndoToast(null), 5000)
    setUndoToast({ id, timeoutId, snapshot })
  }, [currentMonthTransactions, confirmTransaction, undoToast])

  const handleUndo = useCallback(() => {
    if (!undoToast) return
    clearTimeout(undoToast.timeoutId)
    const { snapshot } = undoToast
    // Revert the transaction back to pending
    updateTransaction(snapshot.id, { ...snapshot, isPending: true })
    setUndoToast(null)
  }, [undoToast, updateTransaction])

  // Render a single transaction row (shared between pending and completed sections)
  function renderTransaction(t) {
    if (t.splits) {
      const firstSplitColor = getSplitCategoryColor(t.splits[0])
      return (
        <div key={t.id} className={t.isPending ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''}>
          {/* Main row */}
          <div className="flex items-center gap-3.5 px-5 py-3.5 group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: firstSplitColor }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                  {t.merchant || 'Split Transaction'}
                </p>
                <span className="flex-shrink-0 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                  Split
                </span>
                {t.recurringRuleId && (
                  <RefreshCw size={11} className="flex-shrink-0 text-slate-400" />
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {formatDate(t.date)}
                {t.notes && <> · <span className="italic">{t.notes}</span></>}
              </p>
            </div>
            <span className={`text-sm font-semibold flex-shrink-0 ${
              t.type === 'income' ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-100'
            }`}>
              {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
            </span>
            <div className={`flex items-center gap-0.5 flex-shrink-0 ${t.isPending ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
              {t.isPending && (
                <button
                  onClick={() => handleConfirm(t.id)}
                  title="Mark as confirmed"
                  className="p-1.5 rounded-lg text-amber-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  <CheckCircle size={14} />
                </button>
              )}
              <button
                onClick={() => openEdit(t)}
                title="Edit"
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                title="Delete"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Split sub-rows */}
          {t.splits.map((split, idx) => {
            const isLast = idx === t.splits.length - 1
            const subName = getSubcategoryName(split.categoryId, split.subcategoryId)
            const color = getSplitCategoryColor(split)
            return (
              <div
                key={idx}
                className="flex items-center gap-3.5 pl-10 pr-5 py-2 bg-slate-50/60 dark:bg-slate-700/30 border-t border-slate-100 dark:border-slate-700"
              >
                <span className="text-slate-300 dark:text-slate-600 text-xs flex-shrink-0 select-none">
                  {isLast ? '└' : '├'}
                </span>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <p className="flex-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                  {getCategoryName(split.categoryId)}
                  {subName && <> · {subName}</>}
                </p>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {t.type === 'income' ? '+' : '−'}{formatCurrency(split.amount)}
                </span>
              </div>
            )
          })}
        </div>
      )
    }

    // Regular (flat) transaction
    const subName = getSubcategoryName(t.categoryId, t.subcategoryId)
    const color = getCategoryColor(t.categoryId)
    return (
      <div
        key={t.id}
        className={`flex items-center gap-3.5 px-5 py-3.5 group hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
          t.isPending ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''
        }`}
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
              {t.merchant || getCategoryName(t.categoryId)}
            </p>
            {t.recurringRuleId && (
              <RefreshCw size={11} className="flex-shrink-0 text-slate-400" />
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {getCategoryName(t.categoryId)}
            {subName && <> · {subName}</>}
            {' · '}
            {formatDate(t.date)}
            {t.notes && <> · <span className="italic">{t.notes}</span></>}
          </p>
        </div>
        <span className={`text-sm font-semibold flex-shrink-0 ${
          t.type === 'income' ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-100'
        }`}>
          {t.type === 'income' ? '+' : '−'}{formatCurrency(t.amount)}
        </span>
        <div className={`flex items-center gap-0.5 flex-shrink-0 ${t.isPending ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {t.isPending && (
            <button
              onClick={() => handleConfirm(t.id)}
              title="Mark as confirmed"
              className="p-1.5 rounded-lg text-amber-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
            >
              <CheckCircle size={14} />
            </button>
          )}
          <button
            onClick={() => openEdit(t)}
            title="Edit"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => handleDelete(t.id)}
            title="Delete"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    )
  }

  const totalVisible = pendingList.length + completedList.length

  return (
    <div className="space-y-4 max-w-3xl pb-24">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {totalVisible} transaction{totalVisible !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Add Transaction
        </button>
      </div>

      {/* Empty state */}
      {totalVisible === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <p className="text-slate-400 dark:text-slate-500 text-sm">No transactions yet for this month.</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Click "Add Transaction" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending section */}
          {pendingList.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 px-1">
                Pending
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/60 divide-y divide-slate-100 dark:divide-slate-700">
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
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
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
      <button
        onClick={openAdd}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors flex items-center justify-center"
        title="Add Transaction"
      >
        <Plus size={24} />
      </button>

      {/* Undo confirm toast */}
      {undoToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-800 dark:bg-slate-700 text-white text-sm px-5 py-3 rounded-xl shadow-xl border border-slate-700 dark:border-slate-600">
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
