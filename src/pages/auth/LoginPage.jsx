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
  email:    z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [authError, setAuthError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ email, password }) => {
    setAuthError('')
    const { error } = await signIn(email, password)
    if (error) { setAuthError(error.message); return }
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Boxes size={16} className="text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-100">CoreInventory</span>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-100 mb-1">Sign in</h2>
          <p className="text-xs text-gray-500 mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            {authError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}

            <Button variant="primary" size="lg" loading={isSubmitting} className="w-full mt-1">
              Sign in
            </Button>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-center">
            <Link to="/auth/forgot-password" className="text-xs text-brand-400 hover:text-brand-300">
              Forgot password?
            </Link>
            <p className="text-xs text-gray-600">
              No account?{' '}
              <Link to="/auth/signup" className="text-brand-400 hover:text-brand-300">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
