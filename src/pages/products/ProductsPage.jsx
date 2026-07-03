import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { useInventoryStore } from '@/store'
import { Table, TableSkeleton } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

function stockBadge(product) {
  if (product.smart_risk_level === 'critical')
    return <Badge className="bg-red-950 text-red-300 border border-red-800">Smart Risk: Critical</Badge>
  if (product.smart_risk_level === 'warning')
    return <Badge className="bg-amber-950 text-amber-300 border border-amber-800">Smart Risk: Warning</Badge>
  if (product.is_dead_stock)
    return <Badge className="bg-orange-950 text-orange-300 border border-orange-800">Dead Stock</Badge>
  if (product.current_stock === 0)
    return <Badge className="badge-canceled">Out of Stock</Badge>
  if (product.low_stock_threshold > 0 && product.current_stock <= product.low_stock_threshold)
    return <Badge className="badge-waiting">Low Stock</Badge>
  return <Badge className="badge-done">In Stock</Badge>
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const categories = useInventoryStore((s) => s.categories)

  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [smartRiskOnly, setSmartRiskOnly] = useState(false)

  const filterParam = searchParams.get('filter')

  const columns = [
    { key: 'name',            label: 'Product' },
    { key: 'sku',             label: 'SKU',      render: (v) => <span className="font-mono text-xs text-gray-500">{v}</span> },
    { key: 'category',        label: 'Category'  },
    { key: 'uom',             label: 'UOM'       },
    { key: 'current_stock',   label: 'On Hand',  align: 'right', render: (v) => <span className="font-mono">{v ?? 0}</span> },
    { key: 'low_stock_threshold', label: 'Low Stock', align: 'right', render: (v) => <span className="font-mono text-gray-500">{v ?? 0}</span> },
    {
      key: 'smart_days_remaining',
      label: 'Days Left',
      align: 'right',
      render: (v) => <span className="font-mono text-xs">{v == null ? '—' : v}</span>,
    },
    { key: 'status', label: 'Status', render: (_, row) => stockBadge(row) },
    {
      key: 'smart_action',
      label: 'Action',
      render: (_, row) => {
        if (!(row.smart_risk_level === 'critical' || row.smart_risk_level === 'warning' || row.current_stock === 0)) {
          return <span className="text-xs text-gray-600">—</span>
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              const qty = Number(row.reorder_qty || 1)
              navigate(`/receipts/new?product_id=${row.id}&qty=${qty}`)
            }}
            className="text-xs px-2 py-1 rounded border border-brand-700 text-brand-300 hover:bg-brand-900/30"
          >
            Restock
          </button>
        )
      },
    },
  ]

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (catFilter) params.set('category', catFilter)
        const [productsRes, riskRes] = await Promise.all([
          api.get(`/products?${params.toString()}`),
          api.get('/analytics/stockout-risk'),
        ])
        const riskMap = new Map((riskRes?.data ?? []).map((r) => [Number(r.id), r]))
        let result = (productsRes?.data ?? []).map((p) => {
          const risk = riskMap.get(Number(p.id))
          return {
            ...p,
            smart_days_remaining: risk?.days_remaining ?? null,
            smart_risk_level: risk?.risk_level ?? 'unknown',
          }
        })

        // Apply filter param from dashboard KPI click
        if (filterParam === 'low')
          result = result.filter((p) => p.low_stock_threshold > 0 && p.current_stock <= p.low_stock_threshold)
        else if (filterParam === 'out')
          result = result.filter((p) => p.current_stock === 0)
        else if (filterParam === 'dead')
          result = result.filter((p) => p.is_dead_stock)
        else if (filterParam === 'risk')
          result = result.filter((p) => p.smart_risk_level === 'critical' || p.smart_risk_level === 'warning')

        if (smartRiskOnly)
          result = result.filter((p) => p.smart_risk_level === 'critical' || p.smart_risk_level === 'warning')

        setProducts(result)
      } catch (err) {
        console.error('Failed to load products', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [search, catFilter, filterParam, smartRiskOnly])

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="input-base pl-8"
          />
        </div>

        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="input-base w-auto"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="ml-auto">
          <Button
            variant={smartRiskOnly ? 'primary' : 'secondary'}
            onClick={() => setSmartRiskOnly((v) => !v)}
            className="mr-2"
          >
            Smart Stock
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => navigate('/products/new')}>
            New Product
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading
          ? <TableSkeleton cols={9} rows={8} />
          : <Table columns={columns} data={products} onRowClick={(r) => navigate(`/products/${r.id}`)} emptyMessage="No products found" />
        }
      </div>
    </div>
  )
}
