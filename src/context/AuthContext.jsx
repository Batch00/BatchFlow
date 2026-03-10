import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Start as true so the app doesn't flash the login page on load
  const [loading, setLoading] = useState(true)
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false)

  useEffect(() => {
    // Read the hash BEFORE calling getSession() — supabase-js doesn't clear it
    // automatically, but we want to capture it before any navigation removes it.
    const isInviteLink = window.location.hash.includes('type=invite')

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session && isInviteLink) {
        setNeedsPasswordSetup(true)
        // Strip the token hash from the URL so a hard refresh doesn't re-trigger this
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      setLoading(false)
    })

    // Keep user state in sync with Supabase auth events (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  // signUp is intentionally absent — account creation is invite-only.
  // New users are created exclusively via the admin invite flow in Settings.

  const signOut = () => supabase.auth.signOut()

  const updateEmail = (newEmail) =>
    supabase.auth.updateUser({ email: newEmail })

  const updatePassword = (newPassword) =>
    supabase.auth.updateUser({ password: newPassword })

  const clearNeedsPasswordSetup = () => setNeedsPasswordSetup(false)

  return (
    <AuthContext.Provider value={{
      user, loading,
      needsPasswordSetup, clearNeedsPasswordSetup,
      signIn, signOut, updateEmail, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
