import { getProgressPercent, getProgressStatus } from '../../utils/budgetUtils'
import { formatCurrency } from '../../utils/formatters'

const barColors = {
  good: 'bg-emerald-500',
  warning: 'bg-amber-400',
  over: 'bg-red-500',
  none: 'bg-slate-300',
}

// type: 'expense' (default) | 'income'
// pending: optional confirmed-but-unconfirmed amount to show as a lighter preview segment
export default function ProgressBar({ spent, planned, type = 'expense', pending = 0, showLabels = true, compact = false }) {
  const confirmedPercent = getProgressPercent(spent, planned)
  const status = getProgressStatus(spent, planned, type)

  // Pending segment fills remaining bar space (never pushes past 100%)
  const remainingPercent = Math.max(0, 100 - confirmedPercent)
  const pendingPercent = planned > 0
    ? Math.min(remainingPercent, Math.round((pending / planned) * 100))
    : 0

  const remaining = (planned ?? 0) - (spent ?? 0)
  // Use a small epsilon so floating-point drift never shows red at exactly $0.00
  const isOver = remaining < -0.01
  const isIncome = type === 'income'

  return (
    <div>
      <div className={`w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden ${compact ? 'h-1.5' : 'h-2'}`}>
        <div className="flex h-full">
          {/* Confirmed spent segment */}
          {confirmedPercent > 0 && (
            <div
              className={`h-full transition-all duration-300 ${barColors[status]}`}
              style={{ width: `${confirmedPercent}%` }}
            />
          )}
          {/* Pending (unconfirmed) preview segment — same color at reduced opacity */}
          {pendingPercent > 0 && (
            <div
              className={`h-full transition-all duration-300 ${barColors[status]} opacity-40`}
              style={{ width: `${pendingPercent}%` }}
            />
          )}
        </div>
      </div>
      {showLabels && !compact && (
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
          <span>
            {formatCurrency(spent)} {isIncome ? 'received' : 'spent'}
            {pending > 0.01 && (
              <> · <span className="text-amber-500 dark:text-amber-400">{formatCurrency(pending)} pending</span></>
            )}
          </span>
          <span className={isOver ? 'text-red-500 font-medium' : ''}>
            {isOver
              ? `${formatCurrency(Math.abs(remaining))} over`
              : `${formatCurrency(Math.max(0, remaining))} left`}
          </span>
        </div>
      )}
    </div>
  )
}
