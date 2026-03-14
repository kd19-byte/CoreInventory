import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const schema = z.object({
  email:           z.string().email('Invalid email'),
  password:        z.string().min(6, 'Min 6 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export default function SignupPage() {
  const { signUp }  = useAuth()
  const navigate    = useNavigate()
  const [done, setDone]     = useState(false)
  const [authError, setAuthError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email, password }) => {
    setAuthError('')
    const { error } = await signUp(email, password)
    if (error) { setAuthError(error.message); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="card p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-emerald-950 border border-emerald-800 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-400 text-xl">✓</span>
          </div>
          <h2 className="font-semibold text-gray-100 mb-2">Check your email</h2>
          <p className="text-xs text-gray-500 mb-4">
            We sent you a confirmation link. Click it to activate your account.
          </p>
          <Link to="/auth/login" className="text-xs text-brand-400 hover:text-brand-300">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Boxes size={16} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-100">CoreInventory</span>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-100 mb-1">Create account</h2>
          <p className="text-xs text-gray-500 mb-6">Start managing your inventory</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input label="Email" type="email" placeholder="you@company.com"
              error={errors.email?.message} {...register('email')} />
            <Input label="Password" type="password" placeholder="Min 6 characters"
              error={errors.password?.message} {...register('password')} />
            <Input label="Confirm password" type="password" placeholder="Repeat password"
              error={errors.confirmPassword?.message} {...register('confirmPassword')} />

            {authError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}

            <Button variant="primary" size="lg" loading={isSubmitting} className="w-full mt-1">
              Create account
            </Button>
          </form>

          <p className="text-xs text-gray-600 text-center mt-4">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-brand-400 hover:text-brand-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
