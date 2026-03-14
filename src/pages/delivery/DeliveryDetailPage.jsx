import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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
  const { warehouses, products } = useInventoryStore()
  const toast = useToast()

  const [delivery, setDelivery] = useState({
    reference: generateRef('DEL'), customer: '', warehouse_id: '',
    scheduled_date: new Date().toISOString().split('T')[0], status: 'draft',
  })
  const [items, setItems]   = useState([{ product_id: '', quantity: 1 }])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)

  useEffect(() => {
    if (isNew) return
    const load = async () => {
      const { data: d }  = await supabase.from('delivery_orders').select('*').eq('id', id).single()
      const { data: di } = await supabase.from('delivery_items').select('*').eq('delivery_id', id)
      if (d)  setDelivery(d)
      if (di) setItems(di)
      setLoading(false)
    }
    load()
  }, [id, isNew])

  const addItem    = () => setItems((p) => [...p, { product_id: '', quantity: 1 }])
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i))
  const updateItem = (i, f, v) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it))

  const handleSave = async () => {
    setSaving(true)
    if (isNew) {
      const { data, error } = await supabase.from('delivery_orders').insert([delivery]).select().single()
      if (error) { toast.error('Save failed', error.message); setSaving(false); return }
      await supabase.from('delivery_items').insert(items.map((it) => ({ ...it, delivery_id: data.id })))
      toast.success('Delivery saved')
      navigate(`/delivery/${data.id}`)
    } else {
      await supabase.from('delivery_orders').update(delivery).eq('id', id)
      await supabase.from('delivery_items').delete().eq('delivery_id', id)
      await supabase.from('delivery_items').insert(items.map((it) => ({ ...it, delivery_id: id })))
      toast.success('Delivery updated')
    }
    setSaving(false)
  }

  const handleValidate = async () => {
    // Check stock availability before validating
    for (const item of items) {
      if (!item.product_id) continue
      const { data: prod } = await supabase.from('products').select('name, current_stock').eq('id', item.product_id).single()
      if ((prod?.current_stock ?? 0) < Number(item.quantity)) {
        toast.error('Insufficient stock', `${prod?.name} only has ${prod?.current_stock} units available`)
        return
      }
    }

    if (!window.confirm('Validate delivery? Stock will be deducted.')) return
    setSaving(true)

    for (const item of items) {
      if (!item.product_id) continue
      const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single()
      await supabase.from('products').update({ current_stock: (prod?.current_stock ?? 0) - Number(item.quantity) }).eq('id', item.product_id)
      await supabase.from('stock_ledger').insert([{
        product_id: item.product_id, location_id: delivery.warehouse_id,
        quantity_change: -Number(item.quantity), type: 'delivery', reference_id: id,
      }])
    }

    await supabase.from('delivery_orders').update({ status: 'done' }).eq('id', id)
    setDelivery((d) => ({ ...d, status: 'done' }))
    toast.success('Delivery validated', 'Stock has been deducted')
    setSaving(false)
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this delivery?')) return
    await supabase.from('delivery_orders').update({ status: 'canceled' }).eq('id', id)
    setDelivery((d) => ({ ...d, status: 'canceled' }))
    toast.info('Delivery canceled')
  }

  const isReadOnly = ['done', 'canceled'].includes(delivery.status)
  if (loading) return <div className="text-gray-600 text-sm p-8">Loading…</div>

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" icon={ArrowLeft} size="sm" onClick={() => navigate('/delivery')} />
        <div>
          <p className="page-title">{delivery.reference}</p>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(delivery.scheduled_date)}</p>
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
          <Input label="Reference" value={delivery.reference} onChange={(e) => setDelivery((d) => ({ ...d, reference: e.target.value }))} disabled={isReadOnly} />
          <Input label="Customer"  value={delivery.customer}  onChange={(e) => setDelivery((d) => ({ ...d, customer:  e.target.value }))} disabled={isReadOnly} placeholder="Customer name" />
          <Select label="Warehouse" value={delivery.warehouse_id} onChange={(e) => setDelivery((d) => ({ ...d, warehouse_id: e.target.value }))} disabled={isReadOnly}>
            <option value="">Select warehouse</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
          <Input label="Scheduled Date" type="date" value={delivery.scheduled_date} onChange={(e) => setDelivery((d) => ({ ...d, scheduled_date: e.target.value }))} disabled={isReadOnly} />
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
              <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} disabled={isReadOnly} />
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
