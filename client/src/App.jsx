import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import VerifyOTP from './pages/VerifyOTP'
import CitizenDashboard from './pages/citizen/CitizenDashboard'
import ReportIssue from './pages/citizen/ReportIssue'
import MyReports from './pages/citizen/MyReports'
import ReportDetail from './pages/citizen/ReportDetail'
import StaffDashboard from './pages/staff/StaffDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            path="/staff" 
            element={
              <ProtectedRoute allowedRoles={['staff']}>
                <StaffDashboard />
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
