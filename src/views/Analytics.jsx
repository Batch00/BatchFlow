import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  LineChart, Line, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Wallet, Hash, X, ChevronDown, ChevronRight, Target } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatCurrency, formatMonthLabel, getMonthKey } from '../utils/formatters'
import {
  getCategorySpent, getCategoryEffectivePlanned,
  getSubcategorySpent, getSubcategoryPlanned,
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

function shortCurrency(v) {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`
  return `$${Math.round(v)}`
}

function shortMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

function pct(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Custom Tooltips ───────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl shadow-lg px-3.5 py-2.5 text-xs"
      style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
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

function PieTooltip({ active, payload, isDark, showPct, totalIncome }) {
  if (!active || !payload?.length) return null
  const { name, value, payload: p } = payload[0]
  return (
    <div className="rounded-xl shadow-lg px-3.5 py-2.5 text-xs"
      style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
      <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{name}</p>
      <p className={`mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {showPct ? `${pct(value, totalIncome)}% of income` : formatCurrency(value)}
      </p>
      <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>{p.pct}% of expenses</p>
    </div>
  )
}

function CountTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl shadow-lg px-3.5 py-2.5 text-xs"
      style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
      {label && <p className={`font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>}
      {payload.map(entry => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{entry.name}</span>
          <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── UI Primitives ─────────────────────────────────────────────────────────────

function SummaryChip({ label, value, sub, colorClass, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}><Icon size={16} /></div>
      </div>
      <p className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function EmptyChart({ message = 'No data for this period.' }) {
  return (
    <div className="flex items-center justify-center min-h-[180px]">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}>
      {label}
    </button>
  )
}

function ToggleButton({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
        active ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600'
      }`}>
      {label}
    </button>
  )
}

// ── Efficiency gauge (SVG circle) ─────────────────────────────────────────────

function EfficiencyGauge({ score }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const filled = circ * (score / 100)
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={100} height={100} viewBox="0 0 100 100">
      <circle cx={50} cy={50} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} className="dark:stroke-slate-700" />
      <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)" />
      <text x={50} y={53} textAnchor="middle" fontSize={18} fontWeight={700} fill={color}>{Math.round(score)}%</text>
    </svg>
  )
}

// ── MonthView ─────────────────────────────────────────────────────────────────

