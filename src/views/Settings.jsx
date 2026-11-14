import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Download, Upload, AlertTriangle, Smartphone,
  Mail, Lock, Trash2, CheckCircle, Info,
  Sun, Moon, UserPlus, Users, Shield, RotateCcw,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { loadData, saveData } from '../utils/storage'
import { formatMonthLabel, getTodayString } from '../utils/formatters'
import { validateBackup } from '../utils/backup'
import { downloadJson, fileStamp } from '../utils/download'

const APP_VERSION = '1.3.0'

const DEFAULT_PREFS = {
  currency: 'USD',
  weekStart: 'sunday',
  defaultPage: '/',
}

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar ($)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'GBP', label: 'GBP — British Pound (£)' },
  { value: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
  { value: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { value: 'JPY', label: 'JPY — Japanese Yen (¥)' },
  { value: 'CHF', label: 'CHF — Swiss Franc (Fr)' },
  { value: 'INR', label: 'INR — Indian Rupee (₹)' },
  { value: 'MXN', label: 'MXN — Mexican Peso (MX$)' },
  { value: 'BRL', label: 'BRL — Brazilian Real (R$)' },
]

const PAGE_OPTIONS = [
  { value: '/', label: 'Dashboard' },
  { value: '/budget', label: 'Budget' },
  { value: '/transactions', label: 'Transactions' },
]

function getRecentMonths() {
  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: formatMonthLabel(key) })
  }
  return months
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

// Wraps an editing control that the read-only demo account cannot use. The reason is
// shown as persistent text rather than a hover tooltip, because hover does not exist
// on touch devices — the demo is mostly viewed on a phone.
function DemoLock({ children, active }) {
  if (!active) return children
  return (
    <div>
      <div className="opacity-40 pointer-events-none select-none" aria-hidden="true">{children}</div>
      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
        <Lock size={11} className="shrink-0" />
        Disabled in the read-only demo
      </p>
    </div>
  )
}

