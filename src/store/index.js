import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Warehouse store (persisted) ────────────────────────────
export const useWarehouseStore = create(
  persist(
    (set) => ({
      selectedWarehouseId: null,
      setWarehouse: (id) => set({ selectedWarehouseId: id }),
    }),
    { name: 'coreinventory-warehouse' }
  )
)

// ─── UI store (toasts, modals, sidebar) ─────────────────────
export const useUIStore = create((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  toasts: [],
  addToast: (toast) =>
    set((s) => ({
      toasts: [...s.toasts, { id: Date.now(), ...toast }],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// ─── Inventory store (cached data + loading states) ─────────
export const useInventoryStore = create((set) => ({
  products:    [],
  warehouses:  [],
  locations:   [],
  categories:  [],

  setProducts:   (products)   => set({ products }),
  setWarehouses: (warehouses) => set({ warehouses }),
  setLocations:  (locations)  => set({ locations }),
  setCategories: (categories) => set({ categories }),
}))
