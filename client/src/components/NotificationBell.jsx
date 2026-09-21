import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'

function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead, clearNotifications } = useSocket()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = () => {
    if (!isOpen && unreadCount > 0) {
      markAllAsRead()
    }
    setIsOpen(!isOpen)
  }

  const handleNotificationClick = (item) => {
    setIsOpen(false)
    const reportId = item.data?.reportId || item.data?.id
    if (!reportId) return

    if (user?.role === 'admin') {
      navigate(`/admin/tickets/${reportId}`)
    } else if (user?.role === 'staff') {
      navigate(`/staff/tickets/${reportId}`)
    } else {
      navigate(`/citizen/reports/${reportId}`)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 transition focus:outline-none"
        title="Live Notifications"
      >
        <span className="text-lg leading-none">🔔</span>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-gray-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🔔</span>
              <h4 className="text-xs font-bold uppercase tracking-wider">Live Updates</h4>
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="text-[11px] text-gray-400 hover:text-white transition"
              >
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                <span className="text-2xl block mb-1">📭</span>
                No new notifications in this session.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className="p-3 hover:bg-orange-50/60 cursor-pointer transition text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{item.title}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-gray-600 line-clamp-2">{item.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
