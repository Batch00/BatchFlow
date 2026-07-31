import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { formatMonthLabel } from '../../utils/formatters'

export default function MonthSelector() {
  const { currentMonth, setCurrentMonth } = useApp()

  const navigate = (dir) => {
    const [year, month] = currentMonth.split('-').map(Number)
    const d = new Date(year, month - 1 + dir)
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    )
  }

  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const isCurrentMonth = currentMonth === todayKey

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2.5 -m-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-white select-none">
          {formatMonthLabel(currentMonth)}
        </span>
        <button
          onClick={() => navigate(1)}
          className="p-2.5 -m-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {!isCurrentMonth && (
        <div className="flex justify-center mt-1">
          <button
            onClick={() => setCurrentMonth(todayKey)}
            className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded hover:bg-slate-700"
          >
            Today
          </button>
        </div>
      )}
    </div>
  )
}
