import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ArrowDownToLine, ArrowUpFromLine,
  ArrowLeftRight, ClipboardList, History, Settings, LogOut,
  Boxes, ChevronDown
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { useWarehouseStore, useInventoryStore } from '@/store'
import { cn } from '@/utils'
import { useState } from 'react'

const NAV = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/products',     label: 'Products',     icon: Package },
  {
    label: 'Operations', icon: ClipboardList, children: [
      { to: '/receipts',   label: 'Receipts',   icon: ArrowDownToLine },
      { to: '/delivery',   label: 'Delivery',   icon: ArrowUpFromLine },
      { to: '/transfers',  label: 'Transfers',  icon: ArrowLeftRight  },
      { to: '/adjustments',label: 'Adjustments',icon: ClipboardList   },
    ]
  },
  { to: '/history',      label: 'Move History', icon: History  },
  { to: '/settings',     label: 'Settings',     icon: Settings, roles: ['manager'] },
]

function NavGroup({ item }) {
  const [open, setOpen] = useState(true)
  const Icon = item.icon
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="nav-item w-full justify-between"
      >
        <span className="flex items-center gap-3">
          <Icon size={16} />
          {item.label}
        </span>
        <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 border-l border-gray-800 pl-3 flex flex-col gap-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) => cn('nav-item', isActive && 'active')}
            >
              <child.icon size={14} />
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const warehouses = useInventoryStore((s) => s.warehouses)
  const { selectedWarehouseId, setWarehouse } = useWarehouseStore()

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login')
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-[220px] bg-gray-950 border-r border-gray-800 flex flex-col z-30">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-gray-800 flex-shrink-0">
        <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
          <Boxes size={14} className="text-white" />
        </div>
        <span className="font-semibold text-gray-100 tracking-tight">CoreInventory</span>
      </div>

      {/* Warehouse selector */}
      {warehouses.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-800 flex-shrink-0">
          <select
            value={selectedWarehouseId ?? ''}
            onChange={(e) => setWarehouse(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-gray-300
                       focus:outline-none focus:ring-1 focus:ring-brand-500 appearance-none"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5">
        {NAV.filter((item) => !item.roles || item.roles.includes(user?.role)).map((item) =>
          item.children ? (
            <NavGroup key={item.label} item={item} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn('nav-item', isActive && 'active')}
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          )
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-800 px-3 py-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
          <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center text-xs font-semibold text-white">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-300 truncate">{user?.email ?? 'User'}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500">{user?.role ?? 'staff'}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="nav-item w-full text-red-500 hover:text-red-400 hover:bg-red-950/30"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
