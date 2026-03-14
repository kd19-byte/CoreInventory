# CoreInventory

A modular Inventory Management System built with React + Vite + TailwindCSS + Supabase.

---

## Quick Start (5 steps)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
- Go to https://supabase.com → New project
- Copy your **Project URL** and **anon public key**

### 3. Configure environment
```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 4. Run the SQL migration
- Open Supabase → SQL Editor → New Query
- Paste the contents of `supabase_migration.sql` → Run

### 5. Start the dev server
```bash
npm run dev
```

Open http://localhost:5173 → Sign up → Start managing inventory.

---

## Project Structure

```
src/
├── App.jsx                        # Root router (all routes defined here)
├── main.jsx                       # React entry point
├── index.css                      # Global styles + Tailwind + design tokens
│
├── lib/
│   ├── supabase.js                # Supabase client singleton
│   └── AuthContext.jsx            # Auth state: session, signIn, signOut, OTP reset
│
├── store/
│   └── index.js                   # Zustand: warehouse selector, UI toasts, inventory cache
│
├── utils/
│   └── index.js                   # cn(), formatDate(), statusClass(), generateRef()
│
├── types/
│   └── index.js                   # JSDoc type definitions for all entities
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx          # Sidebar + Header + <Outlet> wrapper
│   │   ├── Sidebar.jsx            # Left nav with collapsible Operations group
│   │   ├── Header.jsx             # Top bar: page title, search, notifications
│   │   └── ProtectedRoute.jsx     # Redirects unauthenticated users to /auth/login
│   │
│   ├── ui/
│   │   ├── Button.jsx             # Button: primary / secondary / danger / ghost / success
│   │   ├── Input.jsx              # Input, Select, Textarea (all with label + error)
│   │   ├── Badge.jsx              # Badge, StatusBadge, KpiCard
│   │   ├── Table.jsx              # Table + TableSkeleton + empty state
│   │   └── Toast.jsx              # Toast container + useToast() hook
│   │
│   └── shared/
│       └── OperationList.jsx      # Reusable list page (used by Receipts, Delivery, Transfers)
│
└── pages/
    ├── auth/
    │   ├── LoginPage.jsx
    │   ├── SignupPage.jsx
    │   └── ForgotPasswordPage.jsx  # Also exports ResetPasswordPage
    │
    ├── dashboard/
    │   └── DashboardPage.jsx       # KPIs, bar chart, recent ops, quick actions
    │
    ├── products/
    │   ├── ProductsPage.jsx        # List + SKU search + category filter
    │   └── ProductDetailPage.jsx   # Create / Edit + per-location stock table
    │
    ├── receipts/
    │   ├── ReceiptsPage.jsx
    │   └── ReceiptDetailPage.jsx   # Draft→Waiting→Ready→Done flow + line items
    │
    ├── delivery/
    │   ├── DeliveryPage.jsx
    │   └── DeliveryDetailPage.jsx  # Draft→Ready→Done + stock availability check
    │
    ├── transfers/
    │   └── TransfersPages.jsx      # Exports TransfersPage + TransferDetailPage
    │
    ├── adjustments/
    │   └── AdjustmentsPage.jsx     # Physical count form + live difference indicator
    │
    ├── history/
    │   └── HistoryPage.jsx         # Grouped ledger view (collapse/expand by reference)
    │
    └── settings/
        └── SettingsPage.jsx        # Inline-editable Warehouse + Location tables
```

---

## Key Design Decisions

| Decision | Why |
|---|---|
| Supabase RLS enabled | Every table is protected — only authenticated users can read/write |
| `current_stock` on products | Denormalised for fast dashboard KPI queries without summing the ledger every time |
| Every stock change → `stock_ledger` | Full audit trail; grouped by `reference_id` in Move History |
| `OperationList` shared component | Receipts, Delivery, and Transfers all have identical list UX — one component, no duplication |
| Zustand for global state | Warehouses, categories, and products are loaded once at layout mount and shared across all pages |
| `generateRef()` for references | Produces `REC/123456` style references client-side so forms work offline until saved |

---

## Deploy to Vercel

```bash
npm run build
npx vercel deploy --prod
```

Add env vars in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
