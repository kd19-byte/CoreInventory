import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header  } from './Header'
import { ToastContainer } from '@/components/ui/Toast'
import { useEffect } from 'react'
import { api } from '@/lib/api'
import { useInventoryStore } from '@/store'

export function AppLayout() {
  const { setWarehouses, setCategories, setProducts, setLocations } = useInventoryStore()

  // Bootstrap global data once on layout mount
  useEffect(() => {
    const load = async () => {
      try {
        const { warehouses, locations, products, categories } = await api.get('/bootstrap')
        if (warehouses) setWarehouses(warehouses)
        if (locations) setLocations(locations)
        if (products) setProducts(products)
        if (categories) setCategories(categories)
      } catch (err) {
        console.error('Failed to load bootstrap data', err)
      }
    }
    load()
  }, [setWarehouses, setCategories, setProducts, setLocations])

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