function MonthView({ categories, transactions, budget, budgets, isDark }) {
  const [donutMode, setDonutMode] = useState('actual') // 'actual' | 'planned'
  const [showPct, setShowPct] = useState(false)
  const [expandedCatId, setExpandedCatId] = useState(null) // category history
  const [drillCatId, setDrillCatId] = useState(null) // subcategory drill-down

  const expenseCategories = categories.filter(c => c.type === 'expense')
  const actualIncome = getTotalByType(transactions, 'income')
  const actualExpenses = getTotalByType(transactions, 'expense')
  const net = actualIncome - actualExpenses

  const categoryData = useMemo(() => {
    return expenseCategories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        subcategories: cat.subcategories,
        spent: getCategorySpent(transactions, cat.id),
        planned: getCategoryEffectivePlanned(cat, budget),
        txns: transactions.filter(t =>
          t.splits ? t.splits.some(s => s.categoryId === cat.id) : t.categoryId === cat.id
        ).length,
      }))
      .filter(d => d.spent > 0 || d.planned > 0)
      .sort((a, b) => b.spent - a.spent)
  }, [transactions, budget, expenseCategories])

  // Donut data — actual spending or planned amounts
  const donutData = useMemo(() => {
    const source = donutMode === 'actual'
      ? categoryData.filter(d => d.spent > 0)
      : categoryData.filter(d => d.planned > 0)
    const total = source.reduce((s, d) => s + (donutMode === 'actual' ? d.spent : d.planned), 0)
    return source.map(d => {
      const v = donutMode === 'actual' ? d.spent : d.planned
      return { ...d, value: v, pct: total > 0 ? Math.round((v / total) * 100) : 0 }
    })
  }, [categoryData, donutMode])

  const donutTotal = donutData.reduce((s, d) => s + d.value, 0)

  // Planned vs actual bar
  const barData = categoryData.map(d => ({
    id: d.id,
    name: d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name,
    fullName: d.name,
    Planned: showPct ? pct(d.planned, actualIncome) : d.planned,
    Actual: showPct ? pct(d.spent, actualIncome) : d.spent,
  }))
  const barHeight = Math.max(180, categoryData.length * 52)

  // Budget efficiency score
  const efficiencyScore = useMemo(() => {
    const eligible = categoryData.filter(d => d.planned > 0)
    if (eligible.length === 0) return null
    const scores = eligible.map(d => d.spent <= d.planned ? (d.spent / d.planned) * 100 : 0)
    return scores.reduce((s, v) => s + v, 0) / scores.length
  }, [categoryData])

  // Category history (last 6 months) for clicked category
  const historyMonths = useMemo(() => getLastNMonths(6), [])
  const expandedCat = categoryData.find(d => d.id === expandedCatId)
  const historyData = useMemo(() => {
    if (!expandedCatId) return []
    return historyMonths.map(key => {
      const monthTxns = transactions // note: we have all-time transactions via prop
      // We only have confirmed month txns here; history uses allTransactions passed from parent
      return { label: shortMonth(key), key }
    })
  }, [expandedCatId, historyMonths, transactions])

  // Drill-down: subcategory data for clicked category
  const drillCat = categoryData.find(d => d.id === drillCatId)
  const drillData = useMemo(() => {
    if (!drillCat) return []
    return drillCat.subcategories.map(sub => ({
      name: sub.name.length > 16 ? sub.name.slice(0, 15) + '…' : sub.name,
      Planned: showPct ? pct(getSubcategoryPlanned(budget, sub.id), actualIncome) : getSubcategoryPlanned(budget, sub.id),
      Actual: showPct ? pct(getSubcategorySpent(transactions, sub.id), actualIncome) : getSubcategorySpent(transactions, sub.id),
    })).filter(d => d.Planned > 0 || d.Actual > 0)
  }, [drillCat, budget, transactions, showPct, actualIncome])

  const yLabel = showPct ? '% of income' : undefined

  return (
    <div className="space-y-5">
      {/* Controls row */}
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">Show as</span>
        <ToggleButton label="$" active={!showPct} onClick={() => setShowPct(false)} />
        <ToggleButton label="% of income" active={showPct} onClick={() => setShowPct(true)} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryChip icon={TrendingUp} label="Income" value={showPct ? '100%' : formatCurrency(actualIncome)} colorClass="bg-emerald-50 text-emerald-600" />
        <SummaryChip icon={TrendingDown} label="Expenses" value={showPct ? `${pct(actualExpenses, actualIncome)}%` : formatCurrency(actualExpenses)} colorClass="bg-red-50 text-red-500" />
        <SummaryChip icon={Wallet} label="Net" value={showPct ? `${pct(net, actualIncome)}%` : formatCurrency(net)}
          sub={net >= 0 ? 'surplus' : 'deficit'}
          colorClass={net >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'} />
        <SummaryChip icon={Hash} label="Transactions" value={String(transactions.length)} sub="confirmed" colorClass="bg-indigo-50 text-indigo-600" />
      </div>

      {/* Donut + Top Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Spending Breakdown" subtitle={donutMode === 'actual' ? 'Actual spending by category' : 'Planned amounts by category'}
          action={
            <div className="flex gap-1">
              <ToggleButton label="Actual" active={donutMode === 'actual'} onClick={() => setDonutMode('actual')} />
              <ToggleButton label="Planned" active={donutMode === 'planned'} onClick={() => setDonutMode('planned')} />
            </div>
          }>
          {donutData.length === 0 ? (
            <EmptyChart message={donutMode === 'actual' ? 'No expenses logged this month.' : 'No budget amounts set.'} />
          ) : (
            <div className="flex gap-4">
              <div className="w-44 h-44 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius="52%" outerRadius="80%"
                      paddingAngle={2} dataKey="value" nameKey="name" strokeWidth={0}>
                      {donutData.map(entry => <Cell key={entry.id} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<PieTooltip isDark={isDark} showPct={showPct} totalIncome={actualIncome} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0 py-1 space-y-1.5">
                {donutData.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 truncate mr-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 flex-shrink-0">
                      {showPct ? `${pct(d.value, actualIncome)}%` : `${d.pct}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Top categories — click for 6-month history */}
        <SectionCard title="Top Categories" subtitle="Click a category to see its 6-month trend">
          {categoryData.length === 0 ? (
            <EmptyChart message="No spending data yet." />
          ) : (
            <div className="space-y-2.5">
              {categoryData.slice(0, 6).map((d, i) => {
                const isExpanded = expandedCatId === d.id
                return (
                  <div key={d.id}>
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedCatId(isExpanded ? null : d.id)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 truncate mr-2">
                          <span className="text-slate-400 dark:text-slate-500 font-medium w-4 text-right flex-shrink-0">{i + 1}</span>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="truncate">{d.name}</span>
                          {isExpanded ? <ChevronDown size={11} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={11} className="text-slate-400 flex-shrink-0" />}
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0 text-xs">
                          <span className="text-slate-400 dark:text-slate-500">{d.txns} txn{d.txns !== 1 ? 's' : ''}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {showPct ? `${pct(d.spent, actualIncome)}%` : formatCurrency(d.spent)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, actualExpenses > 0 ? (d.spent / actualExpenses) * 100 : 0)}%`, backgroundColor: d.color }} />
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Planned vs Actual bar — click bar to drill into subcategories */}
      <SectionCard title="Planned vs Actual"
        subtitle={drillCatId ? `Subcategory breakdown — ${drillCat?.name}` : 'Click a bar to see subcategory breakdown'}>
        {barData.length === 0 ? (
          <EmptyChart message="Set budget amounts and log transactions to see this chart." />
        ) : (
          <>
            <div style={{ height: barHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={barData}
                  margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                  barCategoryGap="30%" barGap={3}
                  onClick={e => {
                    if (!e?.activePayload?.[0]) return
                    const id = e.activePayload[0].payload.id
                    setDrillCatId(prev => prev === id ? null : id)
                  }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} />
                  <XAxis type="number" tickFormatter={showPct ? v => `${v}%` : shortCurrency}
                    tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={100}
                    tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#475569', cursor: 'pointer' }}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={showPct
                    ? ({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-xl shadow-lg px-3.5 py-2.5 text-xs"
                            style={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                            <p className={`font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>
                            {payload.map(p => (
                              <div key={p.name} className="flex justify-between gap-4">
                                <span style={{ color: p.color }}>{p.name}</span>
                                <span className="font-semibold">{p.value}%</span>
                              </div>
                            ))}
                          </div>
                        )
                      }
                    : <CurrencyTooltip isDark={isDark} />}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="Planned" fill="#e0e7ff" radius={[0, 3, 3, 0]} style={{ cursor: 'pointer' }}
                    label={false} />
                  <Bar dataKey="Actual" fill="#6366f1" radius={[0, 3, 3, 0]} style={{ cursor: 'pointer' }}
                    label={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Subcategory drill-down panel */}
            {drillCatId && drillData.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {drillCat?.name} — subcategories
                  </p>
                  <button onClick={() => setDrillCatId(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={14} /></button>
                </div>
                <div style={{ height: Math.max(120, drillData.length * 44) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={drillData}
                      margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                      barCategoryGap="30%" barGap={3}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} />
                      <XAxis type="number" tickFormatter={showPct ? v => `${v}%` : shortCurrency}
                        tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={110}
                        tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }}
                        axisLine={false} tickLine={false} />
                      <Tooltip content={showPct ? undefined : <CurrencyTooltip isDark={isDark} />} />
                      <Bar dataKey="Planned" fill="#e0e7ff" radius={[0, 3, 3, 0]} />
                      <Bar dataKey="Actual" fill="#6366f1" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {drillCatId && drillData.length === 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <p className="text-xs text-slate-400">No subcategories with data for {drillCat?.name}.</p>
                <button onClick={() => setDrillCatId(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* Budget efficiency score */}
      {efficiencyScore !== null && (
        <SectionCard title="Budget Efficiency"
          subtitle="How accurately you followed your plan this month — spending close to (but not over) budget scores highest">
          <div className="flex items-center gap-6">
            <EfficiencyGauge score={efficiencyScore} />
            <div className="space-y-1.5 text-sm">
              <p className={`font-semibold ${efficiencyScore >= 80 ? 'text-emerald-600' : efficiencyScore >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                {efficiencyScore >= 80 ? 'Great accuracy' : efficiencyScore >= 60 ? 'Room to improve' : 'Needs attention'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Categories over budget count as 0%. Categories under budget score proportionally.
              </p>
              <div className="space-y-0.5 mt-2">
                {categoryData.filter(d => d.planned > 0).slice(0, 4).map(d => {
                  const s = d.spent <= d.planned ? Math.round((d.spent / d.planned) * 100) : 0
                  const over = d.spent > d.planned
                  return (
                    <div key={d.id} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-slate-500 dark:text-slate-400 truncate w-24">{d.name}</span>
                      <span className={`font-medium flex-shrink-0 ${over ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {over ? 'Over' : `${s}%`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ── TrendsView ────────────────────────────────────────────────────────────────

const ALL_24_MONTHS = getLastNMonths(24)

function TrendsView({ categories, allTransactions, budgets, isDark }) {
  const all12 = useMemo(() => getLastNMonths(12), [])
  const [dateFrom, setDateFrom] = useState(all12[0])
  const [dateTo, setDateTo] = useState(all12[all12.length - 1])
  const [hiddenCats, setHiddenCats] = useState(new Set())

  const expenseCategories = categories.filter(c => c.type === 'expense')

  const selectedMonths = useMemo(() => {
    return ALL_24_MONTHS.filter(k => k >= dateFrom && k <= dateTo)
  }, [dateFrom, dateTo])

  const confirmedTxns = useMemo(
    () => allTransactions.filter(t => !t.isPending),
    [allTransactions]
  )

  // Main trend data (income / expenses / savings)
  const trendData = useMemo(() => {
    return selectedMonths.map(key => {
      const monthTxns = confirmedTxns.filter(t => t.date?.startsWith(key))
      const income = getTotalByType(monthTxns, 'income')
      const expenses = getTotalByType(monthTxns, 'expense')
      const monthBudget = budgets[key] ?? { planned: {}, subcategoryPlanned: {} }
      const plannedExp = getTotalPlannedByType(categories, monthBudget, 'expense')
      const savingsRate = income > 0 ? Math.max(0, Math.round(((income - expenses) / income) * 100)) : null
      return {
        key,
        label: shortMonth(key),
        fullLabel: formatMonthLabel(key),
        Income: income,
        Expenses: expenses,
        Planned: plannedExp,
        Net: income - expenses,
        SavingsRate: savingsRate,
        txns: monthTxns.length,
      }
    })
  }, [selectedMonths, confirmedTxns, budgets, categories])

  // Per-category spending over selected range
  const catTrendData = useMemo(() => {
    return selectedMonths.map(key => {
      const monthTxns = confirmedTxns.filter(t => t.date?.startsWith(key))
      const row = { label: shortMonth(key) }
      expenseCategories.forEach(cat => {
        row[cat.id] = getCategorySpent(monthTxns, cat.id)
      })
      return row
    })
  }, [selectedMonths, confirmedTxns, expenseCategories])

  const hasAnyData = trendData.some(d => d.Income > 0 || d.Expenses > 0)
  const hasCatData = catTrendData.some(row => expenseCategories.some(c => (row[c.id] ?? 0) > 0))

  const toggleCat = (id) => setHiddenCats(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const visibleCats = expenseCategories.filter(c => !hiddenCats.has(c.id))

  return (
    <div className="space-y-5">
      {/* Date range selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date range</span>
        <div className="flex items-center gap-2">
          <select value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {ALL_24_MONTHS.map(k => <option key={k} value={k}>{formatMonthLabel(k)}</option>)}
          </select>
          <span className="text-xs text-slate-400">to</span>
          <select value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {ALL_24_MONTHS.filter(k => k >= dateFrom).map(k => <option key={k} value={k}>{formatMonthLabel(k)}</option>)}
          </select>
        </div>
        <span className="text-xs text-slate-400">{selectedMonths.length} month{selectedMonths.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Income & Expenses line chart */}
      <SectionCard title="Income vs Expenses" subtitle="Confirmed transactions only">
        {!hasAnyData ? (
          <EmptyChart message="No transaction data yet." />
        ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<CurrencyTooltip isDark={isDark} />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2}
                  dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="Planned" stroke="#c7d2fe" strokeWidth={2}
                  strokeDasharray="5 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Savings rate chart */}
      <SectionCard title="Savings Rate" subtitle="(Income − Expenses) ÷ Income per month">
        {!hasAnyData ? (
          <EmptyChart message="No data yet." />
        ) : (
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${v}%`} domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const val = payload[0]?.value
                  return (
                    <div className="rounded-xl shadow-lg px-3.5 py-2.5 text-xs"
                      style={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                      <p className={`font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>
                      <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                        {val != null ? `${val}% saved` : 'No income'}
                      </p>
                    </div>
                  )
                }} />
                <Bar dataKey="SavingsRate" name="Savings Rate" radius={[4, 4, 0, 0]}
                  fill="#6366f1"
                  label={false}>
                  {trendData.map((entry, i) => (
                    <Cell key={i}
                      fill={entry.SavingsRate == null ? '#e2e8f0' : entry.SavingsRate >= 20 ? '#10b981' : entry.SavingsRate >= 0 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Per-category spending trend with toggleable lines */}
      <SectionCard title="Spending by Category" subtitle="Toggle categories below to isolate trends">
        {/* Category toggle chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {expenseCategories.map(cat => {
            const hidden = hiddenCats.has(cat.id)
            return (
              <button key={cat.id} onClick={() => toggleCat(cat.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  hidden ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500' : 'text-white'
                }`}
                style={hidden ? {} : { backgroundColor: cat.color }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                {cat.name}
              </button>
            )
          })}
        </div>
        {!hasCatData ? (
          <EmptyChart message="No spending data in this range." />
        ) : (
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={catTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={shortCurrency} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<CurrencyTooltip isDark={isDark} />} />
                {visibleCats.map(cat => (
                  <Line key={cat.id} type="monotone" dataKey={cat.id} name={cat.name}
                    stroke={cat.color} strokeWidth={2}
                    dot={{ r: 3, fill: cat.color, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Monthly summary table */}
      <SectionCard title="Monthly Summary" subtitle="Income, expenses, savings rate">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="text-left py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Month</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Income</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Expenses</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Planned</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Net</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Savings</th>
                <th className="text-right py-2 px-1 font-semibold text-slate-500 dark:text-slate-400">Txns</th>
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
                  <td className={`py-2.5 px-1 text-right font-semibold ${row.Net > 0 ? 'text-emerald-600' : row.Net < 0 ? 'text-red-500' : 'text-slate-300 dark:text-slate-600'}`}>
                    {row.Income > 0 || row.Expenses > 0 ? formatCurrency(row.Net) : '—'}
                  </td>
                  <td className="py-2.5 px-1 text-right text-slate-500 dark:text-slate-400">
                    {row.SavingsRate != null ? `${row.SavingsRate}%` : <span className="text-slate-300 dark:text-slate-600">—</span>}
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

// ── ActivityView ──────────────────────────────────────────────────────────────

function ActivityView({ categories, allTransactions, isDark }) {
  const months12 = useMemo(() => getLastNMonths(12), [])

  const confirmedTxns = useMemo(
    () => allTransactions.filter(t => !t.isPending),
    [allTransactions]
  )

  const expenseCategories = categories.filter(c => c.type === 'expense')

  // Transaction volume per month
  const volumeData = useMemo(() => {
    return months12.map(key => ({
      label: shortMonth(key),
      key,
      Count: confirmedTxns.filter(t => t.date?.startsWith(key)).length,
    }))
  }, [months12, confirmedTxns])

  const hasVolumeData = volumeData.some(d => d.Count > 0)

  // Day of week frequency (expense transactions — showing spending behavior)
  const dowData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    confirmedTxns
      .filter(t => t.type === 'expense')
      .forEach(t => {
        if (!t.date) return
        const dow = new Date(t.date + 'T12:00:00').getDay()
        counts[dow]++
      })
    return DOW_LABELS.map((label, i) => ({ label, Transactions: counts[i] }))
  }, [confirmedTxns])

  const hasDowData = dowData.some(d => d.Transactions > 0)
  const maxDow = Math.max(...dowData.map(d => d.Transactions), 1)

  // Average transaction size by category
  const avgData = useMemo(() => {
    return expenseCategories
      .map(cat => {
        const catTxns = confirmedTxns.filter(t =>
          t.type === 'expense' && (
            t.splits ? t.splits.some(s => s.categoryId === cat.id) : t.categoryId === cat.id
          )
        )
        const total = getCategorySpent(confirmedTxns.filter(t => t.type === 'expense'), cat.id)
        return {
          name: cat.name.length > 14 ? cat.name.slice(0, 13) + '…' : cat.name,
          color: cat.color,
          avg: catTxns.length > 0 ? total / catTxns.length : 0,
          count: catTxns.length,
        }
      })
      .filter(d => d.count > 0)
      .sort((a, b) => b.avg - a.avg)
  }, [expenseCategories, confirmedTxns])

  const hasAvgData = avgData.length > 0

  return (
    <div className="space-y-5">
      {/* Transaction volume over 12 months */}
      <SectionCard title="Transaction Volume" subtitle="Total confirmed transactions per month (last 12 months)">
        {!hasVolumeData ? (
          <EmptyChart message="No transactions yet." />
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }} barCategoryGap="40%">
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
                <Tooltip content={<CountTooltip isDark={isDark} />} />
                <Bar dataKey="Count" name="Transactions" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Day of week frequency */}
      <SectionCard title="Spending by Day of Week" subtitle="Number of expense transactions per day (all time)">
        {!hasDowData ? (
          <EmptyChart message="No expense transactions yet." />
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#475569' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CountTooltip isDark={isDark} />} />
                <Bar dataKey="Transactions" radius={[4, 4, 0, 0]}>
                  {dowData.map((entry, i) => (
                    <Cell key={i}
                      fill={entry.Transactions === maxDow ? '#6366f1' : isDark ? '#334155' : '#e0e7ff'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {hasDowData && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
            Highest spending day: <span className="font-medium text-slate-600 dark:text-slate-300">{dowData.find(d => d.Transactions === maxDow)?.label}</span>
          </p>
        )}
      </SectionCard>

      {/* Average transaction size by category */}
      <SectionCard title="Average Transaction Size" subtitle="Mean expense amount per transaction by category (all time)">
        {!hasAvgData ? (
          <EmptyChart message="No expense data yet." />
        ) : (
          <div style={{ height: Math.max(180, avgData.length * 44) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={avgData}
                margin={{ top: 0, right: 70, bottom: 0, left: 0 }}
                barCategoryGap="35%">
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} />
                <XAxis type="number" tickFormatter={shortCurrency}
                  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={110}
                  tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#475569' }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-xl shadow-lg px-3.5 py-2.5 text-xs"
                      style={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
                      <p className={`font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{label}</p>
                      <p className={isDark ? 'text-slate-300' : 'text-slate-700'}>Avg: {formatCurrency(payload[0].value)}</p>
                      <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>{payload[0].payload.count} transaction{payload[0].payload.count !== 1 ? 's' : ''}</p>
                    </div>
                  )
                }} />
                <Bar dataKey="avg" name="Avg Size" radius={[0, 3, 3, 0]}>
                  {avgData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                  <LabelList dataKey="avg" position="right"
                    formatter={shortCurrency}
                    style={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── Analytics (main view) ─────────────────────────────────────────────────────

export default function Analytics() {
  const {
    categories, transactions, budgets,
    currentMonthTransactions, currentMonthBudget, isDark,
  } = useApp()
  const [tab, setTab] = useState('month')

  const confirmedMonthTransactions = useMemo(
    () => currentMonthTransactions.filter(t => !t.isPending),
    [currentMonthTransactions]
  )

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        <Tab label="This Month" active={tab === 'month'} onClick={() => setTab('month')} />
        <Tab label="Trends" active={tab === 'trends'} onClick={() => setTab('trends')} />
        <Tab label="Activity" active={tab === 'activity'} onClick={() => setTab('activity')} />
      </div>

      {tab === 'month' && (
        <MonthView
          categories={categories}
          transactions={confirmedMonthTransactions}
          budget={currentMonthBudget}
          budgets={budgets}
          isDark={isDark}
        />
      )}
      {tab === 'trends' && (
        <TrendsView
          categories={categories}
          allTransactions={transactions}
          budgets={budgets}
          isDark={isDark}
        />
      )}
      {tab === 'activity' && (
        <ActivityView
          categories={categories}
          allTransactions={transactions}
          isDark={isDark}
        />
      )}
    </div>
  )
}
