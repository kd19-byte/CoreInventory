import { useEffect, useMemo, useState } from 'react'
import { Play, Plus, Save, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useInventoryStore } from '@/store'
import { Table } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

function emptyItem() {
  return { product_id: '', qty: '', supplier: '' }
}

export default function SmartStacksPage() {
  const { user } = useAuth()
  const toast = useToast()
  const products = useInventoryStore((s) => s.products)
  const locations = useInventoryStore((s) => s.locations)

  const [stacks, setStacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [creatingSample, setCreatingSample] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const [form, setForm] = useState({
    id: null,
    name: '',
    description: '',
    frequency: 'monthly',
    to_location_id: '',
    next_due_at: '',
    items: [emptyItem()],
  })

  const selectedStack = useMemo(
    () => stacks.find((s) => Number(s.id) === Number(selectedId)) || null,
    [stacks, selectedId]
  )

  const resetForm = () => {
    setForm({
      id: null,
      name: '',
      description: '',
      frequency: 'monthly',
      to_location_id: '',
      next_due_at: '',
      items: [emptyItem()],
    })
    setSelectedId(null)
    setSelectedItems([])
  }

  const loadStacks = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/stacks')
      const rows = data ?? []
      setStacks(rows)

      if (!rows.length) {
        resetForm()
        return
      }

      const hasSelected = rows.some((s) => Number(s.id) === Number(selectedId))
      if (!selectedId || !hasSelected) setSelectedId(rows[0].id)
    } catch (err) {
      toast.error('Failed to load stacks', err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadStackDetail = async (id) => {
    if (!id) return
    try {
      const { data, items } = await api.get(`/stacks/${id}`)
      setSelectedItems(items ?? [])
      setForm({
        id: data.id,
        name: data.name || '',
        description: data.description || '',
        frequency: data.frequency || 'monthly',
        to_location_id: data.to_location_id || '',
        next_due_at: data.next_due_at ? String(data.next_due_at).slice(0, 10) : '',
        items: (items ?? []).map((i) => ({
          product_id: i.product_id,
          qty: i.qty,
          supplier: i.supplier || '',
        })),
      })
    } catch (err) {
      if ((err.message || '').toLowerCase().includes('not found')) {
        // Selected stack was deleted or is stale; recover to a valid selection.
        await loadStacks()
        return
      }
      toast.error('Failed to load stack details', err.message)
    }
  }

  useEffect(() => {
    loadStacks()
  }, [])

  useEffect(() => {
    if (selectedId) loadStackDetail(selectedId)
  }, [selectedId])

  const saveStack = async () => {
    if (user?.role !== 'manager') return
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        frequency: form.frequency,
        to_location_id: Number(form.to_location_id),
        next_due_at: form.next_due_at || null,
        items: form.items
          .filter((i) => i.product_id && Number(i.qty) > 0)
          .map((i) => ({
            product_id: Number(i.product_id),
            qty: Number(i.qty),
            supplier: i.supplier || null,
          })),
      }
      if (!payload.name || !payload.to_location_id || payload.items.length === 0) {
        toast.warning('Missing fields', 'Name, location, and at least one valid item are required.')
        return
      }

      if (form.id) await api.put(`/stacks/${form.id}`, payload)
      else await api.post('/stacks', payload)

      toast.success('Stack saved', 'Smart Stack updated successfully.')
      await loadStacks()
      if (!form.id && stacks.length) setSelectedId(stacks[0].id)
    } catch (err) {
      toast.error('Failed to save stack', err.message)
    } finally {
      setSaving(false)
    }
  }

  const executeStack = async (id) => {
    setExecuting(true)
    try {
      const result = await api.post(`/stacks/${id}/execute`, {})
      toast.success('Stack executed', `${result.count} draft receipts created.`)
      await loadStacks()
      await loadStackDetail(id)
    } catch (err) {
      toast.error('Execution failed', err.message)
    } finally {
      setExecuting(false)
    }
  }

  const deleteStack = async (id) => {
    if (user?.role !== 'manager') return
    if (!window.confirm('Delete this stack? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await api.del(`/stacks/${id}`)
      toast.success('Stack deleted', 'Smart Stack removed successfully.')
      if (Number(selectedId) === Number(id)) resetForm()
      await loadStacks()
    } catch (err) {
      toast.error('Failed to delete stack', err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const createSampleStack = async () => {
    if (user?.role !== 'manager') return
    const preferredLocation =
      locations.find((l) => l.type === 'internal') ||
      locations[0]
    if (!preferredLocation) {
      toast.warning('No location found', 'Create at least one location before adding a sample stack.')
      return
    }
    if (!products.length) {
      toast.warning('No products found', 'Create products first, then add a sample stack.')
      return
    }

    const sampleDefs = [
      { match: /(sugar)/i, qty: 50 },
      { match: /(wheat|flour)/i, qty: 100 },
      { match: /(oil)/i, qty: 30 },
      { match: /(cold.*drink|drink|beverage)/i, qty: 24 },
      { match: /(ice.*cream)/i, qty: 12 },
    ]

    const selected = []
    const usedIds = new Set()
    for (const def of sampleDefs) {
      const product = products.find((p) => !usedIds.has(p.id) && def.match.test(String(p.name || '')))
      if (!product) continue
      usedIds.add(product.id)
      selected.push({ product_id: Number(product.id), qty: def.qty, supplier: null })
    }

    if (selected.length < 3) {
      for (const p of products) {
        if (usedIds.has(p.id)) continue
        selected.push({ product_id: Number(p.id), qty: Number(p.reorder_qty || 10), supplier: null })
        usedIds.add(p.id)
        if (selected.length >= 5) break
      }
    }

    if (!selected.length) {
      toast.warning('Unable to create sample', 'No usable products found for sample items.')
      return
    }

    setCreatingSample(true)
    try {
      const result = await api.post('/stacks', {
        name: 'Monthly Essentials',
        description: 'Sample stack for recurring monthly warehouse replenishment.',
        frequency: 'monthly',
        to_location_id: Number(preferredLocation.id),
        items: selected,
      })
      toast.success('Sample stack added', 'Monthly Essentials was created successfully.')
      await loadStacks()
      if (result?.id) setSelectedId(result.id)
    } catch (err) {
      toast.error('Failed to add sample stack', err.message)
    } finally {
      setCreatingSample(false)
    }
  }

  const updateItem = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  const stackColumns = [
    { key: 'name', label: 'Stack' },
    { key: 'frequency', label: 'Frequency', render: (v) => <span className="uppercase text-xs text-gray-500">{v}</span> },
    { key: 'to_location_name', label: 'Location' },
    { key: 'item_count', label: 'Items', align: 'right' },
    { key: 'next_due_at', label: 'Next Due' },
    {
      key: 'status',
      label: 'Status',
      render: (_, row) => row.is_overdue
        ? <span className="text-xs text-red-300">OVERDUE {row.overdue_days}d</span>
        : <span className="text-xs text-emerald-300">On Track</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedId(row.id)
            }}
            className="px-2 py-1 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 text-xs inline-flex items-center gap-1"
          >
            <Pencil size={12} />
            Edit
          </button>
          {user?.role === 'manager' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteStack(row.id)
              }}
              disabled={deletingId === row.id}
              className="px-2 py-1 rounded border border-red-800 text-red-300 hover:bg-red-950/40 disabled:opacity-50 text-xs inline-flex items-center gap-1"
            >
              <Trash2 size={12} />
              {deletingId === row.id ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="card">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-300">Saved Stacks</h2>
          <div className="flex items-center gap-2">
            {user?.role === 'manager' && (
              <Button size="sm" variant="secondary" loading={creatingSample} onClick={createSampleStack}>
                Add Sample Stack
              </Button>
            )}
            <Button size="sm" icon={RefreshCw} onClick={loadStacks}>Refresh</Button>
          </div>
        </div>
        <Table
          columns={stackColumns}
          data={loading ? [] : stacks}
          onRowClick={(row) => setSelectedId(row.id)}
          emptyMessage={loading ? 'Loading stacks...' : 'No stacks created yet'}
        />
      </div>

      <div className="card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-300">{form.id ? 'Edit Smart Stack' : 'Create Smart Stack'}</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" icon={Plus} onClick={resetForm}>New</Button>
            {selectedStack && (
              <Button size="sm" variant="success" icon={Play} loading={executing} onClick={() => executeStack(selectedStack.id)}>
                Execute
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Stack Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select label="Frequency" value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </Select>
          <Select label="Receipt Location" value={form.to_location_id} onChange={(e) => setForm((f) => ({ ...f, to_location_id: e.target.value }))}>
            <option value="">Select location</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
          <Input type="date" label="Next Due Date" value={form.next_due_at} onChange={(e) => setForm((f) => ({ ...f, next_due_at: e.target.value }))} />
        </div>

        <Input
          label="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Monthly essentials, supplier context, notes..."
        />

        <div className="border border-gray-800 rounded-lg">
          <div className="px-3 py-2 border-b border-gray-800 text-xs text-gray-400 font-medium">Stack Items</div>
          <div className="p-3 flex flex-col gap-2">
            {form.items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <Select value={item.product_id} onChange={(e) => updateItem(index, { product_id: e.target.value })}>
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input type="number" min="0" step="0.01" placeholder="Qty" value={item.qty} onChange={(e) => updateItem(index, { qty: e.target.value })} />
                </div>
                <div className="col-span-3">
                  <Input placeholder="Supplier" value={item.supplier} onChange={(e) => updateItem(index, { supplier: e.target.value })} />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))}>Add Item</Button>
              {form.items.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => setForm((f) => ({ ...f, items: f.items.slice(0, -1) }))}>
                  Remove Last
                </Button>
              )}
            </div>
          </div>
        </div>

        {selectedItems.length > 0 && (
          <div className="border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">Current stock impact preview</p>
            <div className="grid gap-1">
              {selectedItems.map((item) => (
                <div key={`${item.id}-${item.product_id}`} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">{item.product_name}</span>
                  <span className={item.is_low_stock ? 'text-red-300' : 'text-emerald-300'}>
                    need {item.qty} · stock {item.current_stock}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-1">
          {user?.role === 'manager' ? (
            <Button variant="primary" icon={Save} loading={saving} onClick={saveStack}>
              {form.id ? 'Save Changes' : 'Create Stack'}
            </Button>
          ) : (
            <p className="text-xs text-gray-500">Only managers can create or edit stacks. Staff can execute existing stacks.</p>
          )}
        </div>
      </div>
    </div>
  )
}
