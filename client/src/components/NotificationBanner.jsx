import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'

function NotificationBanner() {
  const { socket } = useSocket()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeToast, setActiveToast] = useState(null)

  useEffect(() => {
    if (!socket) return

    const showToast = (toastData) => {
      setActiveToast(toastData)
      const timer = setTimeout(() => {
        setActiveToast(null)
      }, 7000) // Dismiss after 7 seconds
      return () => clearTimeout(timer)
    }

    const handleStatusUpdate = (data) => {
      showToast({
        id: Date.now(),
        type: 'status_update',
        title: `Status Updated: ${data.ticketId}`,
        message: data.message || `Ticket is now ${data.status}`,
        reportId: data.reportId,
        color: 'border-blue-500 bg-blue-50 text-blue-900',
        icon: '🔄',
      })
    }

    const handleNewAssignment = (data) => {
      showToast({
        id: Date.now(),
        type: 'new_assignment',
        title: `New Assignment: ${data.ticketId}`,
        message: data.message || `Assigned to: ${data.category}`,
        reportId: data.reportId,
        color: 'border-emerald-500 bg-emerald-50 text-emerald-900',
        icon: '📋',
      })
    }

    const handleTicketEscalated = (data) => {
      showToast({
        id: Date.now(),
        type: 'ticket_escalated',
        title: `🚨 Escalation Alert: ${data.ticketId}`,
        message: data.message || `Ticket has breached SLA deadline (+50 Priority)`,
        reportId: data.id,
        color: 'border-red-600 bg-red-50 text-red-900 animate-pulse',
        icon: '🚨',
      })
    }

    const handleNewComment = (data) => {
      showToast({
        id: Date.now(),
        type: 'new_comment',
        title: `New Comment on ${data.ticketId}`,
        message: data.message || `A note was added`,
        reportId: data.reportId,
        color: 'border-purple-500 bg-purple-50 text-purple-900',
        icon: '💬',
      })
    }

    socket.on('status_update', handleStatusUpdate)
    socket.on('new_assignment', handleNewAssignment)
    socket.on('ticket_escalated', handleTicketEscalated)
    socket.on('new_comment', handleNewComment)

    return () => {
      socket.off('status_update', handleStatusUpdate)
      socket.off('new_assignment', handleNewAssignment)
      socket.off('ticket_escalated', handleTicketEscalated)
      socket.off('new_comment', handleNewComment)
    }
  }, [socket])

  if (!activeToast) return null

  const handleClick = () => {
    const reportId = activeToast.reportId
    setActiveToast(null)
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
    <div className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div
        onClick={handleClick}
        className={`p-4 rounded-2xl shadow-2xl border-2 ${activeToast.color} cursor-pointer hover:shadow-xl transition flex items-start gap-3`}
      >
        <span className="text-2xl flex-shrink-0">{activeToast.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider">{activeToast.title}</h4>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setActiveToast(null)
              }}
              className="text-gray-400 hover:text-gray-600 text-xs leading-none p-0.5"
            >
              ✕
            </button>
          </div>
          <p className="text-xs font-medium mt-0.5 line-clamp-2">{activeToast.message}</p>
          <span className="text-[10px] font-bold underline mt-1 inline-block opacity-80">
            Click to view ticket →
          </span>
        </div>
      </div>
    </div>
  )
}

export default NotificationBanner
