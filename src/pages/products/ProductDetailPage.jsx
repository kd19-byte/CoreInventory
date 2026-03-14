import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useInventoryStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { Table } from '@/components/ui/Table'

const schema = z.object({
  name:            z.string().min(1, 'Required'),
  sku:             z.string().min(1, 'Required'),
  category:        z.string().optional(),
  uom:             z.string().min(1, 'Required'),
  cost_price:      z.coerce.number().min(0).optional(),
  low_stock_threshold: z.coerce.number().min(0),
  reorder_qty:     z.coerce.number().min(0),
  initial_stock:   z.coerce.number().min(0).optional(),
  initial_location_id: z.string().optional(),
}).refine((data) => {
  if (!data.initial_stock || data.initial_stock <= 0) return true
  return Boolean(data.initial_location_id)
}, {
  path: ['initial_location_id'],
  message: 'Select a location for initial stock',
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
  const { categories, locations, setProducts } = useInventoryStore()
  const { success, error } = useToast()

  const [loading, setLoading] = useState(!isNew)
  const [stockByLocation, setStockByLocation] = useState([])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { low_stock_threshold: 10, reorder_qty: 50, cost_price: 0, initial_stock: 0 },
  })

  useEffect(() => {
    if (isNew) return
    const load = async () => {
      try {
        const { data, stock } = await api.get(`/products/${id}`)
        if (data) reset(data)
        setStockByLocation(stock ?? [])
      } catch (err) {
        error('Failed to load', err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isNew, reset])

  const onSubmit = async (values) => {
    const { initial_stock, initial_location_id, ...productData } = values
    try {
      if (isNew) {
        const payload = {
          ...productData,
          initial_stock: initial_stock ?? 0,
          initial_location_id: initial_location_id || null,
        }
        const { data } = await api.post('/products', payload)
        const { data: prodData } = await api.get('/products')
        if (prodData) setProducts(prodData)
        success('Product created')
        navigate(`/products/${data.id}`)
      } else {
        await api.put(`/products/${id}`, productData)
        const { data: prodData } = await api.get('/products')
        if (prodData) setProducts(prodData)
        success('Product updated')
      }
    } catch (err) {
      error('Failed to save', err.message)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this product?')) return
    try {
      await api.del(`/products/${id}`)
      const { data: prodData } = await api.get('/products')
      if (prodData) setProducts(prodData)
      success('Product deleted')
      navigate('/products')
    } catch (err) {
      error('Failed to delete', err.message)
    }
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
          <Input label="Category" placeholder="e.g. Raw Materials" error={errors.category?.message} list="category-list" {...register('category')} />
          <datalist id="category-list">
            {categories.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
          <Input label="Unit of Measure" placeholder="e.g. kg, pcs, m" error={errors.uom?.message} {...register('uom')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Cost Price" type="number" min="0" step="0.01" error={errors.cost_price?.message} {...register('cost_price')} />
          <Input label="Low Stock Threshold" type="number" min="0" error={errors.low_stock_threshold?.message} {...register('low_stock_threshold')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Reorder Qty" type="number" min="0" error={errors.reorder_qty?.message} {...register('reorder_qty')} />
          {isNew && (
            <Select label="Initial Stock Location" error={errors.initial_location_id?.message} {...register('initial_location_id')}>
              <option value="">Select location</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name} {l.warehouse_name ? `(${l.warehouse_name})` : ''}</option>)}
            </Select>
          )}
        </div>

        {isNew && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Initial Stock" type="number" min="0" error={errors.initial_stock?.message} {...register('initial_stock')} />
          </div>
        )}

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