export default function Settings() {
  const {
    currentMonth,
    categories, transactions, budgets, recurringRules, paycheckPlans,
    readBackup, importAllData, clearMonthData,
    theme, setTheme,
  } = useApp()
  const { user, updateEmail, updatePassword, isDemoMode } = useAuth()

  // ── Install App ─────────────────────────────────────────────────────────────

  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOSSafari, setIsIOSSafari] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }
    const ua = navigator.userAgent
    const ios = /iPhone|iPad|iPod/.test(ua)
    setIsIOSSafari(ios && !/(CriOS|FxiOS|OPiOS|EdgiOS)/.test(ua))

    const onBeforeInstall = (e) => { e.preventDefault(); setInstallPrompt(e) }
    const onInstalled = () => setIsInstalled(true)
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setInstallPrompt(null)
  }

  const showInstallSection = !isInstalled && (isIOSSafari || !!installPrompt)

  // ── Account ──────────────────────────────────────────────────────────────────

  const [emailNew, setEmailNew] = useState('')
  const [emailStatus, setEmailStatus] = useState(null) // null | 'loading' | 'sent' | 'error'
  const [emailError, setEmailError] = useState('')

  const [passNew, setPassNew] = useState('')
  const [passConfirm, setPassConfirm] = useState('')
  const [passStatus, setPassStatus] = useState(null) // null | 'loading' | 'saved' | 'error'
  const [passError, setPassError] = useState('')

  async function handleEmailChange(e) {
    e.preventDefault()
    if (isDemoMode) return
    if (!emailNew.trim()) return
    setEmailStatus('loading')
    setEmailError('')
    const { error } = await updateEmail(emailNew.trim())
    if (error) { setEmailStatus('error'); setEmailError(error.message) }
    else { setEmailStatus('sent'); setEmailNew('') }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    if (isDemoMode) return
    if (!passNew) return
    if (passNew !== passConfirm) {
      setPassStatus('error')
      setPassError('Passwords do not match.')
      return
    }
    if (passNew.length < 6) {
      setPassStatus('error')
      setPassError('Password must be at least 6 characters.')
      return
    }
    setPassStatus('loading')
    setPassError('')
    const { error } = await updatePassword(passNew)
    if (error) { setPassStatus('error'); setPassError(error.message) }
    else { setPassStatus('saved'); setPassNew(''); setPassConfirm('') }
  }

  // ── Preferences ──────────────────────────────────────────────────────────────

  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...loadData('preferences', {}) }))
  const [prefsSaved, setPrefsSaved] = useState(false)

  function handlePrefChange(key, value) {
    setPrefs(p => ({ ...p, [key]: value }))
    setPrefsSaved(false)
  }

  function handleSavePrefs() {
    if (isDemoMode) return
    saveData('preferences', prefs)
    setPrefsSaved(true)
    setTimeout(() => setPrefsSaved(false), 2500)
  }

  // ── Data Management ───────────────────────────────────────────────────────────

  const [importState, setImportState] = useState(null) // null | { data, check } | 'error'
  const [importing, setImporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [errorList, setErrorList] = useState([])
  const [restoreResult, setRestoreResult] = useState(null) // null | { error, changed }
  const fileInputRef = useRef(null)

  // Backups are read from the database ahead of the click, so the click itself
  // can start the download synchronously (see utils/download.js). Each read has
  // an id so a slower earlier read never overwrites a newer one.
  // { status: 'preparing' | 'ready' | 'error', backup, error }
  const [exportCopy, setExportCopy] = useState({ status: 'preparing', backup: null, error: '' })
  const exportReadId = useRef(0)
  // Safety copy for a restore, read once a file has passed validation. null when no file.
  const [safety, setSafety] = useState(null)
  const safetyReadId = useRef(0)

  const recentMonths = getRecentMonths()
  const [clearMonthKey, setClearMonthKey] = useState(currentMonth)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [clearDone, setClearDone] = useState(false)
  const [clearError, setClearError] = useState(false)

  const prepareExport = useCallback(async () => {
    const id = ++exportReadId.current
    setExportCopy({ status: 'preparing', backup: null, error: '' })
    const { error, backup } = await readBackup()
    if (id !== exportReadId.current) return
    setExportCopy(error ? { status: 'error', backup: null, error } : { status: 'ready', backup, error: '' })
  }, [readBackup])

  // Read on mount, and again whenever the loaded data changes (an edit here,
  // a clear month, or a realtime update from another tab), so the prepared
  // export is never older than what the app shows.
  useEffect(() => {
    prepareExport()
  }, [prepareExport, categories, transactions, budgets, recurringRules, paycheckPlans])

  function handleExport() {
    if (exportCopy.status === 'error') { prepareExport(); return }
    if (exportCopy.status !== 'ready') return
    downloadJson(exportCopy.backup, `batchflow-backup-${getTodayString()}.json`)
  }

  async function prepareSafetyCopy() {
    const id = ++safetyReadId.current
    setSafety({ status: 'preparing', backup: null, error: '' })
    const { error, backup } = await readBackup()
    if (id !== safetyReadId.current) return
    setSafety(error ? { status: 'error', backup: null, error } : { status: 'ready', backup, error: '' })
  }

  function discardSafetyCopy() {
    safetyReadId.current++
    setSafety(null)
  }

  function handleFileChange(e) {
    if (isDemoMode) return
    const file = e.target.files[0]
    if (!file) return
    setRestoreResult(null)
    discardSafetyCopy()
    const reader = new FileReader()
    reader.onload = (ev) => {
      let data
      try {
        data = JSON.parse(ev.target.result)
      } catch {
        setErrorMsg('Could not parse the file. Make sure it is a valid JSON file.')
        setErrorList([])
        setImportState('error')
        return
      }
      const check = validateBackup(data, { existingRuleIds: recurringRules.map(r => r.id) })
      if (!check.ok) {
        setErrorMsg('This file cannot be restored. Nothing was changed.')
        setErrorList(check.errors)
        setImportState('error')
        return
      }
      setImportState({ data, check })
      prepareSafetyCopy()
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Not async on purpose: the safety copy download has to start before any
  // await, while the browser still counts it as part of the click.
  function handleConfirmImport() {
    if (isDemoMode || importing || safety?.status !== 'ready') return
    downloadJson(safety.backup, `batchflow-pre-restore-safety-copy-${fileStamp()}.json`)
    setImporting(true)
    setRestoreResult(null)
    importAllData(importState.data)
      .then(result => {
        // On success importAllData reloads the page, so only failures get here.
        setImporting(false)
        if (result?.error) setRestoreResult(result)
      })
      .catch(err => {
        setImporting(false)
        setRestoreResult({ error: err?.message || 'The restore failed.', changed: 'unknown' })
      })
  }

  function handleCancelImport() {
    discardSafetyCopy()
    setImportState(null)
    setErrorMsg('')
    setErrorList([])
    setRestoreResult(null)
  }

  async function handleClearMonth() {
    if (isDemoMode) return
    setClearLoading(true)
    setClearError(false)
    const result = await clearMonthData(clearMonthKey)
    setClearLoading(false)
    setClearConfirm(false)
    if (result?.error) {
      setClearError(true)
      return
    }
    setClearDone(true)
    setTimeout(() => setClearDone(false), 3000)
  }

  // ── Admin Access Control ──────────────────────────────────────────────────────

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin = user?.email === adminEmail

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState(null) // null | 'loading' | 'sent' | 'error'
  const [inviteError, setInviteError] = useState('')
  const [lastInvitedEmail, setLastInvitedEmail] = useState('')

  const [invitedUsers, setInvitedUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [revokeConfirmId, setRevokeConfirmId] = useState(null)
  const [revokingId, setRevokingId] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    loadInvitedUsers()
  }, [isAdmin])

  async function loadInvitedUsers() {
    setUsersLoading(true)
    setUsersError('')
    const { data, error } = await supabase.functions.invoke('admin-list-users')
    if (error) {
      setUsersError('Could not reach admin-list-users function. Make sure it is deployed and the ADMIN_EMAIL secret is set.')
    } else if (data?.error) {
      setUsersError(data.error)
    } else if (data?.users) {
      setInvitedUsers(data.users)
    }
    setUsersLoading(false)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteStatus('loading')
    setInviteError('')
    const { data, error } = await supabase.functions.invoke('admin-invite', {
      body: { email: inviteEmail.trim() },
    })
    if (error) {
      setInviteStatus('error')
      setInviteError('Could not reach admin-invite function. Make sure it is deployed and the ADMIN_EMAIL secret is set.')
    } else if (data?.error) {
      setInviteStatus('error')
      setInviteError(data.error)
    } else {
      setLastInvitedEmail(inviteEmail.trim())
      setInviteStatus('sent')
      setInviteEmail('')
      await loadInvitedUsers()
    }
  }

  const [demoRefreshStatus, setDemoRefreshStatus] = useState(null) // null | 'loading' | 'done' | 'error'
  const [demoRefreshError, setDemoRefreshError] = useState('')
  const [demoRefreshInfo, setDemoRefreshInfo] = useState(null)

  async function handleDemoRefresh() {
    setDemoRefreshStatus('loading')
    setDemoRefreshError('')
    setDemoRefreshInfo(null)
    const { data, error } = await supabase.functions.invoke('refresh-demo-data')
    if (error) {
      setDemoRefreshStatus('error')
      setDemoRefreshError('Could not reach refresh-demo-data function. Make sure it is deployed.')
    } else if (data?.error) {
      setDemoRefreshStatus('error')
      setDemoRefreshError(data.error)
    } else {
      setDemoRefreshStatus('done')
      setDemoRefreshInfo(data?.result ?? null)
      setTimeout(() => setDemoRefreshStatus(null), 6000)
    }
  }

  async function handleRevoke(userId) {
    setRevokingId(userId)
    const { data, error } = await supabase.functions.invoke('admin-revoke', {
      body: { userId },
    })
    if (!error && !data?.error) {
      setInvitedUsers(prev => prev.filter(u => u.id !== userId))
    }
    setRevokingId(null)
    setRevokeConfirmId(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Install App ──────────────────────────────────────────────── */}
      {showInstallSection && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Install App</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            {isIOSSafari ? (
              // iOS Safari doesn't support programmatic install prompts — show instructions
              <div>
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg shrink-0">
                    <Smartphone size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Add BatchFlow to your Home Screen</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Follow these steps in Safari to install the app.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    {
                      step: '1',
                      text: 'Tap the Share button',
                      detail: 'The box with an arrow pointing up at the bottom of Safari',
                    },
                    {
                      step: '2',
                      text: 'Scroll down and tap "Add to Home Screen"',
                      detail: null,
                    },
                    {
                      step: '3',
                      text: 'Tap "Add" in the top-right corner',
                      detail: 'BatchFlow will appear on your Home Screen like a native app',
                    },
                  ].map(({ step, text, detail }) => (
                    <div key={step} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {step}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{text}</p>
                        {detail && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Chrome / Edge — fire the captured beforeinstallprompt
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Install BatchFlow</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Install BatchFlow as an app on this device for a faster, full-screen experience without a browser bar.
                  </p>
                </div>
                <button
                  onClick={handleInstall}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
                >
                  <Smartphone size={15} />
                  Install
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Appearance ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Appearance</h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Theme</label>
          <div className="flex gap-2">
            {[
              { value: 'light', label: 'Light', Icon: Sun },
              { value: 'dark', label: 'Dark', Icon: Moon },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 text-sm font-medium rounded-lg border transition-colors ${
                  theme === value
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Account ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Account</h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">

          {/* Signed in as */}
          <div className="px-6 py-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Signed in as</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{user?.email}</p>
          </div>

          {/* Change email */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Mail size={14} className="text-slate-400" />
              Change Email
            </h3>
            <DemoLock active={isDemoMode}>
              <form onSubmit={handleEmailChange} className="flex gap-2">
                <input
                  type="email"
                  value={emailNew}
                  onChange={e => { setEmailNew(e.target.value); setEmailStatus(null) }}
                  placeholder="New email address"
                  className="flex-1 min-w-0 text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={!emailNew.trim() || emailStatus === 'loading'}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {emailStatus === 'loading' ? 'Sending…' : 'Update'}
                </button>
              </form>
            </DemoLock>
            {emailStatus === 'sent' && (
              <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1.5">
                <CheckCircle size={14} /> Check your inbox to confirm the new address.
              </p>
            )}
            {emailStatus === 'error' && (
              <p className="mt-2 text-sm text-red-600">{emailError}</p>
            )}
          </div>

          {/* Change password */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Lock size={14} className="text-slate-400" />
              Change Password
            </h3>
            <DemoLock active={isDemoMode}>
              <form onSubmit={handlePasswordChange} className="space-y-2">
                <input
                  type="password"
                  value={passNew}
                  onChange={e => { setPassNew(e.target.value); setPassStatus(null) }}
                  placeholder="New password"
                  className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={passConfirm}
                    onChange={e => { setPassConfirm(e.target.value); setPassStatus(null) }}
                    placeholder="Confirm new password"
                    className="flex-1 min-w-0 text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={!passNew || !passConfirm || passStatus === 'loading'}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {passStatus === 'loading' ? 'Saving…' : 'Update'}
                  </button>
                </div>
              </form>
            </DemoLock>
            {passStatus === 'saved' && (
              <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1.5">
                <CheckCircle size={14} /> Password updated.
              </p>
            )}
            {passStatus === 'error' && (
              <p className="mt-2 text-sm text-red-600">{passError}</p>
            )}
          </div>

        </div>
      </section>

      {/* ── Access Control (admin only) ──────────────────────────────── */}
      {isAdmin && (
        <section>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Shield size={11} />
            Access Control
          </h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">

            {/* Invite */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <UserPlus size={14} className="text-slate-400" />
                Invite User
              </h3>
              <form onSubmit={handleInvite} className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteStatus(null) }}
                  placeholder="user@example.com"
                  className="flex-1 min-w-0 text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  disabled={!inviteEmail.trim() || inviteStatus === 'loading'}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {inviteStatus === 'loading' ? 'Sending…' : 'Send Invite'}
                </button>
              </form>
              {inviteStatus === 'sent' && (
                <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle size={14} /> Invite sent to {lastInvitedEmail}.
                </p>
              )}
              {inviteStatus === 'error' && (
                <p className="mt-2 text-sm text-red-600">{inviteError}</p>
              )}
            </div>

            {/* User list */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Users size={14} className="text-slate-400" />
                Invited Users
              </h3>
              {usersLoading ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : usersError ? (
                <p className="text-sm text-red-600">{usersError}</p>
              ) : invitedUsers.length === 0 ? (
                <p className="text-sm text-slate-400">No invited users yet.</p>
              ) : (
                <ul className="space-y-1">
                  {invitedUsers.map(u => (
                    <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{u.email}</p>
                        <p className="text-xs text-slate-400">
                          {u.confirmed_at ? 'Active' : 'Pending invitation'}
                          {u.last_sign_in_at && ` · Last seen ${new Date(u.last_sign_in_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      {revokeConfirmId === u.id ? (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleRevoke(u.id)}
                            disabled={revokingId === u.id}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
                          >
                            {revokingId === u.id ? '…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setRevokeConfirmId(null)}
                            className="px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRevokeConfirmId(u.id)}
                          className="px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shrink-0"
                        >
                          Revoke
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

          {/* Demo data top-up */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <RotateCcw size={14} className="text-slate-400" />
              Demo Data Refresh
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Tops the demo account up so it always shows a full trailing 13 months ending
              with the current month, and prunes anything older than 18 months. Existing
              months are left untouched. Runs automatically on the 1st of each month at
              03:00 UTC; this button only backfills what is missing.
            </p>
            <button
              onClick={handleDemoRefresh}
              disabled={demoRefreshStatus === 'loading'}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw size={14} className={demoRefreshStatus === 'loading' ? 'animate-spin' : ''} />
              {demoRefreshStatus === 'loading' ? 'Refreshing…' : 'Run Now'}
            </button>
            {demoRefreshStatus === 'done' && (
              <p className="mt-2 text-sm text-emerald-600 flex items-start gap-1.5">
                <CheckCircle size={14} className="mt-0.5 shrink-0" />
                <span>{demoRefreshInfo || 'Demo data is up to date.'}</span>
              </p>
            )}
            {demoRefreshStatus === 'error' && (
              <p className="mt-2 text-sm text-red-600">{demoRefreshError}</p>
            )}
          </div>

          </div>
        </section>
      )}

      {/* ── Preferences ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Preferences</h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Currency</label>
            <select
              value={prefs.currency}
              onChange={e => handlePrefChange('currency', e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              {CURRENCIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* First day of week */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">First Day of Week</label>
            <div className="flex gap-2">
              {['sunday', 'monday'].map(day => (
                <button
                  key={day}
                  onClick={() => handlePrefChange('weekStart', day)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${
                    prefs.weekStart === day
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'
                  }`}
                >
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Default landing page */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Default Landing Page</label>
            <select
              value={prefs.defaultPage}
              onChange={e => handlePrefChange('defaultPage', e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              {PAGE_OPTIONS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <DemoLock active={isDemoMode}>
            <button
              onClick={handleSavePrefs}
              className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                prefsSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {prefsSaved ? 'Preferences saved!' : 'Save Preferences'}
            </button>
          </DemoLock>
        </div>
      </section>

      {/* ── Data Management ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Data Management</h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">

          {/* Export */}
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Export Backup</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Download a full JSON backup of your categories, transactions, budgets, recurring rules, and paycheck plans.
                </p>
              </div>
              <button
                onClick={handleExport}
                disabled={exportCopy.status === 'preparing'}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Download size={15} />
                {exportCopy.status === 'preparing' ? 'Preparing…'
                  : exportCopy.status === 'error' ? 'Retry' : 'Export JSON'}
              </button>
            </div>
            {exportCopy.status === 'error' && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300 min-w-0 break-words">
                  Could not read your data for the export: {exportCopy.error}
                </p>
              </div>
            )}
          </div>

          {/* Import */}
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Import Backup</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Restore from a previously exported JSON backup. This replaces all current data. A safety copy of your current data is downloaded first.
                </p>
              </div>
              <DemoLock active={isDemoMode}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0"
                >
                  <Upload size={15} />
                  Choose File
                </button>
              </DemoLock>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {importState === 'error' && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-red-700 dark:text-red-300">{errorMsg}</p>
                  {errorList.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-red-700 dark:text-red-300 break-words">
                      {errorList.map((msg, i) => <li key={i}>{msg}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {importState && importState !== 'error' && (() => {
              const { check } = importState
              const c = check.counts
              const exportedAt = importState.data.exportedAt
              return (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    This will replace all current data. A safety copy of your current data is downloaded first.
                  </p>
                </div>
                <ul className="text-sm text-slate-600 dark:text-slate-300 mb-1 ml-5 space-y-0.5">
                  <li>{plural(c.categories, 'category', 'categories')}, {plural(c.subcategories, 'subcategory', 'subcategories')}</li>
                  <li>
                    {plural(c.transactions, 'transaction', 'transactions')}
                    {check.pending > 0 && ` (${check.pending} pending)`}
                    , {plural(c.transaction_splits, 'split row', 'split rows')}
                  </li>
                  <li>{plural(c.budget_plans, 'budget plan', 'budget plans')}</li>
                  {c.recurring_rules !== null && <li>{plural(c.recurring_rules, 'recurring rule', 'recurring rules')}</li>}
                  {c.paycheck_plans !== null && <li>{plural(c.paycheck_plans, 'paycheck plan', 'paycheck plans')}</li>}
                  {check.droppedBudgetEntries > 0 && (
                    <li>
                      {plural(check.droppedBudgetEntries, 'budget entry', 'budget entries')} skipped: the category or subcategory is not in the file
                    </li>
                  )}
                </ul>
                {exportedAt && (
                  <p className="text-xs text-slate-400 mb-2 ml-5">
                    Exported {new Date(exportedAt).toLocaleString()}
                  </p>
                )}
                {check.version === 1 && (
                  <div className="mt-3 ml-5 p-3 bg-white/60 dark:bg-slate-800/60 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 space-y-1">
                    <p className="font-medium">This is an older (version 1) backup.</p>
                    <p>It has no recurring rules or paycheck plans.</p>
                    <p>Pending items stay pending when the file recorded them. A pending item keeps its recurring rule link only if that rule is still in your account.</p>
                    <p>Your existing recurring rules and paycheck plans are kept, but the recurring rules lose their category links.</p>
                  </div>
                )}
                {safety?.status === 'error' && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 text-sm text-red-700 dark:text-red-300 break-words space-y-1">
                      <p>Could not read your current data for the safety copy: {safety.error}</p>
                      <p className="font-medium">The restore cannot start without a safety copy. Nothing was changed.</p>
                      <button
                        onClick={prepareSafetyCopy}
                        className="mt-1 px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}
                {restoreResult && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 text-sm text-red-700 dark:text-red-300 break-words space-y-1">
                      <p>{restoreResult.error}</p>
                      {restoreResult.changed === false && (
                        <p className="font-medium">Nothing was changed.</p>
                      )}
                      {restoreResult.changed === 'unknown' && (
                        <p className="font-medium">
                          The server did not reply, so it is not known whether the restore ran. Reload to check. The safety copy was downloaded.
                        </p>
                      )}
                      {restoreResult.changed === true && (
                        <>
                          <p className="font-medium">
                            The restore ran, but the counts above do not match what was saved. Your previous data is in the safety copy that was downloaded.
                          </p>
                          <button
                            onClick={() => window.location.reload()}
                            className="mt-1 px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                          >
                            Reload
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleConfirmImport}
                    // Enabled only once the safety copy is in hand. After a restore that
                    // may have run, the next step is a reload, not a retry.
                    disabled={
                      importing || safety?.status !== 'ready' ||
                      (restoreResult && restoreResult.changed !== false)
                    }
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {importing ? 'Importing…'
                      : safety?.status === 'preparing' ? 'Preparing safety copy…' : 'Confirm Import'}
                  </button>
                  <button
                    onClick={handleCancelImport}
                    disabled={importing}
                    className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              )
            })()}
          </div>

          {/* Clear month */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Clear Month Data</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Delete all transactions and budget plans for a specific month.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={clearMonthKey}
                onChange={e => { setClearMonthKey(e.target.value); setClearConfirm(false); setClearDone(false); setClearError(false) }}
                className="flex-1 min-w-0 text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                {recentMonths.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              <DemoLock active={isDemoMode}>
                {!clearConfirm ? (
                  <button
                    onClick={() => setClearConfirm(true)}
                    className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                ) : (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={handleClearMonth}
                      disabled={clearLoading}
                      className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
                    >
                      {clearLoading ? '…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setClearConfirm(false)}
                      className="px-3 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </DemoLock>
            </div>
            {clearDone && (
              <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1.5">
                <CheckCircle size={14} /> Data cleared for {formatMonthLabel(clearMonthKey)}.
              </p>
            )}
            {clearError && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  Could not clear data for {formatMonthLabel(clearMonthKey)}. Reload the page to see what remains, then try again.
                </p>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">About</h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg shrink-0">
              <Info size={18} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                BatchFlow <span className="font-normal text-slate-400 dark:text-slate-500">v{APP_VERSION}</span>
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 italic">Own your flow.</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                BatchFlow is a Progressive Web App (PWA) - it can be installed on any device directly from your browser, no app store required.
              </p>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
