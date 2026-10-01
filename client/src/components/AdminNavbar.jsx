import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

const NAV_ITEMS = [
  { name: 'Dashboard',       nameHi: 'डैशबोर्ड',  path: '/admin',              end: true },
  { name: 'Analytics',       nameHi: 'विश्लेषण',   path: '/admin/analytics' },
  { name: 'Live Map',        nameHi: 'मानचित्र',   path: '/admin/map' },
  { name: 'All Tickets',     nameHi: 'टिकट',       path: '/admin/tickets' },
  { name: 'Disputes',        nameHi: 'विवाद',      path: '/admin/disputes' },
  { name: 'Staff',           nameHi: 'कर्मचारी',   path: '/admin/staff' },
  { name: 'Dept & Categories', nameHi: 'विभाग',   path: '/admin/departments' },
]

function AdminNavbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="bg-sovereign-indigo text-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-kesariya flex items-center justify-center font-bold text-lg shadow flex-shrink-0">
              🏛️
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight text-white block leading-none">
                Nivaran{' '}
                <span className="text-kesariya text-xs font-semibold uppercase px-1.5 py-0.5 rounded bg-white/10 border border-white/20 ml-0.5">
                  Admin
                </span>
              </span>
              <span className="text-xs text-white/50 leading-none font-body">Municipality Portal · नगर पालिका</span>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/15 text-white font-semibold border-b-2 border-kesariya'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-white leading-tight">{user?.name || 'Admin'}</p>
              <p className="text-xs text-white/50 capitalize">{user?.role || 'admin'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-terracotta-alert/80 hover:bg-terracotta-alert text-white text-xs font-semibold px-3 py-1.5 rounded transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile scroll nav */}
        <div className="md:hidden flex overflow-x-auto pb-1.5 gap-1 scrollbar-none border-t border-white/10 pt-1">
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
              {item.nameHi}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  )
}

export default AdminNavbar
