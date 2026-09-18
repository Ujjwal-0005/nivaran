import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

function StaffDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Staff Dashboard</h1>
            <p className="text-gray-600">Welcome, {user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Staff dashboard - Manage assigned tickets</p>
          <p className="text-sm text-gray-500 mt-2">Role: {user?.role}</p>
        </div>
      </div>
    </div>
  )
}

export default StaffDashboard
