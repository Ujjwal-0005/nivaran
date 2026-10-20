import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import NotificationBanner from './components/NotificationBanner'
import ProtectedRoute from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'

// Eager load public entry routes for instant initial render
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'

// Lazy load feature and role modules
const NotFound = lazy(() => import('./pages/NotFound'))
const VerifyOTP = lazy(() => import('./pages/VerifyOTP'))
const SetPassword = lazy(() => import('./pages/SetPassword'))
const PublicTransparency = lazy(() => import('./pages/PublicTransparency'))

// Citizen Pages
const CitizenDashboard = lazy(() => import('./pages/citizen/CitizenDashboard'))
const ReportIssue = lazy(() => import('./pages/citizen/ReportIssue'))
const MyReports = lazy(() => import('./pages/citizen/MyReports'))
const ReportDetail = lazy(() => import('./pages/citizen/ReportDetail'))
const NearbyIssues = lazy(() => import('./pages/citizen/NearbyIssues'))

// Staff Pages
const StaffDashboard = lazy(() => import('./pages/staff/StaffDashboard'))
const StaffTicketDetail = lazy(() => import('./pages/staff/StaffTicketDetail'))

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminMap = lazy(() => import('./pages/admin/AdminMap'))
const AdminTickets = lazy(() => import('./pages/admin/AdminTickets'))
const AdminTicketDetail = lazy(() => import('./pages/admin/AdminTicketDetail'))
const AdminStaff = lazy(() => import('./pages/admin/AdminStaff'))
const AdminDepartments = lazy(() => import('./pages/admin/AdminDepartments'))
const AdminDisputes = lazy(() => import('./pages/admin/AdminDisputes'))
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'))

// SuperAdmin Pages
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard'))
const SuperAdminMunicipalities = lazy(() => import('./pages/superadmin/SuperAdminMunicipalities'))
const SuperAdminAuditLog = lazy(() => import('./pages/superadmin/SuperAdminAuditLog'))
const CityDetail = lazy(() => import('./pages/superadmin/CityDetail'))
const SuperAdminAdmins = lazy(() => import('./pages/superadmin/SuperAdminAdmins'))
const SuperAdminCityRequests = lazy(() => import('./pages/superadmin/SuperAdminCityRequests'))

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-sovereign-indigo border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading page…</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
        <BrowserRouter>
          <NotificationBanner />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/transparency" element={<PublicTransparency />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/set-password" element={<SetPassword />} />
            
            {/* Protected Routes */}
            <Route 
              path="/citizen" 
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <CitizenDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/citizen/report" 
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <ReportIssue />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/citizen/reports" 
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <MyReports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/citizen/reports/:id" 
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <ReportDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/citizen/nearby" 
              element={
                <ProtectedRoute allowedRoles={['citizen']}>
                  <NearbyIssues />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/staff" 
              element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/staff/tickets/:id" 
              element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffTicketDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/analytics" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminAnalytics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/map" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminMap />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/tickets" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminTickets />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/tickets/:id" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminTicketDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/staff" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminStaff />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/departments" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDepartments />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/disputes" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDisputes />
                </ProtectedRoute>
              } 
            />

            {/* ── Super Admin Routes ── */}
            <Route 
              path="/superadmin" 
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/superadmin/municipalities" 
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <SuperAdminMunicipalities />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/superadmin/municipalities/:id" 
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <CityDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/superadmin/admins" 
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <SuperAdminAdmins />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/superadmin/city-requests" 
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <SuperAdminCityRequests />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/superadmin/audit-log" 
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <SuperAdminAuditLog />
                </ProtectedRoute>
              } 
            />
            {/* Catch-all 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
