import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useInventoryStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { generateRef } from '@/utils'

export default function AdjustmentsPage() {
  const { products } = useInventoryStore()
  const [locations, setLocations] = useState([])
  const toast = useToast()

  const [form, setForm] = useState({ product_id: '', location_id: '', counted_qty: '' })
  const [systemQty, setSystemQty] = useState(null)
  const [saving, setSaving] = useState(false)

  // Load locations once
  useState(() => {
    supabase.from('locations').select('*, warehouses(name)').then(({ data }) => setLocations(data ?? []))
  })

  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }))

  const handleProductChange = async (productId) => {
    set('product_id', productId)
    if (!productId) { setSystemQty(null); return }
    const { data } = await supabase.from('products').select('current_stock').eq('id', productId).single()
    setSystemQty(data?.current_stock ?? 0)
  }

  const difference = form.counted_qty !== '' ? Number(form.counted_qty) - (systemQty ?? 0) : null

  const handleApply = async () => {
    if (!form.product_id || form.counted_qty === '') { toast.warning('Fill all fields'); return }
    setSaving(true)

    const diff = Number(form.counted_qty) - (systemQty ?? 0)

    // Update product stock
    await supabase.from('products').update({ current_stock: Number(form.counted_qty) }).eq('id', form.product_id)

    // Log to ledger
    await supabase.from('stock_ledger').insert([{
      product_id: form.product_id,
      location_id: form.location_id || null,
      quantity_change: diff,
      type: 'adjustment',
      reference_id: null,
    }])

    // Log to adjustments table
    await supabase.from('stock_adjustments').insert([{
      reference: generateRef('ADJ'),
      product_id: form.product_id,
      location_id: form.location_id || null,
      system_qty: systemQty ?? 0,
      counted_qty: Number(form.counted_qty),
      difference: diff,
      reason: 'Manual count adjustment',
    }])

    toast.success('Adjustment applied', `Stock updated by ${diff > 0 ? '+' : ''}${diff}`)
    setForm({ product_id: '', location_id: '', counted_qty: '' })
    setSystemQty(null)
    setSaving(false)
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

        <Select label="Location (optional)" value={form.location_id} onChange={(e) => set('location_id', e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.warehouses?.name}</option>)}
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
