import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useInventoryStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Table } from '@/components/ui/Table'

const schema = z.object({
  name:            z.string().min(1, 'Required'),
  sku:             z.string().min(1, 'Required'),
  category_id:     z.string().min(1, 'Required'),
  unit_of_measure: z.string().min(1, 'Required'),
  reorder_point:   z.coerce.number().min(0),
  initial_stock:   z.coerce.number().min(0).optional(),
})

const STOCK_COLUMNS = [
  { key: 'location_name', label: 'Location' },
  { key: 'warehouse_name', label: 'Warehouse' },
  { key: 'qty', label: 'Qty', align: 'right', render: (v) => <span className="font-mono">{v}</span> },
]

export default function ProductDetailPage() {
  const { id } = useParams()
  const isNew  = id === 'new'
  const navigate = useNavigate()
  const { categories } = useInventoryStore()
  const { success, error } = useToast()

  const [loading, setLoading] = useState(!isNew)
  const [stockByLocation, setStockByLocation] = useState([])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { reorder_point: 0, initial_stock: 0 },
  })

  useEffect(() => {
    if (isNew) return
    const load = async () => {
      const { data } = await supabase.from('products').select('*').eq('id', id).single()
      if (data) reset(data)

      // Load per-location stock
      const { data: ledger } = await supabase
        .from('stock_ledger')
        .select('location_id, quantity_change, locations(name, warehouses(name))')
        .eq('product_id', id)

      // Aggregate
      const agg = {}
      ;(ledger ?? []).forEach(({ location_id, quantity_change, locations }) => {
        if (!agg[location_id]) agg[location_id] = {
          location_name: locations?.name ?? '—',
          warehouse_name: locations?.warehouses?.name ?? '—',
          qty: 0,
        }
        agg[location_id].qty += quantity_change
      })
      setStockByLocation(Object.values(agg))
      setLoading(false)
    }
    load()
  }, [id, isNew, reset])

  const onSubmit = async (values) => {
    const { initial_stock, ...productData } = values
    if (isNew) {
      const { data, error: err } = await supabase.from('products').insert([{ ...productData, current_stock: initial_stock ?? 0 }]).select().single()
      if (err) { error('Failed to create', err.message); return }
      // Seed ledger if initial stock provided
      if (initial_stock > 0) {
        await supabase.from('stock_ledger').insert([{
          product_id: data.id, quantity_change: initial_stock, type: 'adjustment', reference_id: data.id,
        }])
      }
      success('Product created')
      navigate(`/products/${data.id}`)
    } else {
      const { error: err } = await supabase.from('products').update(productData).eq('id', id)
      if (err) { error('Failed to update', err.message); return }
      success('Product updated')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this product?')) return
    await supabase.from('products').delete().eq('id', id)
    success('Product deleted')
    navigate('/products')
  }

  if (loading) return <div className="text-gray-600 text-sm p-8">Loading…</div>

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" icon={ArrowLeft} size="sm" onClick={() => navigate('/products')} />
        <h1 className="page-title">{isNew ? 'New Product' : 'Edit Product'}</h1>
        {!isNew && <Button variant="danger" icon={Trash2} size="sm" className="ml-auto" onClick={handleDelete}>Delete</Button>}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="card p-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Product Name" placeholder="e.g. Steel Rods" error={errors.name?.message} {...register('name')} />
          <Input label="SKU / Code"   placeholder="e.g. STL-001"    error={errors.sku?.message}  {...register('sku')}  />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Category" error={errors.category_id?.message} {...register('category_id')}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Unit of Measure" placeholder="e.g. kg, pcs, m" error={errors.unit_of_measure?.message} {...register('unit_of_measure')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Reorder Point" type="number" min="0" error={errors.reorder_point?.message} {...register('reorder_point')} />
          {isNew && <Input label="Initial Stock" type="number" min="0" error={errors.initial_stock?.message} {...register('initial_stock')} />}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" icon={Save} loading={isSubmitting}>
            {isNew ? 'Create Product' : 'Save Changes'}
          </Button>
        </div>
      </form>

      {/* Stock by location */}
      {!isNew && (
        <div className="card">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-medium text-gray-300">Stock by Location</h2>
          </div>
          <Table columns={STOCK_COLUMNS} data={stockByLocation} emptyMessage="No stock movements yet" />
        </div>
      )}
    </div>
  )
}
