import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

function CitizenDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const cards = [
    {
      title: 'Report an Issue',
      description: 'Submit a new civic issue report with photo and location',
      path: '/citizen/report',
      icon: '📋',
      color: 'border-blue-200 hover:border-blue-400',
    },
    {
      title: 'My Reports',
      description: 'View, track, comment on, and rate your submitted reports',
      path: '/citizen/reports',
      icon: '📂',
      color: 'border-purple-200 hover:border-purple-400',
    },
    {
      title: 'Browse Nearby Issues',
      description: 'Explore open civic reports in your neighbourhood on a map',
      path: '/citizen/nearby',
      icon: '🗺️',
      color: 'border-green-200 hover:border-green-400',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Citizen Dashboard</h1>
            <p className="text-gray-500 mt-1">Welcome back, {user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm"
          >
            Logout
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {cards.map(card => (
            <div
              key={card.path}
              onClick={() => navigate(card.path)}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 cursor-pointer transition ${card.color}`}
            >
              <div className="text-3xl mb-3">{card.icon}</div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">{card.title}</h2>
              <p className="text-gray-500 text-sm">{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CitizenDashboard
