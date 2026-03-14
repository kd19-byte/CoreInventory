import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header  } from './Header'
import { ToastContainer } from '@/components/ui/Toast'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useInventoryStore } from '@/store'

export function AppLayout() {
  const { setWarehouses, setCategories, setProducts } = useInventoryStore()

  // Bootstrap global data once on layout mount
  useEffect(() => {
    const load = async () => {
      const [{ data: wh }, { data: cats }, { data: prods }] = await Promise.all([
        supabase.from('warehouses').select('*').order('name'),
        supabase.from('product_categories').select('*').order('name'),
        supabase.from('products').select('*, product_categories(name)').order('name'),
      ])
      if (wh)   setWarehouses(wh)
      if (cats) setCategories(cats)
      if (prods) setProducts(prods)
    }
    load()
  }, [setWarehouses, setCategories, setProducts])

  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <Header  />
      <main className="ml-[220px] pt-14 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <ToastContainer />
    </div>
  )
}
