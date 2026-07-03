import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, AlertTriangle, XCircle, ArrowDownToLine, ArrowUpFromLine, HeartPulse, Layers, Sparkles } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'
import { KpiCard } from '@/components/ui/Badge'
import { StatusBadge } from '@/components/ui/Badge'
import { Table, TableSkeleton } from '@/components/ui/Table'
import { formatDate } from '@/utils'
import { useAuth } from '@/lib/AuthContext'

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
  const { user } = useAuth()
  const [kpis, setKpis] = useState({ total: 0, lowStock: 0, outOfStock: 0, pendingReceipts: 0, pendingDeliveries: 0, healthScore: 0, dueStacks: 0 })
  const [recent, setRecent] = useState([])
  const [stockoutRisk, setStockoutRisk] = useState([])
  const [loading, setLoading] = useState(true)
  const [aiQuestion, setAiQuestion] = useState('Give me top stock risks and what to reorder first.')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiActions, setAiActions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { kpis, recent, stockoutRisk } = await api.get('/dashboard')
        setKpis(kpis)
        setRecent(recent ?? [])
        setStockoutRisk(stockoutRisk ?? [])
      } catch (err) {
        console.error('Failed to load dashboard', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const askInventoryAI = async () => {
    setAiLoading(true)
    setAiError('')
    try {
      const { answer, actions } = await api.post('/ai/inventory-insights', { question: aiQuestion })
      setAiAnswer(answer || '')
      setAiActions(actions ?? [])
    } catch (err) {
      setAiError(err.message || 'Failed to get AI insights')
      setAiActions([])
    } finally {
      setAiLoading(false)
    }
  }

  const openRestock = (item) => {
    const qty = Number(item.suggested_reorder_qty || 1)
    navigate(`/receipts/new?product_id=${item.product_id}&qty=${qty}`)
  }

  const scoreColor = kpis.healthScore >= 80
    ? '#00d4aa'
    : kpis.healthScore >= 60
      ? '#f59e0b'
      : '#ef4444'

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        <KpiCard label="Total Products"      value={kpis.total}            icon={Package}         accent="blue"   onClick={() => navigate('/products')} />
        <KpiCard label="Low Stock"           value={kpis.lowStock}         icon={AlertTriangle}   accent="amber"  onClick={() => navigate('/products?filter=low')} />
        <KpiCard label="Out of Stock"        value={kpis.outOfStock}       icon={XCircle}         accent="red"    onClick={() => navigate('/products?filter=out')} />
        <KpiCard label="Pending Receipts"    value={kpis.pendingReceipts}  icon={ArrowDownToLine} accent="green"  onClick={() => navigate('/receipts')} />
        <KpiCard label="Pending Deliveries"  value={kpis.pendingDeliveries}icon={ArrowUpFromLine} accent="purple" onClick={() => navigate('/delivery')} />
        {user?.role === 'manager' ? (
          <>
            <div
              onClick={() => navigate('/dashboard')}
              className="card p-4 flex items-center gap-4 cursor-pointer hover:border-gray-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 border-gray-800 bg-gray-900">
                <HeartPulse size={18} style={{ color: scoreColor }} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Health Score</p>
                <p className="text-2xl font-semibold mt-0.5" style={{ color: scoreColor }}>{kpis.healthScore ?? '—'}</p>
              </div>
            </div>
            <KpiCard label="Due Stacks"      value={kpis.dueStacks}        icon={Layers}          accent="amber"  onClick={() => navigate('/stacks')} />
          </>
        ) : (
          <div className="card p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-200">Your pending tasks</h3>
            <p className="text-xs text-gray-400 mt-2">{kpis.pendingReceipts} receipts waiting to validate</p>
            <p className="text-xs text-gray-400 mt-1">{kpis.pendingDeliveries} deliveries to process</p>
          </div>
        )}
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

        {/* AI Assistant */}
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Sparkles size={14} className="text-brand-300" />
              AI Inventory Assistant
            </h2>
            <button
              onClick={askInventoryAI}
              disabled={aiLoading}
              className="px-3 py-1.5 rounded-lg border border-brand-700 bg-brand-900/40 text-xs text-brand-300
                         hover:bg-brand-900/60 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiLoading ? 'Analyzing...' : 'Ask AI'}
            </button>
          </div>

          <textarea
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            className="input-base min-h-[88px] resize-y"
            placeholder="Ask: Which products are out of stock or will stock out soon?"
          />

          {aiError && (
            <p className="text-xs text-red-300 border border-red-900 bg-red-950/40 rounded-lg px-3 py-2">
              {aiError}
            </p>
          )}

          {aiActions.length > 0 && (
            <div className="max-h-60 overflow-y-auto border border-gray-800 rounded-lg">
              <div className="px-3 py-2 border-b border-gray-800 text-xs text-gray-500 font-medium">Recommended Restock Actions</div>
              <div className="p-2 flex flex-col gap-2">
                {aiActions.map((item) => (
                  <div key={`${item.type}-${item.product_id}`} className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200 truncate">{item.product_name}</p>
                        <p className="text-[11px] text-gray-500">{item.sku}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        item.priority === 'critical'
                          ? 'text-red-300 border-red-800 bg-red-950/40'
                          : 'text-amber-300 border-amber-800 bg-amber-950/40'
                      }`}>
                        {item.priority}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {item.type === 'out_of_stock'
                        ? 'Out of stock now.'
                        : `${item.days_remaining} day(s) remaining.`}{' '}
                      Suggested reorder: {item.suggested_reorder_qty}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => openRestock(item)}
                        className="px-2.5 py-1 rounded-md text-xs bg-brand-600 text-white hover:bg-brand-500 transition-colors"
                      >
                        Restock
                      </button>
                      <button
                        onClick={() => navigate(`/products/${item.product_id}`)}
                        className="px-2.5 py-1 rounded-md text-xs border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        View Product
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiAnswer && (
            <div className="border border-gray-800 bg-gray-950/50 rounded-lg p-3">
              <p className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">{aiAnswer}</p>
            </div>
          )}
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
            onRowClick={(row) => navigate(row.type === 'Receipt' ? `/receipts/${encodeURIComponent(row.id)}` : `/delivery/${encodeURIComponent(row.id)}`)}
            emptyMessage="No operations yet"
          />
        )}
      </div>

      {/* Stockout prediction */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-300">Stockout Prediction (30-day consumption)</h2>
          <button
            onClick={() => navigate('/products?filter=dead')}
            className="text-xs text-brand-300 hover:text-brand-200 transition-colors"
          >
            View dead stock
          </button>
        </div>
        {!stockoutRisk.length ? (
          <p className="text-xs text-gray-500">No consumption history yet. Validate delivery orders to generate forecast data.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {stockoutRisk.map((row) => (
              <div key={row.name} className="rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
                <p className="text-xs text-gray-500 truncate">{row.name}</p>
                <p className="text-sm font-semibold text-amber-300">{row.days_remaining} days remaining</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
