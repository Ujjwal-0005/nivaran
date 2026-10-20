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
  const [setupStatus, setSetupStatus] = useState(null)
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
      const [reportsRes, disputedRes, setupRes] = await Promise.allSettled([
        api.get('/api/reports'),
        api.get('/api/reports/disputed'),
        api.get('/api/admin/setup-status'),
      ])
      if (reportsRes.status === 'fulfilled') setReports(reportsRes.value.data.reports || [])
      if (disputedRes.status === 'fulfilled') setDisputedReports(disputedRes.value.data.reports || [])
      if (setupRes.status === 'fulfilled') setSetupStatus(setupRes.value.data || null)
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
    <div className="page-shell flex flex-col">
      <AdminNavbar />

      <main className="flex-1 page-content-wide space-y-8">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-sovereign-indigo tracking-tight">
              Municipality Overview
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Live civic operations monitor, SLA escalations, and grievance triage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/map')}
              className="btn-kesariya text-sm flex items-center gap-1.5"
            >
              🗺️ Live Map
            </button>
            <button
              onClick={() => navigate('/admin/tickets')}
              className="btn-ghost text-sm"
            >
              📋 All Tickets
            </button>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {/* "Set up your city" Checklist Card (Shown while ready is false) */}
        {setupStatus && !setupStatus.ready && (
          <div className="card-nivaran p-6 border-l-4 border-l-kesariya bg-gradient-to-r from-kesariya/5 to-transparent shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚙️</span>
                  <h2 className="font-display text-lg font-bold text-sovereign-indigo">
                    Set up your city ({setupStatus.completion}% Complete)
                  </h2>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Complete these items before your city can route civic reports smoothly to departments and agencies.
                </p>
              </div>
              <div className="w-full sm:w-48 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-kesariya h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${setupStatus.completion}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Sectors without primary */}
              <div className="p-3.5 rounded-lg border border-gray-200/70 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">
                    Sectors without Primary Department:
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      setupStatus.sectorsWithoutPrimary.length === 0
                        ? 'bg-jan-kalyan-green/10 text-jan-kalyan-green'
                        : 'bg-terracotta-alert/10 text-terracotta-alert'
                    }`}
                  >
                    {setupStatus.sectorsWithoutPrimary.length === 0
                      ? '✓ All Set'
                      : `${setupStatus.sectorsWithoutPrimary.length} Missing`}
                  </span>
                </div>
                {setupStatus.sectorsWithoutPrimary.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <p className="truncate">
                      Missing: {setupStatus.sectorsWithoutPrimary.map((s) => s.name).join(', ')}
                    </p>
                    <button
                      onClick={() => navigate('/admin/departments')}
                      className="text-kesariya hover:underline font-semibold mt-1 inline-block"
                    >
                      Assign Primary Departments →
                    </button>
                  </div>
                )}
              </div>

              {/* Unverified external agencies */}
              <div className="p-3.5 rounded-lg border border-gray-200/70 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">
                    Unverified External Agencies:
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      setupStatus.unverifiedAgencies.count === 0
                        ? 'bg-jan-kalyan-green/10 text-jan-kalyan-green'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {setupStatus.unverifiedAgencies.count === 0
                      ? '✓ All Verified'
                      : `${setupStatus.unverifiedAgencies.count} Pending`}
                  </span>
                </div>
                {setupStatus.unverifiedAgencies.count > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <p className="truncate">
                      {setupStatus.unverifiedAgencies.names.join(', ')}
                    </p>
                    <button
                      onClick={() => navigate('/admin/departments?type=external')}
                      className="text-kesariya hover:underline font-semibold mt-1 inline-block"
                    >
                      Verify Agency Details →
                    </button>
                  </div>
                )}
              </div>

              {/* Municipal departments without staff */}
              <div className="p-3.5 rounded-lg border border-gray-200/70 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">
                    Municipal Depts without Staff:
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      setupStatus.municipalDepartmentsWithoutStaff.length === 0
                        ? 'bg-jan-kalyan-green/10 text-jan-kalyan-green'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {setupStatus.municipalDepartmentsWithoutStaff.length === 0
                      ? '✓ Staffed'
                      : `${setupStatus.municipalDepartmentsWithoutStaff.length} Unstaffed`}
                  </span>
                </div>
                {setupStatus.municipalDepartmentsWithoutStaff.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <p className="truncate">
                      Depts: {setupStatus.municipalDepartmentsWithoutStaff.map((d) => d.name).join(', ')}
                    </p>
                    <button
                      onClick={() => navigate('/admin/staff')}
                      className="text-kesariya hover:underline font-semibold mt-1 inline-block"
                    >
                      Review Staff Applications ({setupStatus.pendingStaffApplications} pending) →
                    </button>
                  </div>
                )}
              </div>

              {/* Unroutable categories */}
              <div className="p-3.5 rounded-lg border border-gray-200/70 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">
                    Unroutable Categories:
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      setupStatus.unroutableCategories.length === 0
                        ? 'bg-jan-kalyan-green/10 text-jan-kalyan-green'
                        : 'bg-terracotta-alert/10 text-terracotta-alert'
                    }`}
                  >
                    {setupStatus.unroutableCategories.length === 0
                      ? '✓ None'
                      : `${setupStatus.unroutableCategories.length} Categories`}
                  </span>
                </div>
                {setupStatus.unroutableCategories.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <p className="truncate">
                      Cannot resolve: {setupStatus.unroutableCategories.map((c) => c.name).join(', ')}
                    </p>
                    <button
                      onClick={() => navigate('/admin/departments')}
                      className="text-kesariya hover:underline font-semibold mt-1 inline-block"
                    >
                      Resolve Categories via Primary Depts →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4 Quick Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1 */}
          <div
            onClick={() => navigate('/admin/tickets?status=open')}
            className="card-nivaran p-5 hover:shadow-md transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Total Open
              </span>
              <span className="p-2 rounded bg-sovereign-indigo/10 text-sovereign-indigo text-lg">📂</span>
            </div>
            <p className="font-display text-3xl font-bold text-sovereign-indigo mt-3">{openTickets.length}</p>
            <p className="text-xs text-gray-400 mt-1">Requiring municipal action</p>
          </div>

          {/* Card 2 */}
          <div
            onClick={() => navigate('/admin/tickets?escalated=true')}
            className="card-nivaran p-5 hover:shadow-md transition cursor-pointer border-terracotta-alert/20"
            style={{ borderColor: '#B84A3940' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-terracotta-alert uppercase tracking-widest">
                Breaching / Near SLA
              </span>
              <span className="p-2 rounded bg-terracotta-alert/10 text-terracotta-alert text-lg">⏱️</span>
            </div>
            <p className="font-display text-3xl font-bold text-terracotta-alert mt-3">
              {breachingOrNearSla.length}
            </p>
            <p className="text-xs text-terracotta-alert/70 mt-1">Escalated or ≤ 6 hrs left</p>
          </div>

          {/* Card 3 */}
          <div
            onClick={() => navigate('/admin/tickets?status=resolved')}
            className="card-nivaran p-5 hover:shadow-md transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-jan-kalyan-green uppercase tracking-widest">
                Resolved This Week
              </span>
              <span className="p-2 rounded bg-jan-kalyan-green/10 text-jan-kalyan-green text-lg">✦</span>
            </div>
            <p className="font-display text-3xl font-bold text-jan-kalyan-green mt-3">
              {resolvedThisWeek.length}
            </p>
            <p className="text-xs text-gray-400 mt-1">Last 7 calendar days</p>
          </div>

          {/* Card 4 */}
          <div
            onClick={() => navigate('/admin/disputes')}
            className="card-nivaran p-5 hover:shadow-md transition cursor-pointer"
            style={{ borderColor: '#E6510030' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-kesariya uppercase tracking-widest">
                Active Disputes
              </span>
              <span className="p-2 rounded bg-kesariya/10 text-kesariya text-lg">⚠️</span>
            </div>
            <p className="font-display text-3xl font-bold text-kesariya mt-3">
              {activeDisputesCount}
            </p>
            <p className="text-xs text-gray-400 mt-1">Awaiting admin review</p>
          </div>
        </div>

        {/* Needs Attention Feed */}
        <div className="card-nivaran overflow-hidden">
          <div className="px-6 py-4 border-b border-earthen-slate flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <h2 className="font-display text-base font-bold text-sovereign-indigo">Needs Attention Feed</h2>
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
                    className="p-5 hover:bg-parchment transition flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono text-xs font-bold text-sovereign-indigo bg-parchment border border-earthen-slate px-2 py-0.5 rounded">
                          {ticket.ticketId}
                        </span>
                        <StatusBadge status={ticket.status} size="sm" />
                        {ticket.isEscalated && (
                          <span className="badge-escalated">
                            🚨 Escalated
                          </span>
                        )}
                        {ticket.status === 'disputed' && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-300 text-xs font-semibold px-2 py-0.5 rounded">
                            ⚠️ Disputed
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
