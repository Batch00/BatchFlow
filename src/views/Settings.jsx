import { useState, useEffect, useRef } from 'react'
import {
  Download, Upload, AlertTriangle, Smartphone,
  Mail, Lock, Trash2, CheckCircle, Info,
  Sun, Moon, UserPlus, Users, Shield,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { loadData, saveData } from '../utils/storage'
import { formatMonthLabel } from '../utils/formatters'

const APP_VERSION = '1.2.0'

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

function isValidBackup(data) {
  return (
    data !== null &&
    typeof data === 'object' &&
    Array.isArray(data.categories) &&
    Array.isArray(data.transactions) &&
    typeof data.budgets === 'object' &&
    data.budgets !== null &&
    typeof data.currentMonth === 'string'
  )
}

export default function Settings() {
  const {
    categories, transactions, budgets, currentMonth,
    importAllData, clearMonthData, clearAllData,
    theme, setTheme,
  } = useApp()
  const { user, updateEmail, updatePassword, signOut } = useAuth()

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

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function handleEmailChange(e) {
    e.preventDefault()
    if (!emailNew.trim()) return
    setEmailStatus('loading')
    setEmailError('')
    const { error } = await updateEmail(emailNew.trim())
    if (error) { setEmailStatus('error'); setEmailError(error.message) }
    else { setEmailStatus('sent'); setEmailNew('') }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
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

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return
    setDeleteLoading(true)
    await clearAllData()
    await signOut()
  }

  // ── Preferences ──────────────────────────────────────────────────────────────

  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...loadData('preferences', {}) }))
  const [prefsSaved, setPrefsSaved] = useState(false)

  function handlePrefChange(key, value) {
    setPrefs(p => ({ ...p, [key]: value }))
    setPrefsSaved(false)
  }

  function handleSavePrefs() {
    saveData('preferences', prefs)
    setPrefsSaved(true)
    setTimeout(() => setPrefsSaved(false), 2500)
  }

  // ── Data Management ───────────────────────────────────────────────────────────

  const [importState, setImportState] = useState(null) // null | { data, stats } | 'error'
  const [importing, setImporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef(null)

  const recentMonths = getRecentMonths()
  const [clearMonthKey, setClearMonthKey] = useState(currentMonth)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [clearDone, setClearDone] = useState(false)

  function handleExport() {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      currentMonth,
      categories,
      transactions,
      budgets,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batchflow-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!isValidBackup(data)) {
          setErrorMsg('File is not a valid BatchFlow backup.')
          setImportState('error')
          return
        }
        setImportState({
          data,
          stats: {
            transactions: data.transactions.length,
            categories: data.categories.length,
            months: Object.keys(data.budgets).length,
            exportedAt: data.exportedAt ?? null,
          },
        })
      } catch {
        setErrorMsg('Could not parse the file. Make sure it is a valid JSON file.')
        setImportState('error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleConfirmImport() {
    setImporting(true)
    await importAllData(importState.data)
    // importAllData calls window.location.reload() on completion
  }

  function handleCancelImport() {
    setImportState(null)
    setErrorMsg('')
  }

  async function handleClearMonth() {
    setClearLoading(true)
    await clearMonthData(clearMonthKey)
    setClearLoading(false)
    setClearConfirm(false)
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Install BatchFlow</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Install BatchFlow as an app on this device for a faster, full-screen experience without a browser bar.
                  </p>
                </div>
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
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
                    <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                      <div className="min-w-0">
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
        </div>
      </section>

      {/* ── Data Management ──────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Data Management</h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">

          {/* Export */}
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Export Backup</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Download a full JSON backup of all your transactions, budgets, and categories.
                </p>
              </div>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
              >
                <Download size={15} />
                Export JSON
              </button>
            </div>
          </div>

          {/* Import */}
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Import Backup</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Restore from a previously exported JSON backup. This will overwrite all current data.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0"
              >
                <Upload size={15} />
                Choose File
              </button>
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
                <p className="text-sm text-red-700 dark:text-red-300">{errorMsg}</p>
              </div>
            )}

            {importState && importState !== 'error' && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    This will replace all current data and cannot be undone.
                  </p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 ml-5">
                  <strong>{importState.stats.transactions}</strong> transaction{importState.stats.transactions !== 1 ? 's' : ''},
                  {' '}<strong>{importState.stats.categories}</strong> categor{importState.stats.categories !== 1 ? 'ies' : 'y'},
                  {' '}<strong>{importState.stats.months}</strong> budget month{importState.stats.months !== 1 ? 's' : ''}
                </p>
                {importState.stats.exportedAt && (
                  <p className="text-xs text-slate-400 mb-4 ml-5">
                    Exported {new Date(importState.stats.exportedAt).toLocaleString()}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {importing ? 'Importing…' : 'Confirm Import'}
                  </button>
                  <button
                    onClick={handleCancelImport}
                    className="px-4 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clear month */}
          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Clear Month Data</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              Delete all transactions and budget plans for a specific month.
            </p>
            <div className="flex gap-2">
              <select
                value={clearMonthKey}
                onChange={e => { setClearMonthKey(e.target.value); setClearConfirm(false); setClearDone(false) }}
                className="flex-1 min-w-0 text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                {recentMonths.map(m => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
              {!clearConfirm ? (
                <button
                  onClick={() => setClearConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shrink-0"
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
            </div>
            {clearDone && (
              <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1.5">
                <CheckCircle size={14} /> Data cleared for {formatMonthLabel(clearMonthKey)}.
              </p>
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

      {/* ── Danger Zone ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-3">Danger Zone</h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900 p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Permanently delete all your data and sign out. This cannot be undone.
          </p>
          {!deleteOpen ? (
            <button
              onClick={() => setDeleteOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={14} />
              Delete Account Data
            </button>
          ) : (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-300">
                  This will delete all transactions, budgets, and categories, then sign you out.
                  Type <strong>DELETE</strong> to confirm.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="Type DELETE"
                  className="flex-1 min-w-0 text-sm px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== 'DELETE' || deleteLoading}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {deleteLoading ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  onClick={() => { setDeleteOpen(false); setDeleteInput('') }}
                  className="px-3 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors shrink-0"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
