import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function ForgotPasswordPage() {
  const { sendOtp }  = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await sendOtp(email)
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <h2 className="font-semibold text-gray-100 mb-2">Email sent</h2>
          <p className="text-xs text-gray-500 mb-4">
            Check your inbox for a password reset link.
          </p>
          <Link to="/auth/login" className="text-xs text-brand-400 hover:text-brand-300">Back to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-100 mb-1">Reset password</h2>
          <p className="text-xs text-gray-500 mb-6">Enter your email and we'll send a reset link</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button variant="primary" size="lg" loading={loading} className="w-full">Send reset link</Button>
          </form>
          <p className="text-xs text-gray-600 text-center mt-4">
            <Link to="/auth/login" className="text-brand-400 hover:text-brand-300">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await updatePassword(password)
    setLoading(false)
    setDone(true)
  }

  if (done) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="card p-8 max-w-sm w-full text-center">
        <h2 className="font-semibold text-gray-100 mb-2">Password updated</h2>
        <Link to="/auth/login" className="text-xs text-brand-400 hover:text-brand-300">Sign in</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-100 mb-4">Set new password</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="New password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
            <Button variant="primary" size="lg" loading={loading} className="w-full">Update password</Button>
          </form>
        </div>
      </div>
    </div>
  )
}
