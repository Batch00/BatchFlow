import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Wallet, ArrowLeftRight, BarChart2, Tag, RefreshCw, CalendarDays, Settings, LogOut, X } from 'lucide-react'
import MonthSelector from '../common/MonthSelector'
import { useAuth } from '../../context/AuthContext'
import { LogoFull } from '../common/Logo'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/budget', icon: Wallet, label: 'Budget' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/categories', icon: Tag, label: 'Categories' },
  { to: '/recurring', icon: RefreshCw, label: 'Recurring' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ onClose }) {
  const { signOut } = useAuth()

  return (
    <div className="h-full w-64 bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-slate-700">
        <LogoFull />
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Month selector */}
      <div className="px-4 py-3 border-b border-slate-700">
        <MonthSelector />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-700 space-y-1">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut size={17} />
          Sign out
        </button>
        <p className="text-xs text-slate-600 text-center pt-1">BatchFlow v1.1.0</p>
      </div>
    </div>
  )
}
