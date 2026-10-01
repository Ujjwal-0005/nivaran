import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

const NAV_ITEMS = [
  { label: 'होम', labelEn: 'Home', path: '/citizen', end: true },
  { label: 'रिपोर्ट करें', labelEn: 'Report Issue', path: '/citizen/report' },
  { label: 'मेरी शिकायतें', labelEn: 'My Reports', path: '/citizen/reports' },
  { label: 'पास की समस्याएं', labelEn: 'Nearby', path: '/citizen/nearby' },
]

function CitizenNavbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="bg-sovereign-indigo text-white shadow-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <NavLink to="/citizen" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded bg-kesariya flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              🏛
            </div>
            <div className="leading-none">
              <span className="font-display font-bold text-white text-base tracking-tight">
                Nivaran
              </span>
              <span className="block text-[10px] text-white/50 font-body">
                नागरिक पोर्टल
              </span>
            </div>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                <span className="hidden lg:inline">{item.labelEn}</span>
                <span className="lg:hidden">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-white leading-tight truncate max-w-[100px]">
                {user?.name || 'Citizen'}
              </p>
              <p className="text-[10px] text-white/50">नागरिक</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-[11px] font-semibold text-white/70 hover:text-white border border-white/20 hover:border-white/40 px-2.5 py-1 rounded transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile bottom scroll nav */}
        <div className="md:hidden flex overflow-x-auto scrollbar-none gap-1 pb-1.5 border-t border-white/10 pt-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1 rounded text-xs font-medium transition ${
                  isActive
                    ? 'bg-white/20 text-white font-semibold'
                    : 'text-white/60 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  )
}

export default CitizenNavbar
