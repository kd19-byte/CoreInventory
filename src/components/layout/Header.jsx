import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, AlertTriangle, XCircle } from 'lucide-react'
import { useInventoryStore } from '@/store'

const TITLES = {
  '/dashboard':    'Dashboard',
  '/products':     'Products',
  '/receipts':     'Receipts',
  '/delivery':     'Delivery Orders',
  '/transfers':    'Internal Transfers',
  '/adjustments':  'Stock Adjustments',
  '/history':      'Move History',
  '/settings':     'Settings',
}

export function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const products = useInventoryStore((s) => s.products)
  const [open, setOpen] = useState(false)

  // Match on prefix for nested routes (e.g. /receipts/new)
  const title = Object.entries(TITLES).find(([key]) => pathname.startsWith(key))?.[1] ?? 'CoreInventory'
  const alerts = useMemo(() => {
    const out = []
    const low = []
    for (const p of products) {
      const stock = Number(p.current_stock ?? 0)
      const threshold = Number(p.low_stock_threshold ?? 0)
      if (stock === 0) out.push(p)
      else if (threshold > 0 && stock <= threshold) low.push(p)
    }
    return { out, low, count: out.length + low.length }
  }, [products])

  const openLowStock = () => {
    setOpen(false)
    navigate('/products?filter=low')
  }

  const openOutOfStock = () => {
    setOpen(false)
    navigate('/products?filter=out')
  }

  return (
    <header className="fixed top-0 left-[220px] right-0 h-14 bg-gray-950 border-b border-gray-800 z-20
                       flex items-center justify-between px-6 gap-4">
      <h1 className="text-sm font-semibold text-gray-100">{title}</h1>

      <div className="flex items-center gap-3 ml-auto relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500
                     hover:text-gray-300 hover:bg-gray-800 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell size={15} />
          {alerts.count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-red-600 rounded-full
                             text-[10px] leading-4 text-white font-semibold text-center">
              {alerts.count > 9 ? '9+' : alerts.count}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute top-10 right-0 w-72 rounded-xl border border-gray-800 bg-gray-900 shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-800">
              <p className="text-xs font-semibold text-gray-200">Stock Alerts</p>
            </div>

            {alerts.count === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-500">No low-stock or out-of-stock alerts.</p>
            ) : (
              <div className="p-2 flex flex-col gap-1.5">
                <button
                  onClick={openOutOfStock}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <p className="text-xs font-medium text-red-300 flex items-center gap-1.5">
                    <XCircle size={13} /> Out of stock
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{alerts.out.length} products need immediate restock</p>
                </button>

                <button
                  onClick={openLowStock}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <p className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Low stock
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{alerts.low.length} products are below threshold</p>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
