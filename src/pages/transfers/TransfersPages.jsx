// ─── Transfers List ──────────────────────────────────────────
import { OperationList } from '@/components/shared/OperationList'

export function TransfersPage() {
  return (
    <OperationList
      type="transfer"
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
import { api } from '@/lib/api'
import { useInventoryStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { generateRef } from '@/utils'

export function TransferDetailPage() {
  const { id } = useParams(); const isNew = id === 'new'
  const navigate = useNavigate()
  const { locations, products, setProducts } = useInventoryStore()
  const toast = useToast()

  const [form, setForm] = useState({
    reference: generateRef('TRF'), from_location_id: '', to_location_id: '',
    product_id: '', quantity: 1, status: 'draft',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isNew) {
      api.get(`/operations/${id}`).then(({ header, items }) => {
        const item = items?.[0]
        setForm({
          reference: header.ref,
          from_location_id: header.from_location_id ?? '',
          to_location_id: header.to_location_id ?? '',
          product_id: item?.product_id ?? '',
          quantity: item?.qty ?? 1,
          status: header.status,
        })
      }).catch((err) => toast.error('Failed to load', err.message))
    }
  }, [id, isNew])

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }))

  const handleValidate = async () => {
    if (isNew) { toast.warning('Save the transfer before validating'); return }
    setSaving(true)
    try {
      await api.post(`/operations/${id}/validate`)
      const { data: prodData } = await api.get('/products')
      if (prodData) setProducts(prodData)
      toast.success('Transfer validated')
      set('status', 'done')
    } catch (err) {
      toast.error('Validation failed', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        type: 'transfer',
        ref: form.reference,
        status: form.status,
        from_location_id: form.from_location_id,
        to_location_id: form.to_location_id,
        items: [{ product_id: form.product_id, qty: form.quantity }],
      }
      if (isNew) {
        await api.post('/operations', payload)
        toast.success('Transfer saved'); navigate(`/transfers/${form.reference}`)
      } else {
        await api.put(`/operations/${id}`, payload)
        toast.success('Transfer updated')
      }
    } catch (err) {
      toast.error('Save failed', err.message)
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
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} {l.warehouse_name ? `(${l.warehouse_name})` : ''}</option>)}
          </Select>
          <Select label="To Location" value={form.to_location_id} onChange={(e) => set('to_location_id', e.target.value)} disabled={isReadOnly}>
            <option value="">Select location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} {l.warehouse_name ? `(${l.warehouse_name})` : ''}</option>)}
          </Select>
          <Select label="Product" value={form.product_id} onChange={(e) => set('product_id', e.target.value)} disabled={isReadOnly}>
            <option value="">Select product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.current_stock} avail.</option>)}
          </Select>
          <Input label="Quantity" type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} disabled={isReadOnly} />
        </div>
      </div>
    </div>
  )
}
