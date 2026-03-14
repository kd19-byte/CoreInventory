import { useLocation } from 'react-router-dom'
import { Search, Bell } from 'lucide-react'

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

  // Match on prefix for nested routes (e.g. /receipts/new)
  const title = Object.entries(TITLES).find(([key]) => pathname.startsWith(key))?.[1] ?? 'CoreInventory'

  return (
    <header className="fixed top-0 left-[220px] right-0 h-14 bg-gray-950 border-b border-gray-800 z-20
                       flex items-center justify-between px-6 gap-4">
      <h1 className="text-sm font-semibold text-gray-100">{title}</h1>

      <div className="flex items-center gap-3 ml-auto">
        {/* Global search (cosmetic for now — wire to Cmdk later) */}
        <div className="relative hidden sm:block">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            placeholder="Search…"
            className="bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs
                       text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 w-44"
          />
        </div>

        {/* Notification bell (cosmetic) */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500
                           hover:text-gray-300 hover:bg-gray-800 transition-colors relative">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}
