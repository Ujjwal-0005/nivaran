import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

function AdminNavbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const navItems = [
    { name: 'Dashboard', path: '/admin', end: true },
    { name: 'Live Map', path: '/admin/map' },
    { name: 'All Tickets', path: '/admin/tickets' },
    { name: 'Disputes', path: '/admin/disputes' },
    { name: 'Staff', path: '/admin/staff' },
    { name: 'Dept & Categories', path: '/admin/departments' },
  ]

  return (
    <header className="bg-gray-900 text-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center font-bold text-lg shadow">
              🏛️
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white block leading-none">
                Nivaran <span className="text-orange-400 text-xs font-semibold uppercase px-1.5 py-0.5 rounded bg-orange-950/60 border border-orange-700/50">Admin</span>
              </span>
              <span className="text-xs text-gray-400 leading-none">Municipality Portal</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-gray-800 text-orange-400 shadow-inner'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* User profile, notifications & logout */}
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white leading-tight">{user?.name || 'Admin'}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role || 'Admin'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile secondary scroll nav */}
        <div className="md:hidden flex overflow-x-auto pb-2 gap-1 scrollbar-none border-t border-gray-800 pt-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1 rounded text-xs font-medium transition ${
                  isActive
                    ? 'bg-gray-800 text-orange-400 font-semibold'
                    : 'text-gray-400 hover:text-white'
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  )
}

export default AdminNavbar
