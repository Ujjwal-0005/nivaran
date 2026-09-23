import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'
import StatusBadge from '../../components/StatusBadge'
import { useSocket } from '../../context/SocketContext'

function AdminDashboard() {
  const navigate = useNavigate()
  const { socket } = useSocket()
  const [reports, setReports] = useState([])
  const [disputedReports, setDisputedReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Phase 8: Live updates when a ticket escalates or comments occur
  useEffect(() => {
    if (!socket) return

    const handleRefresh = () => {
      fetchDashboardData()
    }

    socket.on('ticket_escalated', handleRefresh)
    socket.on('new_comment', handleRefresh)
    socket.on('status_update', handleRefresh)

    return () => {
      socket.off('ticket_escalated', handleRefresh)
      socket.off('new_comment', handleRefresh)
      socket.off('status_update', handleRefresh)
    }
  }, [socket])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [reportsRes, disputedRes] = await Promise.all([
        api.get('/api/reports'),
        api.get('/api/reports/disputed'),
      ])
      setReports(reportsRes.data.reports || [])
      setDisputedReports(disputedRes.data.reports || [])
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
      setError('Failed to fetch dashboard data. Make sure server is running.')
    } finally {
      setLoading(false)
    }
  }

  const now = new Date()

  // 1. Total open tickets (not resolved)
  const openTickets = reports.filter((r) => r.status !== 'resolved')
  
  // 2. Tickets breaching or near SLA (near deadline < 6 hours remaining)
  const breachingOrNearSla = openTickets.filter((r) => {
    if (r.isEscalated) return true
    if (!r.slaDeadline) return false
    const deadline = new Date(r.slaDeadline)
    const diffHours = (deadline - now) / (1000 * 60 * 60)
    return diffHours <= 6 // Breached or within 6 hours
  })

  // 3. Resolved this week (last 7 days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const resolvedThisWeek = reports.filter(
    (r) => r.status === 'resolved' && new Date(r.updatedAt || r.createdAt) >= sevenDaysAgo
  )

  // 4. Active disputes count
  const activeDisputesCount = disputedReports.length

  // "Needs Attention" feed: escalated + disputed tickets, sorted by priority
  const needsAttentionFeed = reports
    .filter((r) => r.isEscalated || r.status === 'disputed')
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
    .slice(0, 8)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Municipality Overview
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Live civic operations monitor, SLA escalations, and grievance triage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/map')}
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow transition flex items-center gap-1.5"
            >
              🗺️ Open Live Map
            </button>
            <button
              onClick={() => navigate('/admin/tickets')}
              className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition"
            >
              📋 All Tickets
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* 4 Quick Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1 */}
          <div
            onClick={() => navigate('/admin/tickets?status=open')}
            className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:shadow transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Open Tickets
              </span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 text-lg">📂</span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 mt-3">{openTickets.length}</p>
            <p className="text-xs text-gray-400 mt-1">Requiring municipal action</p>
          </div>

          {/* Card 2 */}
          <div
            onClick={() => navigate('/admin/tickets?escalated=true')}
            className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm hover:shadow transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                Breaching / Near SLA
              </span>
              <span className="p-2 rounded-xl bg-red-50 text-red-600 text-lg">⏱️</span>
            </div>
            <p className="text-3xl font-extrabold text-red-600 mt-3">
              {breachingOrNearSla.length}
            </p>
            <p className="text-xs text-red-500/80 mt-1">Escalated or &le; 6 hrs left</p>
          </div>

          {/* Card 3 */}
          <div
            onClick={() => navigate('/admin/tickets?status=resolved')}
            className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-sm hover:shadow transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                Resolved This Week
              </span>
              <span className="p-2 rounded-xl bg-green-50 text-green-700 text-lg">✅</span>
            </div>
            <p className="text-3xl font-extrabold text-green-700 mt-3">
              {resolvedThisWeek.length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Last 7 calendar days</p>
          </div>

          {/* Card 4 */}
          <div
            onClick={() => navigate('/admin/disputes')}
            className="bg-white rounded-2xl p-5 border border-orange-200 shadow-sm hover:shadow transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-700 uppercase tracking-wider">
                Active Disputes
              </span>
              <span className="p-2 rounded-xl bg-orange-50 text-orange-700 text-lg">⚠️</span>
            </div>
            <p className="text-3xl font-extrabold text-orange-600 mt-3">
              {activeDisputesCount}
            </p>
            <p className="text-xs text-orange-500/80 mt-1">Awaiting admin review</p>
          </div>
        </div>

        {/* Needs Attention Feed */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <h2 className="text-base font-bold text-gray-900">Needs Attention Feed</h2>
              <span className="text-xs text-gray-400">
                (Auto-Escalated & Disputed reports, sorted by priority)
              </span>
            </div>
            <button
              onClick={() => navigate('/admin/tickets')}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700"
            >
              View Full Queue →
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center items-center text-gray-400 text-sm">
              Loading queue...
            </div>
          ) : needsAttentionFeed.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              🎉 No urgent escalated or disputed tickets right now. All departments within SLA!
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {needsAttentionFeed.map((ticket) => {
                const isOverdue =
                  ticket.slaDeadline && new Date(ticket.slaDeadline) < now && ticket.status !== 'resolved'

                return (
                  <div
                    key={ticket._id}
                    onClick={() => navigate(`/admin/tickets/${ticket._id}`)}
                    className="p-5 hover:bg-orange-50/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                          {ticket.ticketId}
                        </span>
                        <StatusBadge status={ticket.status} size="sm" />
                        {ticket.isEscalated && (
                          <span className="bg-red-100 text-red-700 border border-red-300 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                            🚨 ESCALATED (+50)
                          </span>
                        )}
                        {ticket.status === 'disputed' && (
                          <span className="bg-orange-100 text-orange-800 border border-orange-300 text-xs font-semibold px-2 py-0.5 rounded">
                            Disputed by Citizen
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-900 font-semibold truncate">
                        <span>{ticket.category?.name || 'Issue'}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-xs font-normal text-gray-500">
                          {ticket.department?.name || 'Unassigned Dept'}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600 line-clamp-1">
                        {ticket.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 text-right flex-shrink-0">
                      <div>
                        <p className="text-xs text-gray-400">Assigned To</p>
                        <p className="text-xs font-medium text-gray-700">
                          {ticket.assignedTo ? ticket.assignedTo.name : '⚠️ Unassigned'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">Priority Score</p>
                        <p className="text-sm font-bold text-gray-900">
                          {ticket.priorityScore || 0}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-400">SLA Deadline</p>
                        <p
                          className={`text-xs font-medium ${
                            isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'
                          }`}
                        >
                          {ticket.slaDeadline
                            ? new Date(ticket.slaDeadline).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'None'}
                        </p>
                      </div>

                      <span className="text-gray-400 text-sm">→</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard
