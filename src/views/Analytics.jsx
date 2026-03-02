import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, Hash } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatCurrency, formatMonthLabel, getMonthKey } from '../utils/formatters'
import {
  getCategorySpent, getCategoryEffectivePlanned,
  getTotalByType, getTotalPlannedByType,
} from '../utils/budgetUtils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLastNMonths(n) {
  const months = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(getMonthKey(d))
  }
  return months
}

// Short axis label: "$1.5k" or "$800"
function shortCurrency(v) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${Math.round(v)}`
}

// Month key → "Feb '26"
function shortMonth(key) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ── Custom tooltips ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl shadow-lg px-3.5 py-2.5 text-xs"
      style={{
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      }}
    >
      {label && <p className={`font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>}
      {payload.map(entry => (
        <div key={entry.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: entry.color }} />
            <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{entry.name}</span>
          </span>
          <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload, isDark }) {
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div
      className="rounded-xl shadow-lg px-3.5 py-2.5 text-xs"
      style={{
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      }}
    >
      <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{name}</p>
      <p className={`mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{formatCurrency(value)}</p>
      <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>{p.pct}% of expenses</p>
    </div>
  )
}

// ── UI primitives ─────────────────────────────────────────────────────────────

function SummaryChip({ label, value, sub, colorClass, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function EmptyChart({ message = 'No data for this period.' }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[180px]">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )
}

// ── This Month view ───────────────────────────────────────────────────────────

function MonthView({ categories, transactions, budget, isDark }) {
  const expenseCategories = categories.filter(c => c.type === 'expense')

  const actualIncome = getTotalByType(transactions, 'income')
  const actualExpenses = getTotalByType(transactions, 'expense')
  const net = actualIncome - actualExpenses

  // Per-category data — all expense categories with any planned or actual amount
  const categoryData = useMemo(() => {
    return expenseCategories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        spent: getCategorySpent(transactions, cat.id),
        planned: getCategoryEffectivePlanned(cat, budget),
        txns: transactions.filter(t =>
          t.splits ? t.splits.some(s => s.categoryId === cat.id) : t.categoryId === cat.id
        ).length,
      }))
      .filter(d => d.spent > 0 || d.planned > 0)
      .sort((a, b) => b.spent - a.spent)
  }, [transactions, budget, expenseCategories])

  // Donut: only categories with actual spending
  const donutData = categoryData
    .filter(d => d.spent > 0)
    .map(d => ({
      ...d,
      pct: actualExpenses > 0 ? Math.round((d.spent / actualExpenses) * 100) : 0,
    }))

  // Horizontal grouped bar: planned vs actual
  const barData = categoryData.map(d => ({
    name: d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name,
    Planned: d.planned,
    Actual: d.spent,
  }))

  const barHeight = Math.max(180, categoryData.length * 48)

  // Custom legend for donut
  const renderDonutLegend = () => (
    <div className="space-y-1.5 mt-3">
      {donutData.map(d => (
        <div key={d.id} className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate mr-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            {d.name}
          </span>
          <span className="font-medium text-slate-700 dark:text-slate-300 flex-shrink-0">{d.pct}%</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryChip
          icon={TrendingUp}
          label="Income"
          value={formatCurrency(actualIncome)}
          colorClass="bg-emerald-50 text-emerald-600"
        />
        <SummaryChip
          icon={TrendingDown}
          label="Expenses"
          value={formatCurrency(actualExpenses)}
          colorClass="bg-red-50 text-red-500"
        />
        <SummaryChip
          icon={Wallet}
          label="Net"
          value={formatCurrency(net)}
          sub={net >= 0 ? 'under budget' : 'over budget'}
          colorClass={net >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}
        />
        <SummaryChip
          icon={Hash}
          label="Transactions"
          value={String(transactions.length)}
          sub="this month"
          colorClass="bg-indigo-50 text-indigo-600"
        />
      </div>

      {/* Donut + Top Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Spending breakdown donut */}
        <SectionCard
          title="Spending Breakdown"
          subtitle="Expenses by category"
        >
          {donutData.length === 0 ? (
            <EmptyChart message="No expenses logged this month." />
          ) : (
            <div className="flex gap-4">
              <div className="w-48 h-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="80%"
                      paddingAngle={2}
                      dataKey="spent"
                      nameKey="name"
                      strokeWidth={0}
                    >
                      {donutData.map(entry => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip isDark={isDark} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0 py-1">
                {renderDonutLegend()}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Top spending categories */}
        <SectionCard
          title="Top Categories"
          subtitle="Ranked by spending · transaction count shown on right"
        >
          {categoryData.length === 0 ? (
            <EmptyChart message="No spending data yet." />
          ) : (
            <div className="space-y-3">
              {categoryData.slice(0, 6).map((d, i) => {
                const pct = actualExpenses > 0 ? (d.spent / actualExpenses) * 100 : 0
                return (
                  <div key={d.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 truncate mr-2">
                        <span className="text-slate-400 dark:text-slate-500 font-medium w-4 text-right flex-shrink-0">{i + 1}</span>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0 text-xs">
                        <span className="text-slate-400 dark:text-slate-500">{d.txns} transaction{d.txns !== 1 ? 's' : ''}</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(d.spent)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: d.color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Planned vs Actual bar chart */}
      <SectionCard
        title="Planned vs Actual"
        subtitle="Expense categories with a budget or spending this month"
      >
        {barData.length === 0 ? (
          <EmptyChart message="Set budget amounts and log transactions to see this chart." />
        ) : (
          <div style={{ height: barHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={barData}
                margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                barCategoryGap="30%"
                barGap={3}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis
                  type="number"
                  tickFormatter={shortCurrency}
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#475569' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CurrencyTooltip isDark={isDark} />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Bar dataKey="Planned" fill="#e0e7ff" radius={[0, 3, 3, 0]} />
                <Bar dataKey="Actual" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── Trends view ───────────────────────────────────────────────────────────────

function TrendsView({ categories, transactions, budgets, isDark }) {
  const monthKeys = useMemo(() => getLastNMonths(12), [])

  const trendData = useMemo(() => {
    return monthKeys.map(key => {
      const monthTxns = transactions.filter(t => t.date?.startsWith(key))
      const income = getTotalByType(monthTxns, 'income')
      const expenses = getTotalByType(monthTxns, 'expense')
      const monthBudget = budgets[key] ?? { planned: {} }
      const plannedExpenses = getTotalPlannedByType(categories, monthBudget, 'expense')
      return {
        key,
        label: shortMonth(key),
        fullLabel: formatMonthLabel(key),
        Income: income,
        Expenses: expenses,
        Planned: plannedExpenses,
        Net: income - expenses,
        txns: monthTxns.length,
      }
    })
  }, [monthKeys, transactions, budgets, categories])

  const hasAnyData = trendData.some(d => d.Income > 0 || d.Expenses > 0)

  return (
    <div className="space-y-5">
      {/* Line chart */}
      <SectionCard
        title="Income & Expenses Over Time"
        subtitle="Last 12 months"
      >
        {!hasAnyData ? (
          <EmptyChart message="No transaction data yet. Log some transactions to see trends." />
        ) : (
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={shortCurrency}
                  tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<CurrencyTooltip isDark={isDark} />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="Income"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="Expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Line
                  type="monotone"
                  dataKey="Planned"
                  stroke="#c7d2fe"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Monthly summary table */}
      <SectionCard
        title="Monthly Summary"
        subtitle="Income, expenses, and net by month"
      >
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Month</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Income</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Expenses</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Planned</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Net</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {[...trendData].reverse().map(row => (
                <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="py-2.5 px-1 font-medium text-slate-700 dark:text-slate-300">{row.fullLabel}</td>
                  <td className="py-2.5 px-1 text-right text-emerald-600 font-medium">
                    {row.Income > 0 ? formatCurrency(row.Income) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="py-2.5 px-1 text-right text-slate-700 dark:text-slate-300">
                    {row.Expenses > 0 ? formatCurrency(row.Expenses) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="py-2.5 px-1 text-right text-slate-400 dark:text-slate-500">
                    {row.Planned > 0 ? formatCurrency(row.Planned) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className={`py-2.5 px-1 text-right font-semibold ${
                    row.Net > 0 ? 'text-emerald-600' : row.Net < 0 ? 'text-red-500' : 'text-slate-300 dark:text-slate-600'
                  }`}>
                    {row.Income > 0 || row.Expenses > 0 ? formatCurrency(row.Net) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="py-2.5 px-1 text-right text-slate-400 dark:text-slate-500">{row.txns || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Analytics (main view) ─────────────────────────────────────────────────────

export default function Analytics() {
  const { categories, transactions, budgets, currentMonthTransactions, currentMonthBudget, isDark } = useApp()
  const [tab, setTab] = useState('month')

  // Exclude pending transactions from all analytics — only confirmed data counts
  const confirmedMonthTransactions = useMemo(
    () => currentMonthTransactions.filter(t => !t.isPending),
    [currentMonthTransactions]
  )
  const confirmedAllTransactions = useMemo(
    () => transactions.filter(t => !t.isPending),
    [transactions]
  )

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        <Tab label="This Month" active={tab === 'month'} onClick={() => setTab('month')} />
        <Tab label="Trends" active={tab === 'trends'} onClick={() => setTab('trends')} />
      </div>

      {tab === 'month' ? (
        <MonthView
          categories={categories}
          transactions={confirmedMonthTransactions}
          budget={currentMonthBudget}
          isDark={isDark}
        />
      ) : (
        <TrendsView
          categories={categories}
          transactions={confirmedAllTransactions}
          budgets={budgets}
          isDark={isDark}
        />
      )}
    </div>
  )
}
