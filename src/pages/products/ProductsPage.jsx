import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useInventoryStore } from '@/store'
import { Table, TableSkeleton } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/utils'

function stockBadge(product) {
  if (product.current_stock === 0)
    return <Badge className="badge-canceled">Out of Stock</Badge>
  if (product.reorder_point > 0 && product.current_stock <= product.reorder_point)
    return <Badge className="badge-waiting">Low Stock</Badge>
  return <Badge className="badge-done">In Stock</Badge>
}

const COLUMNS = [
  { key: 'name',            label: 'Product' },
  { key: 'sku',             label: 'SKU',      render: (v) => <span className="font-mono text-xs text-gray-500">{v}</span> },
  { key: 'category_name',   label: 'Category'  },
  { key: 'unit_of_measure', label: 'UOM'       },
  { key: 'current_stock',   label: 'On Hand',  align: 'right', render: (v) => <span className="font-mono">{v ?? 0}</span> },
  { key: 'reorder_point',   label: 'Reorder Pt', align: 'right', render: (v) => <span className="font-mono text-gray-500">{v ?? 0}</span> },
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
      let query = supabase
        .from('products')
        .select('*, product_categories(name)')
        .order('name')

      if (search)    query = query.ilike('name', `%${search}%`)
      if (catFilter) query = query.eq('category_id', catFilter)

      const { data } = await query
      let result = (data ?? []).map((p) => ({
        ...p,
        category_name: p.product_categories?.name ?? '—',
      }))

      // Apply filter param from dashboard KPI click
      if (filterParam === 'low')
        result = result.filter((p) => p.reorder_point > 0 && p.current_stock <= p.reorder_point)
      else if (filterParam === 'out')
        result = result.filter((p) => p.current_stock === 0)

      setProducts(result)
      setLoading(false)
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
