import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '@/lib/api'

const AuthContext = createContext(null)
const SESSION_KEY = 'coreinventory.session'
const RESET_EMAIL_KEY = 'coreinventory.reset_email'
const TOKEN_KEY = 'coreinventory.token'
const RESET_TOKEN_KEY = 'coreinventory.reset_token'

const normalizeEmail = (email = '') => email.trim().toLowerCase()
const toAuthError = (err) => ({ message: err?.message || 'Authentication failed' })

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(undefined) // undefined = loading
  const [profile, setProfile]   = useState(null)

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY)
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      localStorage.removeItem(SESSION_KEY)
      setSession(null)
      setProfile(null)
      return
    }

    if (!raw) {
      localStorage.removeItem(TOKEN_KEY)
      setSession(null)
      setProfile(null)
      return
    }

    try {
      const parsed = JSON.parse(raw)
      setSession(parsed)
      setProfile(parsed)
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(SESSION_KEY)
      setSession(null)
      setProfile(null)
    }
  }, [])

  // ─── Actions ───────────────────────────────────────────────
  const signUp = async (emailOrPayload, maybePassword) => {
    const payload = typeof emailOrPayload === 'object'
      ? emailOrPayload
      : { email: emailOrPayload, password: maybePassword }

    try {
      const email = normalizeEmail(payload.email)
      const password = payload.password
      const name = payload.name?.trim()

      const role = payload.role === 'manager' ? 'manager' : 'staff'
      const data = await api.post('/auth/signup', { email, password, name: name || undefined, role })
      return { data: data?.user || true }
    } catch (err) {
      return { error: toAuthError(err) }
    }
  }

  const signIn = async (email, password) => {
    try {
      const normalizedEmail = normalizeEmail(email)
      const { user, token } = await api.post('/auth/login', { email: normalizedEmail, password })
      if (!token) throw new Error('Missing access token')
      setSession(user)
      setProfile(user)
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(SESSION_KEY, JSON.stringify(user))
      return { data: user }
    } catch (err) {
      return { error: toAuthError(err) }
    }
  }

  const signOut = () => {
    setSession(null)
    setProfile(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(RESET_EMAIL_KEY)
    localStorage.removeItem(RESET_TOKEN_KEY)
  }

  const sendOtp = async (email) => {
    try {
      const normalized = normalizeEmail(email)
      const data = await api.post('/auth/forgot-password', { email: normalized })
      localStorage.setItem(RESET_EMAIL_KEY, normalized)
      return { data }
    } catch (err) {
      return { error: toAuthError(err) }
    }
  }

  const verifyResetCode = async (email, code) => {
    try {
      const normalized = normalizeEmail(email)
      const { resetToken } = await api.post('/auth/verify-reset-code', { email: normalized, code })
      localStorage.setItem(RESET_EMAIL_KEY, normalized)
      localStorage.setItem(RESET_TOKEN_KEY, resetToken)
      return { data: true }
    } catch (err) {
      return { error: toAuthError(err) }
    }
  }

  const updatePassword = async (newPassword) => {
    try {
      if (session?.id) {
        await api.post('/auth/update-password', { newPassword })
        return { data: true }
      }

      const resetToken = localStorage.getItem(RESET_TOKEN_KEY)
      if (!resetToken) return { error: { message: 'Reset session expired. Request a new code.' } }
      await api.post('/auth/reset-password', { resetToken, newPassword })
      return { data: true }
    } catch (err) {
      return { error: toAuthError(err) }
    } finally {
      localStorage.removeItem(RESET_EMAIL_KEY)
      localStorage.removeItem(RESET_TOKEN_KEY)
    }
  }

  // ─── Derived state ─────────────────────────────────────────
  const loading = session === undefined
  const user    = session ?? null

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signUp, signIn, signOut, sendOtp, verifyResetCode, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
