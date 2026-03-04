import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useApp } from './context/AppContext'
import { loadData } from './utils/storage'
import Layout from './components/layout/Layout'
import Dashboard from './views/Dashboard'
import Budget from './views/Budget'
import Transactions from './views/Transactions'
import Analytics from './views/Analytics'
import Categories from './views/Categories'
import Recurring from './views/Recurring'
import Calendar from './views/Calendar'
import Settings from './views/Settings'
import Auth from './views/Auth'
import UpdateNotifier from './components/UpdateNotifier'

// Reads the user's defaultPage preference and redirects away from '/' if set.
function DefaultPage() {
  const defaultPage = loadData('preferences', null)?.defaultPage ?? '/'
  if (defaultPage !== '/') return <Navigate to={defaultPage} replace />
  return <Dashboard />
}

function AppRoutes() {
  const { loading } = useApp()

  // Show a blank screen while the initial Supabase fetch is in flight.
  // This is typically <500ms; avoids flashing empty views on login/refresh.
  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DefaultPage />} />
        <Route path="budget" element={<Budget />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="categories" element={<Categories />} />
        <Route path="recurring" element={<Recurring />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { user, loading: authLoading } = useAuth()

  // Hold render until Supabase has restored the session from localStorage.
  // This prevents a flash of the login page on every refresh.
  if (authLoading) return null

  return (
    <>
      <UpdateNotifier />
      {user ? <AppRoutes /> : <Auth />}
    </>
  )
}
