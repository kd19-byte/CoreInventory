import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useInventoryStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

function EditableRow({ item, fields, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [values, setValues]   = useState(item)

  const handleSave = () => { onSave(values); setEditing(false) }
  const set = (f, v) => setValues((prev) => ({ ...prev, [f]: v }))

  if (editing) {
    return (
      <tr className="border-b border-gray-800 bg-gray-900/40">
        {fields.map((f) => (
          <td key={f.key} className="px-4 py-2">
            {f.type === 'select' ? (
              <select value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}
                className="input-base text-xs py-1">
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}
                className="input-base text-xs py-1" />
            )}
          </td>
        ))}
        <td className="px-4 py-2">
          <div className="flex gap-1">
            <button onClick={handleSave} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={13} /></button>
            <button onClick={() => setEditing(false)} className="p-1 text-gray-600 hover:text-gray-400"><X size={13} /></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/40 transition-colors">
      {fields.map((f) => (
        <td key={f.key} className="px-4 py-3 text-sm text-gray-300">
          {f.render ? f.render(item[f.key], item) : item[f.key] ?? '—'}
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button onClick={() => setEditing(true)} className="p-1 text-gray-600 hover:text-gray-300"><Pencil size={13} /></button>
          <button onClick={() => onDelete(item.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

function SectionCard({ title, columns, rows, fields, onAdd, onSave, onDelete, addLabel }) {
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({})
  const set = (f, v) => setNewRow((p) => ({ ...p, [f]: v }))

  const handleAdd = () => { onAdd(newRow); setNewRow({}); setAdding(false) }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-300">{title}</h2>
        <Button variant="ghost" icon={Plus} size="sm" onClick={() => setAdding(true)}>{addLabel}</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {columns.map((c) => (
                <th key={c} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{c}</th>
              ))}
              <th className="px-4 py-2 w-20" />
            </tr>
          </thead>
          <tbody>
            {adding && (
              <tr className="border-b border-gray-800 bg-gray-900/40">
                {fields.map((f) => (
                  <td key={f.key} className="px-4 py-2">
                    {f.type === 'select' ? (
                      <select value={newRow[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} className="input-base text-xs py-1">
                        <option value="">Select…</option>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input value={newRow[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}
                        placeholder={f.placeholder} className="input-base text-xs py-1" />
                    )}
                  </td>
                ))}
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={handleAdd} className="p-1 text-emerald-400 hover:text-emerald-300"><Check size={13} /></button>
                    <button onClick={() => setAdding(false)} className="p-1 text-gray-600 hover:text-gray-400"><X size={13} /></button>
                  </div>
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <EditableRow key={row.id} item={row} fields={fields} onSave={(v) => onSave(row.id, v)} onDelete={onDelete} />
            ))}
            {rows.length === 0 && !adding && (
              <tr><td colSpan={columns.length + 1} className="text-center py-8 text-gray-600 text-xs">No records yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { warehouses, setWarehouses } = useInventoryStore()
  const [locations, setLocations] = useState([])
  const toast = useToast()

  useEffect(() => {
    supabase.from('locations').select('*, warehouses(name)').order('name').then(({ data }) => setLocations(data ?? []))
  }, [])

  // ─── Warehouse CRUD ──────────────────────────────────────────
  const addWarehouse = async (data) => {
    const { data: wh } = await supabase.from('warehouses').insert([data]).select().single()
    if (wh) { setWarehouses([...warehouses, wh]); toast.success('Warehouse added') }
  }
  const saveWarehouse = async (id, data) => {
    await supabase.from('warehouses').update(data).eq('id', id)
    setWarehouses(warehouses.map((w) => w.id === id ? { ...w, ...data } : w))
    toast.success('Warehouse updated')
  }
  const deleteWarehouse = async (id) => {
    if (!window.confirm('Delete this warehouse?')) return
    await supabase.from('warehouses').delete().eq('id', id)
    setWarehouses(warehouses.filter((w) => w.id !== id))
    toast.success('Warehouse deleted')
  }

  // ─── Location CRUD ───────────────────────────────────────────
  const addLocation = async (data) => {
    const { data: loc } = await supabase.from('locations').insert([data]).select('*, warehouses(name)').single()
    if (loc) { setLocations([...locations, loc]); toast.success('Location added') }
  }
  const saveLocation = async (id, data) => {
    await supabase.from('locations').update(data).eq('id', id)
    setLocations(locations.map((l) => l.id === id ? { ...l, ...data } : l))
    toast.success('Location updated')
  }
  const deleteLocation = async (id) => {
    if (!window.confirm('Delete this location?')) return
    await supabase.from('locations').delete().eq('id', id)
    setLocations(locations.filter((l) => l.id !== id))
  }

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <SectionCard
        title="Warehouses"
        addLabel="Add Warehouse"
        columns={['Name', 'Short Code', 'Address']}
        rows={warehouses}
        fields={[
          { key: 'name',       placeholder: 'Main Warehouse' },
          { key: 'short_code', placeholder: 'MAIN' },
          { key: 'address',    placeholder: '123 Street, City' },
        ]}
        onAdd={addWarehouse}
        onSave={saveWarehouse}
        onDelete={deleteWarehouse}
      />

      <SectionCard
        title="Locations"
        addLabel="Add Location"
        columns={['Name', 'Short Code', 'Warehouse']}
        rows={locations}
        fields={[
          { key: 'name',         placeholder: 'Rack A' },
          { key: 'short_code',   placeholder: 'RK-A' },
          {
            key: 'warehouse_id', type: 'select',
            render: (_, row) => row.warehouses?.name ?? '—',
            options: warehouses.map((w) => ({ value: w.id, label: w.name })),
          },
        ]}
        onAdd={addLocation}
        onSave={saveLocation}
        onDelete={deleteLocation}
      />
    </div>
  )
}
