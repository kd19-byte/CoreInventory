# CoreInventory
This is our hackathon project

A modular Inventory Management System built with React + Vite + TailwindCSS + MySQL (via an Express API).

---

## Quick Start (6 steps)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
cp .env.example .env
# Fill in DB_* for MySQL and VITE_API_URL for the frontend
# Fill JWT_* and MAIL_* to enable secure login sessions + OTP email reset
```

### 3. Create the MySQL schema
Run `mysql_schema.sql` against your MySQL server:
```bash
mysql -u root -p < mysql_schema.sql
```

### 4. Start the API server
```bash
npm run dev:server
```

### 5. Start the frontend
```bash
npm run dev
```

Open http://localhost:5173 → Sign up → Start managing inventory.

Note:
- Forgot password now uses email OTP. If `MAIL_*` is not configured, reset codes are logged in the API console for local development.
- You can use either SMTP (`MAIL_PROVIDER=smtp`) or Resend (`MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RESEND_FROM`).

---

## Project Structure

```
src/
├── App.jsx                        # Root router (all routes defined here)
├── main.jsx                       # React entry point
├── index.css                      # Global styles + Tailwind + design tokens
│
├── lib/
│   ├── api.js                     # REST API client (MySQL backend)
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
| MySQL + Express API | Simple REST backend instead of Supabase |
| `stock_ledger` as current stock | Stock is stored per product/location and updated on validation |
| `stock_moves` for operations | Receipts, deliveries, transfers, adjustments are all moves |
| Multi-line operations | Multiple items share the same `ref` in `stock_moves` |
| `OperationList` shared component | Receipts, Delivery, and Transfers all have identical list UX — one component, no duplication |
| Zustand for global state | Warehouses, locations, categories, and products are loaded once at layout mount and shared across all pages |
| `generateRef()` for references | Produces `REC/123456` style references client-side so forms work offline until saved |

---

## Deploy to Vercel

```bash
npm run build
npx vercel deploy --prod
```

Add env vars in Vercel dashboard:
- `VITE_API_URL`
