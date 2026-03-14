import { forwardRef } from 'react'
import { cn } from '@/utils'

// ─── Input ──────────────────────────────────────────────────
export const Input = forwardRef(({ className, label, error, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs font-medium text-gray-400">{label}</label>}
    <input ref={ref} className={cn('input-base', error && 'border-red-700 focus:ring-red-500', className)} {...props} />
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
))
Input.displayName = 'Input'

// ─── Select ─────────────────────────────────────────────────
export const Select = forwardRef(({ className, label, error, children, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs font-medium text-gray-400">{label}</label>}
    <select
      ref={ref}
      className={cn('input-base appearance-none', error && 'border-red-700', className)}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
))
Select.displayName = 'Select'

// ─── Textarea ───────────────────────────────────────────────
export const Textarea = forwardRef(({ className, label, error, rows = 3, ...props }, ref) => (
  <div className="flex flex-col gap-1">
    {label && <label className="text-xs font-medium text-gray-400">{label}</label>}
    <textarea
      ref={ref}
      rows={rows}
      className={cn('input-base resize-none', error && 'border-red-700', className)}
      {...props}
    />
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
))
Textarea.displayName = 'Textarea'
