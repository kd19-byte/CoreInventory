import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { useInventoryStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

export default function AdjustmentsPage() {
  const { products, locations, setProducts } = useInventoryStore()
  const toast = useToast()

  const [form, setForm] = useState({ product_id: '', location_id: '', counted_qty: '' })
  const [systemQty, setSystemQty] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }))

  const handleProductChange = async (productId) => {
    set('product_id', productId)
    if (!productId) { setSystemQty(null); return }
    if (form.location_id) {
      try {
        const { qty } = await api.get(`/stock?product_id=${productId}&location_id=${form.location_id}`)
        setSystemQty(qty)
      } catch (err) {
        toast.error('Failed to load stock', err.message)
        setSystemQty(null)
      }
    } else {
      const prod = products.find((p) => p.id === productId)
      setSystemQty(prod?.current_stock ?? 0)
    }
  }

  const handleLocationChange = async (locationId) => {
    set('location_id', locationId)
    if (!form.product_id) return
    if (locationId) {
      try {
        const { qty } = await api.get(`/stock?product_id=${form.product_id}&location_id=${locationId}`)
        setSystemQty(qty)
      } catch (err) {
        toast.error('Failed to load stock', err.message)
        setSystemQty(null)
      }
    } else {
      const prod = products.find((p) => p.id === form.product_id)
      setSystemQty(prod?.current_stock ?? 0)
    }
  }

  const difference = form.counted_qty !== '' ? Number(form.counted_qty) - (systemQty ?? 0) : null

  const handleApply = async () => {
    if (!form.product_id || !form.location_id || form.counted_qty === '') { toast.warning('Fill all fields'); return }
    setSaving(true)

    try {
      const { diff } = await api.post('/adjustments', {
        product_id: form.product_id,
        location_id: form.location_id,
        counted_qty: Number(form.counted_qty),
      })
      const { data: prodData } = await api.get('/products')
      if (prodData) setProducts(prodData)
      toast.success('Adjustment applied', `Stock updated by ${diff > 0 ? '+' : ''}${diff}`)
      setForm({ product_id: '', location_id: '', counted_qty: '' })
      setSystemQty(null)
    } catch (err) {
      toast.error('Failed to apply', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl flex flex-col gap-5">
      <p className="page-title">Stock Adjustment</p>
      <p className="text-sm text-gray-500 -mt-3">Fix mismatches between recorded and physical stock count.</p>

      <div className="card p-5 flex flex-col gap-4">
        <Select label="Product" value={form.product_id} onChange={(e) => handleProductChange(e.target.value)}>
          <option value="">Select product</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </Select>

        <Select label="Location" value={form.location_id} onChange={(e) => handleLocationChange(e.target.value)}>
          <option value="">Select location</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.warehouse_name ?? '—'}</option>)}
        </Select>

        {systemQty !== null && (
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">System quantity</span>
            <span className="font-mono text-sm text-gray-300">{systemQty}</span>
          </div>
        )}

        <Input
          label="Counted Quantity (physical count)"
          type="number"
          min="0"
          value={form.counted_qty}
          onChange={(e) => set('counted_qty', e.target.value)}
          placeholder="Enter what you physically counted"
        />

        {difference !== null && (
          <div className={`rounded-lg px-4 py-3 flex items-center justify-between text-sm
            ${difference === 0 ? 'bg-gray-900 border border-gray-800' :
              difference > 0  ? 'bg-emerald-950/40 border border-emerald-900' :
                                'bg-red-950/40 border border-red-900'}`}>
            <span className="text-gray-500 text-xs">Difference</span>
            <span className={`font-mono font-medium
              ${difference === 0 ? 'text-gray-400' : difference > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {difference > 0 ? `+${difference}` : difference}
            </span>
          </div>
        )}

        <Button variant="primary" icon={CheckCircle} loading={saving} onClick={handleApply} className="self-end">
          Apply Adjustment
        </Button>
      </div>
    </div>
  )
}
