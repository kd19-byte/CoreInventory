import { cn } from '@/utils'

const variants = {
  primary:   'bg-brand-600 hover:bg-brand-500 text-white border border-brand-500',
  secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700',
  danger:    'bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800',
  ghost:     'bg-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-100 border border-transparent',
  success:   'bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800',
}

const sizes = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-8 px-4 text-sm',
  lg: 'h-10 px-5 text-sm',
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  disabled,
  loading,
  icon: Icon,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon size={14} />
      ) : null}
      {children}
    </button>
  )
}
