import { useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useUIStore } from '@/store'
import { cn } from '@/utils'

const icons = {
  success: { Icon: CheckCircle, cls: 'text-emerald-400' },
  error:   { Icon: XCircle,     cls: 'text-red-400'     },
  warning: { Icon: AlertTriangle,cls: 'text-amber-400'  },
  info:    { Icon: Info,         cls: 'text-blue-400'   },
}

function Toast({ id, type = 'info', title, message }) {
  const removeToast = useUIStore((s) => s.removeToast)
  const { Icon, cls } = icons[type] ?? icons.info

  useEffect(() => {
    const t = setTimeout(() => removeToast(id), 4000)
    return () => clearTimeout(t)
  }, [id, removeToast])

  return (
    <div className="flex items-start gap-3 card p-3 shadow-xl w-80 animate-[slideIn_0.2s_ease]">
      <Icon size={16} className={cn('flex-shrink-0 mt-0.5', cls)} />
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-medium text-gray-100">{title}</p>}
        {message && <p className="text-xs text-gray-400 mt-0.5">{message}</p>}
      </div>
      <button onClick={() => removeToast(id)} className="text-gray-600 hover:text-gray-300 flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts)
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => <Toast key={t.id} {...t} />)}
    </div>
  )
}

// Hook for easy usage
export function useToast() {
  const addToast = useUIStore((s) => s.addToast)
  return {
    toast: (props) => addToast(props),
    success: (title, message) => addToast({ type: 'success', title, message }),
    error: (title, message)   => addToast({ type: 'error',   title, message }),
    warning: (title, message) => addToast({ type: 'warning', title, message }),
    info: (title, message)    => addToast({ type: 'info',    title, message }),
  }
}
