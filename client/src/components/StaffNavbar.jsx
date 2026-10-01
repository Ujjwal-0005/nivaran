import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationBell from './NotificationBell'

function StaffNavbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="bg-sovereign-indigo text-white shadow-md sticky top-0 z-40">
      <div className="max-w-xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-kesariya flex items-center justify-center text-sm flex-shrink-0">
            🏗️
          </div>
          <div className="leading-none">
            <span className="font-display font-bold text-white text-sm tracking-tight block">
              Nivaran
              <span className="ml-1.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-white/15 text-white/80">
                Staff
              </span>
            </span>
            <span className="text-[10px] text-white/50 font-body">{user?.name}</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={handleLogout}
            className="text-[11px] font-semibold text-white/70 hover:text-white border border-white/20 hover:border-white/40 px-2.5 py-1 rounded transition"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}

export default StaffNavbar
