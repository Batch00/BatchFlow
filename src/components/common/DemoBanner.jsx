import { useState } from 'react'
import { X, Eye } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function DemoBanner() {
  const { isDemoMode } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (!isDemoMode || dismissed) return null

  return (
    <div className="shrink-0 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-start sm:items-center gap-3">
      <Eye size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
      <p className="text-sm text-amber-800 dark:text-amber-300 flex-1 min-w-0">
        Read-only demo - explore every page with live sample data. Editing is disabled.{' '}
        <a
          href="https://www.batch-apps.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100 transition-colors whitespace-nowrap"
        >
          Request access
        </a>{' '}
        to build your own budget.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-200 transition-colors shrink-0 p-2 -m-1 -mr-2"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}
