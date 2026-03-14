import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { api } from '@/lib/api'
import { useInventoryStore } from '@/store'
import { Table, TableSkeleton } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

function stockBadge(product) {
  if (product.current_stock === 0)
    return <Badge className="badge-canceled">Out of Stock</Badge>
  if (product.low_stock_threshold > 0 && product.current_stock <= product.low_stock_threshold)
    return <Badge className="badge-waiting">Low Stock</Badge>
  return <Badge className="badge-done">In Stock</Badge>
}

const COLUMNS = [
  { key: 'name',            label: 'Product' },
  { key: 'sku',             label: 'SKU',      render: (v) => <span className="font-mono text-xs text-gray-500">{v}</span> },
  { key: 'category',        label: 'Category'  },
  { key: 'uom',             label: 'UOM'       },
  { key: 'current_stock',   label: 'On Hand',  align: 'right', render: (v) => <span className="font-mono">{v ?? 0}</span> },
  { key: 'low_stock_threshold', label: 'Low Stock', align: 'right', render: (v) => <span className="font-mono text-gray-500">{v ?? 0}</span> },
  { key: 'status',          label: 'Status',   render: (_, row) => stockBadge(row) },
]

export default function ProductsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const categories = useInventoryStore((s) => s.categories)

  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [catFilter, setCatFilter] = useState('')

  const filterParam = searchParams.get('filter')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.set('search', search)
        if (catFilter) params.set('category', catFilter)
        const { data } = await api.get(`/products?${params.toString()}`)
        let result = data ?? []

        // Apply filter param from dashboard KPI click
        if (filterParam === 'low')
          result = result.filter((p) => p.low_stock_threshold > 0 && p.current_stock <= p.low_stock_threshold)
        else if (filterParam === 'out')
          result = result.filter((p) => p.current_stock === 0)

        setProducts(result)
      } catch (err) {
        console.error('Failed to load products', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [search, catFilter, filterParam])

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
          <Button variant="primary" icon={Plus} onClick={() => navigate('/products/new')}>
            New Product
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading
          ? <TableSkeleton cols={7} rows={8} />
          : <Table columns={COLUMNS} data={products} onRowClick={(r) => navigate(`/products/${r.id}`)} emptyMessage="No products found" />
        }
      </div>
    </div>
  )
}
