import { useEffect, useState } from 'react'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Table'
import { formatDateTime } from '@/utils'
import { cn } from '@/utils'

const TYPE_COLORS = {
  receipt:    'bg-blue-950 text-blue-400 border-blue-900',
  delivery:   'bg-teal-950 text-teal-400 border-teal-900',
  transfer:   'bg-purple-950 text-purple-400 border-purple-900',
  adjustment: 'bg-amber-950 text-amber-400 border-amber-900',
}

function GroupedRow({ referenceId, entries }) {
  const [open, setOpen] = useState(false)
  const first = entries[0]

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="border-b border-gray-800/60 hover:bg-gray-900/60 cursor-pointer transition-colors"
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown size={13} className="text-gray-600" /> : <ChevronRight size={13} className="text-gray-600" />}
            <span className="font-mono text-xs text-gray-400">{referenceId?.slice(0, 8) ?? '—'}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge className={cn('border text-xs', TYPE_COLORS[first.type] ?? '')}>{first.type}</Badge>
        </td>
        <td className="px-4 py-3 text-xs text-gray-500">{entries.length} product{entries.length !== 1 ? 's' : ''}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(first.created_at)}</td>
      </tr>
      {open && entries.map((e, i) => (
        <tr key={e.id} className="bg-gray-900/30 border-b border-gray-800/30">
          <td className="px-4 py-2 pl-10 text-xs text-gray-600">↳</td>
          <td className="px-4 py-2 text-xs text-gray-400">{e.product_name ?? e.product_id?.slice(0, 8)}</td>
          <td className="px-4 py-2">
            <span className={cn('font-mono text-xs font-medium', e.quantity_change > 0 ? 'text-emerald-400' : 'text-red-400')}>
              {e.quantity_change > 0 ? `+${e.quantity_change}` : e.quantity_change}
            </span>
          </td>
          <td className="px-4 py-2 text-xs text-gray-600">{e.location_name ?? '—'}</td>
        </tr>
      ))}
    </>
  )
}

export default function HistoryPage() {
  const [entries, setEntries] = useState([])
  const [grouped, setGrouped] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (typeFilter) params.set('type', typeFilter)
        const { data } = await api.get(`/history?${params.toString()}`)

        // Group by reference_id
        const groups = {}
        ;(data ?? []).forEach((e) => {
          const key = e.reference_id ?? e.id
          if (!groups[key]) groups[key] = []
          groups[key].push(e)
        })

        setGrouped(groups)
        setEntries(data ?? [])
      } catch (err) {
        console.error('Failed to load history', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [typeFilter])

  const filteredGroups = Object.entries(grouped).filter(([key, entries]) => {
    if (!search) return true
    return entries.some((e) => e.product_name?.toLowerCase().includes(search.toLowerCase()) || key.includes(search))
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product or reference…" className="input-base pl-8" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-base w-auto">
          <option value="">All Types</option>
          <option value="receipt">Receipt</option>
          <option value="delivery">Delivery</option>
          <option value="transfer">Transfer</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <span className="text-xs text-gray-600 ml-auto">{entries.length} entries</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton cols={4} rows={8} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Reference', 'Type', 'Products', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGroups.length === 0
                  ? <tr><td colSpan={4} className="text-center py-12 text-gray-600 text-sm">No movement history found</td></tr>
                  : filteredGroups.map(([key, entries]) => (
                    <GroupedRow key={key} referenceId={key} entries={entries} />
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
