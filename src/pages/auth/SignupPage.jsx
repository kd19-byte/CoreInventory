import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AuthShell } from '@/pages/auth/AuthShell'

const schema = z.object({
  name:            z.string().trim().min(2, 'Enter your full name'),
  email:           z.string().trim().email('Enter a valid work email'),
  password:        z.string().min(8, 'Use at least 8 characters'),
  confirmPassword: z.string(),
  role:            z.enum(['manager', 'staff']),
  terms:           z.boolean().refine((val) => val, 'You must accept the terms'),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export default function SignupPage() {
  const { signUp, session } = useAuth()
  const navigate    = useNavigate()
  const [authError, setAuthError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'staff',
      terms: true,
    },
  })

  if (session) return <Navigate to="/dashboard" replace />

  const onSubmit = async ({ name, email, password, role }) => {
    setAuthError('')
    const { error } = await signUp({ name, email, password, role })
    if (error) { setAuthError(error.message); return }
    navigate('/auth/login', {
      replace: true,
      state: {
        signupSuccess: true,
        registeredEmail: email.trim().toLowerCase(),
      },
    })
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your team workspace and start tracking warehouse operations."
      footer={(
        <p>
          Already using CoreInventory?{' '}
          <Link to="/auth/login" className="font-medium text-brand-300 hover:text-brand-200">
            Sign in
          </Link>
        </p>
      )}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Full Name"
          type="text"
          autoComplete="name"
          placeholder="Alex Johnson"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Work Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400">Role</label>
          <select className="input-base" {...register('role')}>
            <option value="staff">Warehouse Staff</option>
            <option value="manager">Inventory Manager</option>
          </select>
        </div>

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <label className="flex items-start gap-2 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2 text-xs text-gray-400">
          <input
            type="checkbox"
            className="mt-0.5 h-3.5 w-3.5 rounded border-gray-700 bg-gray-900 text-brand-500 focus:ring-brand-500"
            {...register('terms')}
          />
          <span>I agree to the terms and acknowledge inventory operations are logged for audit history.</span>
        </label>
        {errors.terms?.message && <p className="text-xs text-red-300">{errors.terms.message}</p>}

        {authError && (
          <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {authError}
          </p>
        )}

        <Button variant="primary" size="lg" loading={isSubmitting}>
          Create Account
        </Button>
      </form>
    </AuthShell>
  )
}
