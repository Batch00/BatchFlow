import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function DemoBanner() {
  const { isDemoMode } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (!isDemoMode || dismissed) return null

  return (
    <div className="shrink-0 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3">
      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
        <strong>Demo mode</strong> — Changes are visible to all demo users and data resets nightly.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-200 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}
