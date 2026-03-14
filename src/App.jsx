import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/lib/AuthContext'

// Layout guards
import { AppLayout }      from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { RoleRoute } from '@/components/layout/RoleRoute'

// Auth pages
import LoginPage          from '@/pages/auth/LoginPage'
import SignupPage         from '@/pages/auth/SignupPage'
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/auth/ForgotPasswordPage'

// App pages
import DashboardPage      from '@/pages/dashboard/DashboardPage'
import ProductsPage       from '@/pages/products/ProductsPage'
import ProductDetailPage  from '@/pages/products/ProductDetailPage'
import ReceiptsPage       from '@/pages/receipts/ReceiptsPage'
import ReceiptDetailPage  from '@/pages/receipts/ReceiptDetailPage'
import DeliveryPage       from '@/pages/delivery/DeliveryPage'
import DeliveryDetailPage from '@/pages/delivery/DeliveryDetailPage'
import { TransfersPage, TransferDetailPage } from '@/pages/transfers/TransfersPages'
import AdjustmentsPage    from '@/pages/adjustments/AdjustmentsPage'
import HistoryPage        from '@/pages/history/HistoryPage'
import SettingsPage       from '@/pages/settings/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Root redirect ─────────────────────────── */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* ── Public auth routes ─────────────────────────── */}
          <Route path="/auth/login"          element={<LoginPage />} />
          <Route path="/auth/signup"         element={<SignupPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password"  element={<ResetPasswordPage />} />

          {/* ── Protected app routes ───────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard"         element={<DashboardPage />} />

              {/* Products */}
              <Route path="/products"          element={<ProductsPage />} />
              <Route path="/products/:id"      element={<ProductDetailPage />} />

              {/* Receipts */}
              <Route path="/receipts"          element={<ReceiptsPage />} />
              <Route path="/receipts/:id"      element={<ReceiptDetailPage />} />

              {/* Delivery */}
              <Route path="/delivery"          element={<DeliveryPage />} />
              <Route path="/delivery/:id"      element={<DeliveryDetailPage />} />

              {/* Internal Transfers */}
              <Route path="/transfers"         element={<TransfersPage />} />
              <Route path="/transfers/:id"     element={<TransferDetailPage />} />

              {/* Adjustments */}
              <Route path="/adjustments"       element={<AdjustmentsPage />} />

              {/* Move History */}
              <Route path="/history"           element={<HistoryPage />} />

              {/* Settings */}
              <Route element={<RoleRoute roles={['manager']} />}>
                <Route path="/settings"        element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
