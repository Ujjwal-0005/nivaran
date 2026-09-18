import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

function CitizenDashboard() {
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
            <h1 className="text-3xl font-bold text-gray-800">Citizen Dashboard</h1>
            <p className="text-gray-600">Welcome, {user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/citizen/report')}>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Report an Issue</h2>
            <p className="text-gray-600">Submit a new civic issue report with photo and location</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition" onClick={() => navigate('/citizen/reports')}>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">My Reports</h2>
            <p className="text-gray-600">View and track your submitted reports</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CitizenDashboard
