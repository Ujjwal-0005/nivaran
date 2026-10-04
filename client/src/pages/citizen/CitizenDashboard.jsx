import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import CitizenNavbar from '../../components/CitizenNavbar'

const CARDS = [
  {
    title: 'Report an Issue',
    titleHi: 'शिकायत दर्ज करें',
    description: 'Submit a new civic complaint with photo and geo-location.',
    path: '/citizen/report',
    icon: '📋',
    accent: '#E65100', // kesariya
  },
  {
    title: 'My Reports',
    titleHi: 'मेरी शिकायतें',
    description: 'View, track, comment on, and rate your submitted reports.',
    path: '/citizen/reports',
    icon: '📂',
    accent: '#6A1B9A',
  },
  {
    title: 'Browse Nearby Issues',
    titleHi: 'पास की समस्याएं',
    description: 'Explore open civic issues in your neighbourhood on a live map.',
    path: '/citizen/nearby',
    icon: '🗺️',
    accent: '#0277BD',
  },
]

function CitizenDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page-shell">
      <CitizenNavbar />

      <main className="page-content">
        {/* Welcome banner */}
        <div className="bg-sovereign-indigo text-white rounded-lg px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-white/60 text-xs uppercase tracking-widest font-semibold mb-0.5">{greeting}</p>
            <h1 className="font-display text-2xl font-bold">{user?.name || 'Citizen'}</h1>
            <p className="text-white/50 text-xs mt-1">
              {user?.city && user?.state ? `${user.city}, ${user.state}` : 'Citizen Dashboard'}
            </p>
          </div>
          <div className="text-5xl opacity-20 select-none hidden sm:block">🏛️</div>
        </div>

        {/* Action cards */}
        <div>
          <div className="section-header">
            <h2 className="font-display font-bold text-sovereign-indigo text-lg">What would you like to do?</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {CARDS.map((card) => (
              <button
                key={card.path}
                onClick={() => navigate(card.path)}
                className="card-nivaran p-5 text-left hover:shadow-md hover:border-earthen-slate-dark transition-all group active:scale-[0.98]"
                style={{ borderLeftColor: card.accent, borderLeftWidth: '3px' }}
              >
                <div
                  className="text-3xl mb-3 group-hover:scale-110 transition-transform"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                >
                  {card.icon}
                </div>
                <h3 className="font-display font-bold text-sovereign-indigo text-base mb-0.5">
                  {card.title}
                </h3>
                <p className="text-[11px] text-kesariya font-semibold mb-2">{card.titleHi}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{card.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Transparency link */}
        <div className="card-nivaran px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-gray-700">पारदर्शिता · Public Transparency</p>
            <p className="text-xs text-gray-400 mt-0.5">Live municipal performance data — open to all citizens</p>
          </div>
          <button
            onClick={() => navigate('/transparency')}
            className="text-xs font-semibold text-kesariya hover:text-civic-flame whitespace-nowrap transition"
          >
            View Dashboard →
          </button>
        </div>
      </main>
    </div>
  )
}

export default CitizenDashboard
