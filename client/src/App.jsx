import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import NotificationBanner from './components/NotificationBanner'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import VerifyOTP from './pages/VerifyOTP'
import CitizenDashboard from './pages/citizen/CitizenDashboard'
import ReportIssue from './pages/citizen/ReportIssue'
import MyReports from './pages/citizen/MyReports'
import ReportDetail from './pages/citizen/ReportDetail'
import NearbyIssues from './pages/citizen/NearbyIssues'
import StaffDashboard from './pages/staff/StaffDashboard'
import StaffTicketDetail from './pages/staff/StaffTicketDetail'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminMap from './pages/admin/AdminMap'
import AdminTickets from './pages/admin/AdminTickets'
import AdminTicketDetail from './pages/admin/AdminTicketDetail'
import AdminStaff from './pages/admin/AdminStaff'
import AdminDepartments from './pages/admin/AdminDepartments'
import AdminDisputes from './pages/admin/AdminDisputes'

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <NotificationBanner />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            
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
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
