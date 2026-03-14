import { cn } from '@/utils'
import { PackageOpen } from 'lucide-react'

export function Table({ columns, data, onRowClick, emptyMessage = 'No records found' }) {
  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-600">
        <PackageOpen size={40} strokeWidth={1} className="mb-3" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap',
                  col.align === 'right' && 'text-right'
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {data.map((row, i) => (
            <tr
              key={row.id ?? i}
              onClick={() => onRowClick?.(row)}
              className={cn('table-row-hover', onRowClick && 'cursor-pointer')}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn('px-4 py-3 text-gray-300 whitespace-nowrap', col.align === 'right' && 'text-right')}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Skeleton loader for table ────────────────────────────────
export function TableSkeleton({ cols = 5, rows = 6 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <div className="h-3 bg-gray-800 rounded animate-pulse w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-4 py-3">
                  <div className={cn('h-3 bg-gray-800/80 rounded animate-pulse', c === 0 ? 'w-32' : 'w-20')} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
