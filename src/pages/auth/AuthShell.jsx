import { BarChart3, Boxes, ShieldCheck, Truck } from 'lucide-react'

const highlights = [
  {
    title: 'Live stock visibility',
    description: 'Track quantities by warehouse and location in real time.',
    icon: BarChart3,
  },
  {
    title: 'Traceable operations',
    description: 'Receipts, deliveries, and transfers are grouped by reference.',
    icon: Truck,
  },
  {
    title: 'Role-based access',
    description: 'Keep critical inventory actions limited to trusted staff.',
    icon: ShieldCheck,
  },
]

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-950 text-gray-100">
      <div className="pointer-events-none absolute left-1/2 top-[-140px] h-72 w-72 -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center p-4 sm:p-6 lg:p-10">
        <div className="grid w-full overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/80 backdrop-blur lg:grid-cols-[1.1fr_1fr]">
          <aside className="hidden border-r border-gray-800 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 px-8 py-10 lg:block">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/90">
                <Boxes size={19} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-gray-100">CoreInventory</p>
                <p className="text-xs text-gray-500">Inventory Operations Console</p>
              </div>
            </div>

            <div className="mb-8 space-y-3">
              <p className="text-xs uppercase tracking-[0.22em] text-brand-300/90">Operations first</p>
              <h1 className="text-3xl font-semibold leading-tight text-gray-100">
                Built for teams who move stock daily.
              </h1>
            </div>

            <div className="space-y-5">
              {highlights.map((item) => (
                <div key={item.title} className="rounded-xl border border-gray-800/90 bg-gray-900/70 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <item.icon size={15} className="text-brand-300" />
                    <p className="text-sm font-medium text-gray-100">{item.title}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-gray-400">{item.description}</p>
                </div>
              ))}
            </div>
          </aside>

          <main className="px-5 py-7 sm:px-7 sm:py-9">
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
                <Boxes size={17} className="text-white" />
              </div>
              <p className="text-base font-semibold">CoreInventory</p>
            </div>

            <div className="mx-auto w-full max-w-sm">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-100">{title}</h2>
              <p className="mt-2 text-sm text-gray-400">{subtitle}</p>

              <div className="mt-6">{children}</div>

              {footer && <div className="mt-6 text-center text-xs text-gray-500">{footer}</div>}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
