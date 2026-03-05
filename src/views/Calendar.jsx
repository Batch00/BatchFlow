import { useState, useMemo } from 'react'
import { DollarSign, AlertTriangle, X, Pencil, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatCurrency, formatDate, formatMonthLabel } from '../utils/formatters'
import TransactionModal from '../components/transactions/TransactionModal'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── DayModal ──────────────────────────────────────────────────────────────────

function DayModal({ dayStr, transactions, categories, onClose, onEditTransaction }) {
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])

  const incomeItems = transactions.filter(t => t.type === 'income')
  const expenses = transactions.filter(t => t.type === 'expense')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">{formatDate(dayStr)}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {incomeItems.length === 0 && expenses.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">No events this day.</p>
          )}

          {incomeItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Income</p>
              <div className="space-y-0.5">
                {incomeItems.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {t.merchant || catMap[t.categoryId]?.name || 'Income'}
                        </p>
                        {t.isPending && (
                          <span className="text-xs text-amber-500">Pending</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(t.amount)}</span>
                      <button
                        onClick={() => onEditTransaction(t)}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expenses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Expenses</p>
              <div className="space-y-0.5">
                {expenses.map((t, i) => {
                  const cat = catMap[t.categoryId]
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat?.color ?? '#94a3b8' }}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {t.merchant || cat?.name || 'Expense'}
                          </p>
                          {t.isPending && <span className="text-xs text-amber-500">Pending</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-red-500 dark:text-red-400">{formatCurrency(t.amount)}</span>
                        <button
                          onClick={() => onEditTransaction(t)}
                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export default function Calendar() {
  const {
    currentMonth,
    currentMonthTransactions,
    categories,
    recurringRules,
  } = useApp()

  const [year, month] = currentMonth.split('-').map(Number)
  const [selectedDay, setSelectedDay] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [startingBalance, setStartingBalance] = useState('0')

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])

  // All income to display: recurring (pending or confirmed) + one-time confirmed
  const incomeItems = useMemo(
    () => currentMonthTransactions
      .filter(t => t.type === 'income' && (t.recurringRuleId !== null || !t.isPending))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [currentMonthTransactions]
  )

  // Whether there is any income to show (recurring rules set up OR confirmed one-time income)
  const hasAnyIncome = useMemo(
    () => recurringRules.some(r => r.type === 'income' && !r.isPaused) ||
          currentMonthTransactions.some(t => t.type === 'income' && !t.isPending && !t.recurringRuleId),
    [recurringRules, currentMonthTransactions]
  )

  // Events indexed by day-of-month
  const eventsByDay = useMemo(() => {
    const map = {}
    for (const t of currentMonthTransactions) {
      const day = parseInt(t.date.split('-')[2], 10)
      if (!map[day]) map[day] = { transactions: [] }
      map[day].transactions.push(t)
    }
    return map
  }, [currentMonthTransactions])

  // Calendar grid dimensions
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7

  // Today string for highlighting
  const todayStr = (() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  })()

  // Cash flow — all income (recurring + confirmed one-time); expenses from recurring + confirmed
  const cashFlow = useMemo(() => {
    const balance0 = parseFloat(startingBalance) || 0
    const rows = []
    let balance = balance0
    for (let d = 1; d <= daysInMonth; d++) {
      const { transactions: txns = [] } = eventsByDay[d] ?? {}
      const income = txns
        .filter(t => t.type === 'income' && (t.recurringRuleId !== null || !t.isPending))
        .reduce((s, t) => s + t.amount, 0)
      const expenses = txns
        .filter(t => t.type === 'expense' && (t.recurringRuleId !== null || !t.isPending))
        .reduce((s, t) => s + t.amount, 0)
      if (income > 0 || expenses > 0) {
        balance += income - expenses
        rows.push({ day: d, income, expenses, balance })
      }
    }
    return rows
  }, [eventsByDay, daysInMonth, startingBalance])

  const incomeTotal = incomeItems.reduce((s, t) => s + t.amount, 0)

  const selectedDayStr = selectedDay != null
    ? `${currentMonth}-${String(selectedDay).padStart(2, '0')}`
    : null
  const selectedEvents = selectedDay != null ? (eventsByDay[selectedDay] ?? { transactions: [] }) : null

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Calendar</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{formatMonthLabel(currentMonth)}</p>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
          {DAY_LABELS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: totalCells }, (_, idx) => {
            const day = idx - firstDayOfWeek + 1
            const inMonth = day >= 1 && day <= daysInMonth
            const dayStr = inMonth ? `${currentMonth}-${String(day).padStart(2, '0')}` : null
            const isToday = dayStr === todayStr
            const { transactions: dayTxns = [] } = inMonth ? (eventsByDay[day] ?? {}) : {}
            const shown = dayTxns.slice(0, 3)
            const extra = dayTxns.length - shown.length

            return (
              <div
                key={idx}
                onClick={() => inMonth && setSelectedDay(day)}
                className={[
                  'min-h-[90px] p-1.5 border-b border-slate-100 dark:border-slate-700/60',
                  idx % 7 !== 6 ? 'border-r border-slate-100 dark:border-slate-700/60' : '',
                  idx >= totalCells - 7 ? 'border-b-0' : '',
                  inMonth ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors' : 'bg-slate-50/50 dark:bg-slate-800/30',
                ].join(' ')}
              >
                {inMonth && (
                  <>
                    <div
                      className={[
                        'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1',
                        isToday ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-300',
                      ].join(' ')}
                    >
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {shown.map((item, i) => {
                        if (item.type === 'income') {
                          return (
                            <div
                              key={i}
                              className={`text-xs rounded px-1 py-0.5 truncate leading-4 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ${item.isPending ? 'opacity-70' : ''}`}
                            >
                              {item.merchant || catMap[item.categoryId]?.name || 'Income'}
                            </div>
                          )
                        }
                        const cat = catMap[item.categoryId]
                        const baseColor = cat?.color ?? '#ef4444'
                        return (
                          <div
                            key={i}
                            className={`text-xs rounded px-1 py-0.5 truncate leading-4 ${item.isPending ? 'opacity-60' : ''}`}
                            style={{
                              backgroundColor: `${baseColor}22`,
                              color: baseColor,
                            }}
                          >
                            {item.merchant || cat?.name || 'Expense'}
                          </div>
                        )
                      })}
                      {extra > 0 && (
                        <div className="text-xs text-slate-400 dark:text-slate-500 px-1">+{extra} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Income — recurring + confirmed one-time */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Income</h2>
          {incomeTotal > 0 && (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {formatCurrency(incomeTotal)} total
            </span>
          )}
        </div>
        {!hasAnyIncome ? (
          <div className="px-5 py-8 text-center space-y-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">No income for this month yet.</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add recurring income on the Recurring page or log a confirmed income transaction and it will appear here.
            </p>
          </div>
        ) : incomeItems.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No income scheduled or confirmed for this month.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {incomeItems.map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {t.merchant || catMap[t.categoryId]?.name || 'Income'}
                      </p>
                      {t.recurringRuleId ? (
                        <span className="flex items-center gap-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                          <RefreshCw size={9} />
                          Recurring
                        </span>
                      ) : (
                        <span className="text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                          Income
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(t.date)}</p>
                      {t.isPending && (
                        <span className="text-xs text-amber-500">Pending</span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cash Flow */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Cash Flow</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">Starting balance</label>
            <input
              type="number"
              value={startingBalance}
              onChange={e => setStartingBalance(e.target.value)}
              className="w-28 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
        {cashFlow.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No income or confirmed expenses this month yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700/60">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Date</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Income</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Expenses</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40">
                {cashFlow.map(row => {
                  const isNeg = row.balance < 0
                  const dateStr = `${currentMonth}-${String(row.day).padStart(2, '0')}`
                  return (
                    <tr key={row.day} className={isNeg ? 'bg-red-50/60 dark:bg-red-900/10' : ''}>
                      <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1.5">
                          {isNeg && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                          {formatDate(dateStr)}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {row.income > 0 ? `+${formatCurrency(row.income)}` : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right text-red-500 dark:text-red-400 tabular-nums">
                        {row.expenses > 0 ? `-${formatCurrency(row.expenses)}` : '—'}
                      </td>
                      <td className={`px-5 py-2.5 text-right font-semibold tabular-nums ${isNeg ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        {formatCurrency(row.balance)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Day detail modal */}
      {selectedDay !== null && selectedEvents !== null && (
        <DayModal
          dayStr={selectedDayStr}
          transactions={selectedEvents.transactions}
          categories={categories}
          onClose={() => setSelectedDay(null)}
          onEditTransaction={t => { setSelectedDay(null); setEditingTransaction(t) }}
        />
      )}

      {/* Transaction edit modal (opened from DayModal) */}
      {editingTransaction && (
        <TransactionModal
          isOpen={true}
          editingTransaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
        />
      )}
    </div>
  )
}
