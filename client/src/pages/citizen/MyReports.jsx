import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import { useSocket } from '../../context/SocketContext'
import CitizenNavbar from '../../components/CitizenNavbar'
import StatusBadge from '../../components/StatusBadge'
import { getDeptColor } from '../../utils/deptColors'

function MyReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { socket } = useSocket()
  const navigate = useNavigate()

  useEffect(() => { fetchMyReports() }, [])

  // Live status updates via Socket.io
  useEffect(() => {
    if (!socket) return
    const handleStatusUpdate = (data) => {
      setReports((prev) =>
        prev.map((r) =>
          r._id === data.reportId
            ? { ...r, status: data.status, resolutionNote: data.resolutionNote || r.resolutionNote }
            : r
        )
      )
    }
    socket.on('status_update', handleStatusUpdate)
    return () => { socket.off('status_update', handleStatusUpdate) }
  }, [socket])

  const fetchMyReports = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/reports/mine')
      setReports(response.data.reports)
    } catch {
      setError('Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  const handleUpvote = async (e, reportId) => {
    e.stopPropagation()
    try {
      await api.post(`/api/reports/${reportId}/upvote`)
      fetchMyReports()
    } catch { /* ignore */ }
  }

  const getPriorityLevel = (score) => {
    if (score >= 50) return { label: 'High', dot: 'bg-terracotta-alert' }
    if (score >= 25) return { label: 'Med', dot: 'bg-amber-400' }
    return { label: 'Low', dot: 'bg-jan-kalyan-green' }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <CitizenNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-sovereign-indigo border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading your reports…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <CitizenNavbar />

      <main className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="section-header mb-0">
            <h1 className="font-display text-2xl font-bold text-sovereign-indigo">My Reports</h1>
          </div>
          <button
            onClick={() => navigate('/citizen/report')}
            className="btn-kesariya text-sm"
          >
            + New Report
          </button>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {reports.length === 0 ? (
          <div className="card-nivaran p-10 text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="font-display font-bold text-sovereign-indigo text-lg mb-2">No reports yet</p>
            <p className="text-gray-500 text-sm mb-5">Start by filing your first civic complaint</p>
            <button onClick={() => navigate('/citizen/report')} className="btn-primary">
              Report an Issue
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400">{reports.length} report{reports.length !== 1 ? 's' : ''} filed</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map((report) => {
                const dept = report.category?.department
                const deptColor = getDeptColor(dept?.name || report.department?.name)
                const priority = getPriorityLevel(report.priorityScore || 0)
                return (
                  <button
                    key={report._id}
                    onClick={() => navigate(`/citizen/reports/${report._id}`)}
                    className="card-nivaran p-5 text-left hover:shadow-md hover:border-earthen-slate-dark transition-all active:scale-[0.99] group"
                    style={{ borderLeftColor: deptColor.dot, borderLeftWidth: '3px' }}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-bold text-gray-500 truncate">{report.ticketId}</p>
                        <p className="font-semibold text-sovereign-indigo text-sm mt-0.5 truncate">
                          {report.category?.name || 'Issue'}
                        </p>
                        {(dept?.name || report.department?.name) && (
                          <p
                            className="text-xs font-medium mt-0.5"
                            style={{ color: deptColor.text }}
                          >
                            {dept?.name || report.department?.name}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={report.status} size="sm" />
                    </div>

                    {/* Photo */}
                    {report.photoUrl && (
                      <img
                        src={report.photoUrl}
                        alt="Report"
                        className="w-full h-28 object-cover rounded mb-3 border border-earthen-slate"
                      />
                    )}

                    {/* Description */}
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
                      {report.description}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-earthen-slate">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
                        <span className="text-[10px] text-gray-400">{priority.label} priority</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => handleUpvote(e, report._id)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-kesariya transition"
                          title="Upvote"
                        >
                          👍 {report.upvotes?.length || 0}
                        </button>
                        <span className="text-[10px] text-gray-400">
                          {new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default MyReports
