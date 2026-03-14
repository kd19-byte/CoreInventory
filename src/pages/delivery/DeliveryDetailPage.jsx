import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { useInventoryStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDate, generateRef } from '@/utils'

const STATUS_FLOW = ['draft', 'ready', 'done']

export default function DeliveryDetailPage() {
  const { id }   = useParams()
  const isNew    = id === 'new'
  const navigate = useNavigate()
  const { locations, products, setProducts } = useInventoryStore()
  const toast = useToast()

  const [delivery, setDelivery] = useState({
    reference: generateRef('DEL'), customer: '', from_location_id: '',
    status: 'draft', created_at: new Date().toISOString(),
  })
  const [items, setItems]   = useState([{ product_id: '', qty: 1 }])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)

  useEffect(() => {
    if (isNew) return
    const load = async () => {
      try {
        const { header, items: loadedItems } = await api.get(`/operations/${id}`)
        setDelivery({
          reference: header.ref,
          customer: header.customer ?? '',
          from_location_id: header.from_location_id ?? '',
          status: header.status,
          created_at: header.created_at,
        })
        setItems((loadedItems ?? []).map((it) => ({ product_id: it.product_id, qty: it.qty })))
      } catch (err) {
        toast.error('Failed to load', err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isNew])

  const addItem    = () => setItems((p) => [...p, { product_id: '', qty: 1 }])
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i))
  const updateItem = (i, f, v) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it))

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        type: 'delivery',
        ref: delivery.reference,
        status: delivery.status,
        customer: delivery.customer,
        from_location_id: delivery.from_location_id,
        items: items.map((it) => ({ product_id: it.product_id, qty: it.qty })),
      }
      if (isNew) {
        await api.post('/operations', payload)
        toast.success('Delivery saved')
        navigate(`/delivery/${delivery.reference}`)
      } else {
        await api.put(`/operations/${id}`, payload)
        toast.success('Delivery updated')
      }
    } catch (err) {
      toast.error('Save failed', err.message)
    }
    setSaving(false)
  }

  const handleValidate = async () => {
    if (isNew) { toast.warning('Save the delivery before validating'); return }
    if (!window.confirm('Validate delivery? Stock will be deducted.')) return
    setSaving(true)
    try {
      await api.post(`/operations/${id}/validate`)
      const { data: prodData } = await api.get('/products')
      if (prodData) setProducts(prodData)
      setDelivery((d) => ({ ...d, status: 'done' }))
      toast.success('Delivery validated', 'Stock has been deducted')
    } catch (err) {
      toast.error('Validation failed', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    if (isNew) { toast.warning('Save the delivery before canceling'); return }
    if (!window.confirm('Cancel this delivery?')) return
    try {
      await api.post(`/operations/${id}/cancel`)
      setDelivery((d) => ({ ...d, status: 'canceled' }))
      toast.info('Delivery canceled')
    } catch (err) {
      toast.error('Failed to cancel', err.message)
    }
  }

  const isReadOnly = ['done', 'canceled'].includes(delivery.status)
  if (loading) return <div className="text-gray-600 text-sm p-8">Loading…</div>

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" icon={ArrowLeft} size="sm" onClick={() => navigate('/delivery')} />
        <div>
          <p className="page-title">{delivery.reference}</p>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(delivery.created_at)}</p>
        </div>
        <StatusBadge status={delivery.status} />
        <div className="ml-auto flex gap-2">
          {!isReadOnly && (
            <>
              <Button variant="danger"  icon={XCircle}     size="sm" onClick={handleCancel}>Cancel</Button>
              <Button variant="success" icon={CheckCircle} size="sm" onClick={handleValidate} loading={saving}>Validate</Button>
              <Button variant="primary"                    size="sm" onClick={handleSave} loading={saving}>Save</Button>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="card px-5 py-3 flex items-center gap-3">
        {STATUS_FLOW.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-xs font-medium
              ${STATUS_FLOW.indexOf(delivery.status) >= i ? 'text-brand-400' : 'text-gray-600'}`}>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px]
                ${STATUS_FLOW.indexOf(delivery.status) >= i ? 'border-brand-500 bg-brand-950 text-brand-400' : 'border-gray-700 text-gray-700'}`}>
                {i + 1}
              </div>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
            {i < STATUS_FLOW.length - 1 && <div className="w-8 h-px bg-gray-800" />}
          </div>
        ))}
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-gray-300">Delivery Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Reference" value={delivery.reference} onChange={(e) => setDelivery((d) => ({ ...d, reference: e.target.value }))} disabled={!isNew || isReadOnly} />
          <Input label="Customer"  value={delivery.customer}  onChange={(e) => setDelivery((d) => ({ ...d, customer:  e.target.value }))} disabled={isReadOnly} placeholder="Customer name" />
          <Select label="From Location" value={delivery.from_location_id} onChange={(e) => setDelivery((d) => ({ ...d, from_location_id: e.target.value }))} disabled={isReadOnly}>
            <option value="">Select location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} {l.warehouse_name ? `(${l.warehouse_name})` : ''}</option>)}
          </Select>
        </div>
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-300">Products</h2>
          {!isReadOnly && <Button variant="ghost" icon={Plus} size="sm" onClick={addItem}>Add Product</Button>}
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_120px_32px] gap-3 text-xs text-gray-500 font-medium px-1">
            <span>Product</span><span>Quantity</span><span />
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_32px] gap-3 items-center">
              <Select value={item.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)} disabled={isReadOnly}>
                <option value="">Select product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — {p.current_stock} avail.</option>)}
              </Select>
              <Input type="number" min="1" value={item.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} disabled={isReadOnly} />
              {!isReadOnly && (
                <button onClick={() => removeItem(i)} className="text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
