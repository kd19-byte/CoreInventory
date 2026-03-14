import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthShell } from '@/pages/auth/AuthShell'

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid work email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export default function LoginPage() {
  const { signIn, session } = useAuth()
  const navigate   = useNavigate()
  const location   = useLocation()
  const [authError, setAuthError] = useState('')
  const signupSuccess = location.state?.signupSuccess === true
  const signupEmail = typeof location.state?.registeredEmail === 'string'
    ? location.state.registeredEmail
    : ''

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: signupEmail,
    },
  })

  if (session) return <Navigate to="/dashboard" replace />

  const onSubmit = async ({ email, password }) => {
    setAuthError('')
    const { error } = await signIn(email, password)
    if (error) { setAuthError(error.message); return }
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthShell
      title="Sign in to your workspace"
      subtitle="Access live inventory, operations, and stock visibility across all locations."
      footer={(
        <p>
          No account yet?{' '}
          <Link to="/auth/signup" className="font-medium text-brand-300 hover:text-brand-200">
            Create one
          </Link>
        </p>
      )}
    >
      {signupSuccess && (
        <p className="mb-4 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          Account created for {signupEmail}. Sign in to continue.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Work Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex items-center justify-end">
          <Link to="/auth/forgot-password" className="text-xs text-brand-300 hover:text-brand-200">
            Forgot password?
          </Link>
        </div>

        {authError && (
          <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {authError}
          </p>
        )}

        <Button variant="primary" size="lg" loading={isSubmitting} className="mt-1 w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
