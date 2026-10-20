import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/superadmin', icon: '🏠', label: 'Dashboard' },
  { to: '/superadmin/municipalities', icon: '🏙️', label: 'Cities' },
  { to: '/superadmin/admins', icon: '👥', label: 'Admins' },
  { to: '/superadmin/city-requests', icon: '📬', label: 'City Requests' },
  { to: '/superadmin/audit-log', icon: '📋', label: 'Audit Log' },
]

function SuperAdminLayout({ children, title }) {
  const { logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="w-64 bg-sovereign-indigo text-white flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-kesariya flex items-center justify-center text-lg">🏛</div>
            <div>
              <div className="font-display font-bold text-base">Nivaran</div>
              <div className="text-white/50 text-xs">Super Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, icon, label }) => {
            const active = to === '/superadmin'
              ? location.pathname === '/superadmin'
              : location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: logout */}
        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            id="superadmin-logout"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold text-sovereign-indigo">{title}</h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-medium">
            Super Admin
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default SuperAdminLayout
