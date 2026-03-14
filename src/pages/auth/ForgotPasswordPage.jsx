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
  const [serverMessage, setServerMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await sendOtp(email)
    setLoading(false)
    if (error) { setError(error.message); return }
    setServerMessage(data?.message || '')
    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <h2 className="font-semibold text-gray-100 mb-2">Email sent</h2>
          <p className="text-xs text-gray-500 mb-4">
            If an account exists, a 6-digit reset code was sent to your email.
          </p>
          {serverMessage && (
            <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800 rounded-md px-3 py-2 mb-3">
              {serverMessage}
            </p>
          )}
          <Link to={`/auth/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`} className="text-xs text-brand-400 hover:text-brand-300">
            Continue to reset
          </Link>
          <div className="mt-3">
            <Link to="/auth/login" className="text-xs text-gray-500 hover:text-gray-300">Back to sign in</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-100 mb-1">Reset password</h2>
          <p className="text-xs text-gray-500 mb-6">Enter your email and we&apos;ll send a verification code</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button variant="primary" size="lg" loading={loading} className="w-full">Send reset code</Button>
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
  const { verifyResetCode, updatePassword } = useAuth()
  const params = new URLSearchParams(window.location.search)
  const emailParam = params.get('email') || ''
  const [email, setEmail] = useState(emailParam)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [stage, setStage] = useState('verify')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleVerify = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: verifyError } = await verifyResetCode(email, code)
    setLoading(false)
    if (verifyError) {
      setError(verifyError.message)
      return
    }
    setStage('newPassword')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: updateError } = await updatePassword(password)
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
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
          {stage === 'verify' ? (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
              <Input
                label="Reset code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button variant="primary" size="lg" loading={loading} className="w-full">Verify code</Button>
              <Link to="/auth/forgot-password" className="text-xs text-gray-500 hover:text-gray-300 text-center">
                Back
              </Link>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input label="New password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button variant="primary" size="lg" loading={loading} className="w-full">Update password</Button>
              <button
                type="button"
                onClick={() => setStage('verify')}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
