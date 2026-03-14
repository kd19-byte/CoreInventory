import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useInventoryStore } from '@/store'
import { Table, TableSkeleton } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDate } from '@/utils'

const STATUS_OPTIONS = ['', 'draft', 'waiting', 'ready', 'done', 'canceled']

/**
 * Generic list page for Receipts / Delivery / Transfers / Adjustments
 * @param {Object} props
 * @param {string} props.table           — supabase table name
 * @param {string} props.newRoute        — route to navigate to for new record
 * @param {string} props.detailRoute     — base route for row click (id appended)
 * @param {string} props.title
 * @param {import('@/components/ui/Table').Column[]} props.extraColumns
 */
export function OperationList({ table, newRoute, detailRoute, title, extraColumns = [] }) {
  const navigate = useNavigate()
  const warehouses = useInventoryStore((s) => s.warehouses)

  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [warehouseId, setWarehouseId] = useState('')

  const columns = [
    { key: 'reference',     label: 'Reference'  },
    ...extraColumns,
    { key: 'scheduled_date', label: 'Date',   render: (v) => formatDate(v) },
    { key: 'status',         label: 'Status', render: (v) => <StatusBadge status={v} /> },
  ]

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let query = supabase.from(table).select('*').order('created_at', { ascending: false })
      if (status)      query = query.eq('status', status)
      if (warehouseId) query = query.eq('warehouse_id', warehouseId)
      if (search)      query = query.ilike('reference', `%${search}%`)

      const { data: rows } = await query
      setData(rows ?? [])
      setLoading(false)
    }
    load()
  }, [table, status, warehouseId, search])

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference…" className="input-base pl-8" />
        </div>

        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-base w-auto">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        {warehouses.length > 0 && (
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="input-base w-auto">
            <option value="">All Warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}

        <div className="ml-auto">
          <Button variant="primary" icon={Plus} onClick={() => navigate(newRoute)}>
            New {title}
          </Button>
        </div>
      </div>

      <div className="card">
        {loading
          ? <TableSkeleton cols={columns.length} rows={7} />
          : <Table columns={columns} data={data}
              onRowClick={(row) => navigate(`${detailRoute}/${row.id}`)}
              emptyMessage={`No ${title.toLowerCase()} records found`}
            />
        }
      </div>
    </div>
  )
}
