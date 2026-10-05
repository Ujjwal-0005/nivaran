import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../context/SocketContext'
import api from '../../utils/api'
import StatusBadge from '../../components/StatusBadge'
import StaffNavbar from '../../components/StaffNavbar'
import { getDeptColor, getDeptBorderStyle } from '../../utils/deptColors'

function PriorityIndicator({ score }) {
  const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'
  const config = {
    high:   { dot: 'bg-terracotta-alert',  label: 'High',   text: 'text-terracotta-alert' },
    medium: { dot: 'bg-amber-400',          label: 'Med',    text: 'text-amber-600' },
    low:    { dot: 'bg-jan-kalyan-green',   label: 'Low',    text: 'text-jan-kalyan-green' },
  }[level]
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${config.dot}`} />
      <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
      <span className="text-xs text-gray-400">({score})</span>
    </div>
  )
}

function TabPill({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold transition ${
        active
          ? 'bg-sovereign-indigo text-white'
          : 'bg-white text-gray-600 border border-earthen-slate hover:bg-parchment'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white text-sovereign-indigo' : 'bg-gray-100 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

const STATUS_TABS = [
  { key: 'all',         label: 'All',         statuses: null },
  { key: 'new',         label: 'New',         statuses: ['reported', 'acknowledged'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress'] },
  { key: 'resolved',    label: 'Resolved',    statuses: ['resolved'] },
]

function StaffDashboard() {
  const { socket } = useSocket()
  const navigate = useNavigate()

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => { fetchAssigned() }, [])

  useEffect(() => {
    if (!socket) return
    const handleNew = () => fetchAssigned()
    socket.on('new_assignment', handleNew)
    return () => { socket.off('new_assignment', handleNew) }
  }, [socket])

  const fetchAssigned = async () => {
    try {
      setLoading(true); setError('')
      const res = await api.get('/api/reports/department')
      setReports(res.data.reports)
    } catch { setError('Failed to load department tickets') }
    finally { setLoading(false) }
  }

  const currentTab = STATUS_TABS.find(t => t.key === activeTab)
  const filtered = currentTab?.statuses
    ? reports.filter(r => currentTab.statuses.includes(r.status))
    : reports

  const countFor = (tab) =>
    tab.statuses ? reports.filter(r => tab.statuses.includes(r.status)).length : reports.length

  const formatAge = (createdAt) => {
    const days = Math.floor((Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return '1d ago'
    return `${days}d ago`
  }

  if (loading) {
    return (
      <div className="page-shell">
        <StaffNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-sovereign-indigo border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading tickets…</p>
          </div>
        </div>
      </div>
    )
  }

  const openCount    = reports.filter(r => ['reported','acknowledged','in_progress'].includes(r.status)).length
  const progressCount = reports.filter(r => r.status === 'in_progress').length
  const resolvedCount = reports.filter(r => r.status === 'resolved').length

  return (
    <div className="page-shell">
      <StaffNavbar />

      <main className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {error && <div className="alert-error text-sm">{error}</div>}

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Open', count: openCount, color: 'text-amber-600' },
            { label: 'In Progress', count: progressCount, color: 'text-violet-600' },
            { label: 'Resolved', count: resolvedCount, color: 'text-jan-kalyan-green' },
          ].map(s => (
            <div key={s.label} className="card-nivaran p-3 text-center">
              <p className={`font-display text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <TabPill
              key={tab.key}
              label={tab.label}
              count={countFor(tab)}
              active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>

        {/* Ticket list */}
        {filtered.length === 0 ? (
          <div className="card-nivaran p-8 text-center">
            <p className="text-gray-400 text-sm">No tickets in this category</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(report => {
              const deptColor = getDeptColor(report.department?.name)
              return (
                <button
                  key={report._id}
                  onClick={() => navigate(`/staff/tickets/${report._id}`)}
                  className="w-full card-nivaran p-4 text-left hover:shadow-md hover:border-earthen-slate-dark transition-all active:scale-[0.99]"
                  style={getDeptBorderStyle(report.department?.name)}
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-gray-400">{report.ticketId}</p>
                      <p className="font-semibold text-sovereign-indigo text-sm mt-0.5 truncate">
                        {report.category?.name || 'Issue'}
                      </p>
                      {report.department?.name && (
                        <p className="text-[10px] font-medium mt-0.5" style={{ color: deptColor.text }}>
                          {report.department.name}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={report.status} size="sm" />
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{report.description}</p>

                  <div className="flex items-center justify-between">
                    <PriorityIndicator score={report.priorityScore || 0} />
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span>👥 {report.reportCount}</span>
                      <span>{formatAge(report.createdAt)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default StaffDashboard
