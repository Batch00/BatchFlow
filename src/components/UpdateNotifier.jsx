import { useEffect, useState } from 'react'

// sessionStorage key set just before the reload so the toast appears after.
const UPDATED_KEY = 'batchflow:sw-updated'

export default function UpdateNotifier() {
  const [visible, setVisible] = useState(false)

  // ── Toast: show for 4s if we just reloaded due to an SW update ──────────────
  useEffect(() => {
    if (sessionStorage.getItem(UPDATED_KEY)) {
      sessionStorage.removeItem(UPDATED_KEY)
      setVisible(true)
      const t = setTimeout(() => setVisible(false), 4000)
      return () => clearTimeout(t)
    }
  }, [])

  // ── SW registration + update lifecycle ──────────────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let reg = null

    // Capture the controller that was active at mount time.
    // A non-null value here means a SW was already in control —
    // so any subsequent controllerchange is an *update*, not a first install.
    let prevController = navigator.serviceWorker.controller

    const doRegister = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(r => { reg = r })
        .catch(() => {})
    }

    // Defer registration until after the initial paint is complete.
    if (document.readyState === 'complete') {
      doRegister()
    } else {
      window.addEventListener('load', doRegister, { once: true })
    }

    // When a new SW takes control (skipWaiting fired), reload to apply the update.
    // Guard: only reload when there *was* a previous controller; the very first
    // SW install also fires controllerchange but prevController is null then.
    const onControllerChange = () => {
      if (prevController) {
        // Set the flag before reloading — this is the only place we call reload(),
        // so the flag is guaranteed to be written before navigation starts.
        try { sessionStorage.setItem(UPDATED_KEY, '1') } catch {}
        window.location.reload()
      }
      prevController = navigator.serviceWorker.controller
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // iOS PWA: when the app is suspended and reopened the SW never fires
    // background-sync or periodic-update events. Triggering registration.update()
    // on visibilitychange ensures the new SW is fetched and installed immediately
    // when the user switches back to the app.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && reg) {
        reg.update().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Hourly fallback for long-running desktop browser sessions.
    const poll = setInterval(() => {
      if (reg) reg.update().catch(() => {})
    }, 60 * 60 * 1000)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearInterval(poll)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 bg-slate-800 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg pointer-events-none whitespace-nowrap"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
      BatchFlow has been updated
    </div>
  )
}
