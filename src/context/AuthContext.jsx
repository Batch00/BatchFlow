import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Start as true so the app doesn't flash the login page on load
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session from localStorage (Supabase persists it automatically)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
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

  const signUp = (email, password) =>
    supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: import.meta.env.VITE_SITE_URL },
    })

  const signOut = () => supabase.auth.signOut()

  const updateEmail = (newEmail) =>
    supabase.auth.updateUser({ email: newEmail })

  const updatePassword = (newPassword) =>
    supabase.auth.updateUser({ password: newPassword })

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateEmail, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
