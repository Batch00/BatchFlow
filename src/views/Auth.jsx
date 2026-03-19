import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { LogoMark } from '../components/common/Logo'

export default function Auth() {
  const { signIn, signInAsDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleDemoSignIn() {
    setError('')
    setDemoLoading(true)
    const { error } = await signInAsDemo()
    if (error) setError(error.message)
    setDemoLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <LogoMark size={48} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">BatchFlow</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Own your flow</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Sign in</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Please wait...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>

        {import.meta.env.VITE_DEMO_EMAIL && (
          <div className="mt-4">
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
              <span className="mx-3 text-xs text-slate-400 dark:text-slate-500">or</span>
              <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
            </div>
            <button
              onClick={handleDemoSignIn}
              disabled={demoLoading || loading}
              className="mt-4 w-full py-2.5 border border-indigo-400 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 text-sm font-medium rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {demoLoading ? 'Loading demo...' : 'Try a live demo'}
            </button>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2">
              Pre-loaded with sample data. Read-only account.
            </p>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-5">
          BatchFlow is invite-only. Contact the administrator to request access.
        </p>

      </div>
    </div>
  )
}
