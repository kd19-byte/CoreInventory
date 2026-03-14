import { cn, statusClass, statusLabel } from '@/utils'

// ─── Generic badge ───────────────────────────────────────────
export function Badge({ children, className }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', className)}>
      {children}
    </span>
  )
}

// ─── Status badge (Draft / Ready / Done …) ──────────────────
export function StatusBadge({ status }) {
  return (
    <Badge className={statusClass(status)}>
      {statusLabel(status)}
    </Badge>
  )
}

// ─── KPI card ────────────────────────────────────────────────
export function KpiCard({ label, value, icon: Icon, accent = 'blue', onClick }) {
  const accents = {
    blue:   'text-blue-400 bg-blue-950/60 border-blue-900',
    amber:  'text-amber-400 bg-amber-950/60 border-amber-900',
    red:    'text-red-400 bg-red-950/60 border-red-900',
    green:  'text-emerald-400 bg-emerald-950/60 border-emerald-900',
    purple: 'text-purple-400 bg-purple-950/60 border-purple-900',
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'card p-4 flex items-center gap-4',
        onClick && 'cursor-pointer hover:border-gray-700 transition-colors'
      )}
    >
      {Icon && (
        <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0', accents[accent])}>
          <Icon size={18} />
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-semibold text-gray-100 mt-0.5">{value ?? '—'}</p>
      </div>
    </div>
  )
}
