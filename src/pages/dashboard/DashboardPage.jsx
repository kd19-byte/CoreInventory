import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, AlertTriangle, XCircle, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'
import { KpiCard } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/Badge'
import { Table, TableSkeleton } from '@/components/ui/Table'
import { formatDate } from '@/utils'

const MOCK_CHART = [
  { month: 'Sep', received: 320, delivered: 210 },
  { month: 'Oct', received: 450, delivered: 380 },
  { month: 'Nov', received: 290, delivered: 310 },
  { month: 'Dec', received: 510, delivered: 430 },
  { month: 'Jan', received: 380, delivered: 280 },
  { month: 'Feb', received: 420, delivered: 360 },
]

const RECENT_COLUMNS = [
  { key: 'reference', label: 'Reference' },
  { key: 'type',      label: 'Type',   render: (v) => <span className="text-gray-400 text-xs">{v}</span> },
  { key: 'status',    label: 'Status', render: (v) => <StatusBadge status={v} /> },
  { key: 'created_at', label: 'Date', render: (v) => formatDate(v) },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState({ total: 0, lowStock: 0, outOfStock: 0, pendingReceipts: 0, pendingDeliveries: 0 })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { kpis, recent } = await api.get('/dashboard')
        setKpis(kpis)
        setRecent(recent ?? [])
      } catch (err) {
        console.error('Failed to load dashboard', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Total Products"      value={kpis.total}            icon={Package}         accent="blue"   onClick={() => navigate('/products')} />
        <KpiCard label="Low Stock"           value={kpis.lowStock}         icon={AlertTriangle}   accent="amber"  onClick={() => navigate('/products?filter=low')} />
        <KpiCard label="Out of Stock"        value={kpis.outOfStock}       icon={XCircle}         accent="red"    onClick={() => navigate('/products?filter=out')} />
        <KpiCard label="Pending Receipts"    value={kpis.pendingReceipts}  icon={ArrowDownToLine} accent="green"  onClick={() => navigate('/receipts')} />
        <KpiCard label="Pending Deliveries"  value={kpis.pendingDeliveries}icon={ArrowUpFromLine} accent="purple" onClick={() => navigate('/delivery')} />
      </div>

      {/* Chart + recent table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stock movement chart */}
        <div className="card p-4 lg:col-span-2">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Stock Movement (last 6 months)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MOCK_CHART} barSize={14} barGap={4}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              />
              <Bar dataKey="received"  fill="#4f46e5" radius={[4, 4, 0, 0]} name="Received"  />
              <Bar dataKey="delivered" fill="#0d9488" radius={[4, 4, 0, 0]} name="Delivered" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-sm bg-brand-600 inline-block"/>Received</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2.5 h-2.5 rounded-sm bg-teal-600 inline-block"/>Delivered</span>
          </div>
        </div>

        {/* Quick links */}
        <div className="card p-4 flex flex-col gap-2">
          <h2 className="text-sm font-medium text-gray-300 mb-2">Quick Actions</h2>
          {[
            { label: 'New Receipt',   icon: ArrowDownToLine, to: '/receipts/new',   color: 'text-blue-400' },
            { label: 'New Delivery',  icon: ArrowUpFromLine, to: '/delivery/new',   color: 'text-teal-400' },
            { label: 'New Transfer',  icon: ArrowLeftRight,  to: '/transfers/new',  color: 'text-purple-400' },
          ].map(({ label, icon: Icon, to, color }) => (
            <button key={to} onClick={() => navigate(to)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors text-left">
              <Icon size={15} className={color} />
              <span className="text-sm text-gray-300">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent operations */}
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-medium text-gray-300">Recent Operations</h2>
        </div>
        {loading ? <TableSkeleton cols={4} rows={5} /> : (
          <Table
            columns={RECENT_COLUMNS}
            data={recent}
            onRowClick={(row) => navigate(row.type === 'Receipt' ? `/receipts/${row.id}` : `/delivery/${row.id}`)}
            emptyMessage="No operations yet"
          />
        )}
      </div>
    </div>
  )
}
