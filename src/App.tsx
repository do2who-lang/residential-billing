import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { I18nProvider } from '@/context/I18nContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { AppShell } from '@/components/layout/AppShell';
import { AdminRoute, ProtectedRoute } from '@/routes/guards';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { PeriodsPage } from '@/pages/PeriodsPage';
import { PeriodDetailPage } from '@/pages/PeriodDetailPage';
import { ApartmentsPage } from '@/pages/ApartmentsPage';
import { ApartmentDetailPage } from '@/pages/ApartmentDetailPage';
import { ServicesPage } from '@/pages/ServicesPage';
import { ResidentsPage } from '@/pages/ResidentsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { MyApartmentPage } from '@/pages/MyApartmentPage';
import { PrintApartmentPage, PrintPeriodPage } from '@/pages/PrintPages';
import { NotFoundPage } from '@/pages/NotFoundPage';

function admin(element: React.ReactNode) {
  return (
    <ProtectedRoute>
      <AdminRoute>{element}</AdminRoute>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <SettingsProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Admin area, rendered inside the app shell */}
              <Route
                element={
                  <ProtectedRoute>
                    <AdminRoute>
                      <AppShell />
                    </AdminRoute>
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/periods" element={<PeriodsPage />} />
                <Route path="/periods/:periodId" element={<PeriodDetailPage />} />
                <Route path="/apartments" element={<ApartmentsPage />} />
                <Route path="/apartments/:apartmentId" element={<ApartmentDetailPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/residents" element={<ResidentsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Resident area */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/my" element={<MyApartmentPage />} />
              </Route>

              {/* Print layouts (outside the shell so only the paper prints) */}
              <Route path="/periods/:periodId/print" element={admin(<PrintPeriodPage />)} />
              <Route
                path="/apartments/:apartmentId/print"
                element={admin(<PrintApartmentPage />)}
              />
              <Route
                path="/my/print"
                element={
                  <ProtectedRoute>
                    <PrintApartmentPage />
                  </ProtectedRoute>
                }
              />

              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </SettingsProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
