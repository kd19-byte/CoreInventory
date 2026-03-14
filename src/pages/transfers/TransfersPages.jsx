// ─── Transfers List ──────────────────────────────────────────
import { OperationList } from '@/components/shared/OperationList'

export function TransfersPage() {
  return (
    <OperationList
      table="internal_transfers"
      newRoute="/transfers/new"
      detailRoute="/transfers"
      title="Transfer"
      extraColumns={[]}
    />
  )
}

// ─── Transfer Detail ─────────────────────────────────────────
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useInventoryStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { generateRef } from '@/utils'

export function TransferDetailPage() {
  const { id } = useParams(); const isNew = id === 'new'
  const navigate = useNavigate()
  const { warehouses, products } = useInventoryStore()
  const toast = useToast()
  const [locations, setLocations] = useState([])

  const [form, setForm] = useState({
    reference: generateRef('TRF'), from_location_id: '', to_location_id: '',
    product_id: '', quantity: 1, scheduled_date: new Date().toISOString().split('T')[0], status: 'draft',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('locations').select('*, warehouses(name)').then(({ data }) => setLocations(data ?? []))
    if (!isNew) {
      supabase.from('internal_transfers').select('*').eq('id', id).single().then(({ data }) => { if (data) setForm(data) })
    }
  }, [id, isNew])

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }))

  const handleValidate = async () => {
    setSaving(true)
    // Deduct from source, add to destination
    const { data: prod } = await supabase.from('products').select('current_stock').eq('id', form.product_id).single()
    if ((prod?.current_stock ?? 0) < Number(form.quantity)) {
      toast.error('Insufficient stock'); setSaving(false); return
    }
    const refId = isNew ? null : id
    await Promise.all([
      supabase.from('stock_ledger').insert([{ product_id: form.product_id, location_id: form.from_location_id, quantity_change: -Number(form.quantity), type: 'transfer', reference_id: refId }]),
      supabase.from('stock_ledger').insert([{ product_id: form.product_id, location_id: form.to_location_id,   quantity_change:  Number(form.quantity), type: 'transfer', reference_id: refId }]),
    ])
    if (!isNew) await supabase.from('internal_transfers').update({ status: 'done' }).eq('id', id)
    toast.success('Transfer validated')
    set('status', 'done')
    setSaving(false)
  }

  const handleSave = async () => {
    setSaving(true)
    if (isNew) {
      const { data, error } = await supabase.from('internal_transfers').insert([form]).select().single()
      if (error) { toast.error('Save failed'); setSaving(false); return }
      toast.success('Transfer saved'); navigate(`/transfers/${data.id}`)
    } else {
      await supabase.from('internal_transfers').update(form).eq('id', id)
      toast.success('Transfer updated')
    }
    setSaving(false)
  }

  const isReadOnly = form.status === 'done' || form.status === 'canceled'

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" icon={ArrowLeft} size="sm" onClick={() => navigate('/transfers')} />
        <p className="page-title">{form.reference}</p>
        <StatusBadge status={form.status} />
        <div className="ml-auto flex gap-2">
          {!isReadOnly && <>
            <Button variant="success" icon={CheckCircle} size="sm" onClick={handleValidate} loading={saving}>Validate</Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>Save</Button>
          </>}
        </div>
      </div>

      <div className="card p-5 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-gray-300">Transfer Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Select label="From Location" value={form.from_location_id} onChange={(e) => set('from_location_id', e.target.value)} disabled={isReadOnly}>
            <option value="">Select location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.warehouses?.name})</option>)}
          </Select>
          <Select label="To Location" value={form.to_location_id} onChange={(e) => set('to_location_id', e.target.value)} disabled={isReadOnly}>
            <option value="">Select location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.warehouses?.name})</option>)}
          </Select>
          <Select label="Product" value={form.product_id} onChange={(e) => set('product_id', e.target.value)} disabled={isReadOnly}>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.current_stock} avail.</option>)}
          </Select>
          <Input label="Quantity" type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} disabled={isReadOnly} />
          <Input label="Scheduled Date" type="date" value={form.scheduled_date} onChange={(e) => set('scheduled_date', e.target.value)} disabled={isReadOnly} />
        </div>
      </div>
    </div>
  )
}
