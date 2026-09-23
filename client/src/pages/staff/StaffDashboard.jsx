import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import api from '../../utils/api'
import StatusBadge from '../../components/StatusBadge'
import NotificationBell from '../../components/NotificationBell'

// Priority dot with colour and score label
function PriorityIndicator({ score }) {
  const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'
  const config = {
    high:   { dot: 'bg-red-500',    label: 'High',   text: 'text-red-600' },
    medium: { dot: 'bg-yellow-500', label: 'Med',    text: 'text-yellow-600' },
    low:    { dot: 'bg-green-500',  label: 'Low',    text: 'text-green-600' },
  }[level]

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${config.dot}`} />
      <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
      <span className="text-xs text-gray-400">({score})</span>
    </div>
  )
}

// Tab pill
function Tab({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
        active
          ? 'bg-gray-800 text-white'
          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          active ? 'bg-white text-gray-800' : 'bg-gray-100 text-gray-600'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

// Status tab definitions for staff
const STATUS_TABS = [
  { key: 'all',         label: 'All',         statuses: null },
  { key: 'new',         label: 'New',         statuses: ['reported', 'acknowledged'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress'] },
  { key: 'resolved',    label: 'Resolved',    statuses: ['resolved'] },
]

function StaffDashboard() {
  const { user, logout } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    fetchAssigned()
  }, [])

  // Phase 8: Listen for live new assignment events to update staff dashboard
  useEffect(() => {
    if (!socket) return

    const handleNewAssignment = () => {
      fetchAssigned()
    }

    socket.on('new_assignment', handleNewAssignment)
    return () => {
      socket.off('new_assignment', handleNewAssignment)
    }
  }, [socket])

  const fetchAssigned = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await api.get('/api/reports/department')
      setReports(res.data.reports)
    } catch (err) {
      setError('Failed to load department tickets')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  // Filter by active tab
  const currentTab = STATUS_TABS.find(t => t.key === activeTab)
  const filtered = currentTab?.statuses
    ? reports.filter(r => currentTab.statuses.includes(r.status))
    : reports

  // Counts per tab
  const countFor = (tab) =>
    tab.statuses
      ? reports.filter(r => tab.statuses.includes(r.status)).length
      : reports.length

  const formatAge = (createdAt) => {
    const days = Math.floor((Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Nivaran Staff</p>
          <h1 className="text-lg font-semibold leading-tight">{user?.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-white transition border border-gray-700 px-3 py-1.5 rounded"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Open', count: reports.filter(r => ['reported','acknowledged','in_progress'].includes(r.status)).length, color: 'text-yellow-600' },
            { label: 'In Progress', count: reports.filter(r => r.status === 'in_progress').length, color: 'text-purple-600' },
            { label: 'Resolved', count: reports.filter(r => r.status === 'resolved').length, color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap mb-4">
          {STATUS_TABS.map(tab => (
            <Tab
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
          <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
            <p className="text-gray-400 text-sm">No tickets in this category</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(report => (
              <button
                key={report._id}
                onClick={() => navigate(`/staff/tickets/${report._id}`)}
                className="w-full bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-left hover:shadow-md hover:border-gray-300 transition active:scale-[0.99]"
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{report.ticketId}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{report.category?.name}</p>
                  </div>
                  <StatusBadge status={report.status} size="sm" />
                </div>

                {/* Description snippet */}
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{report.description}</p>

                {/* Bottom meta row */}
                <div className="flex items-center justify-between">
                  <PriorityIndicator score={report.priorityScore || 0} />
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>👥 {report.reportCount}</span>
                    <span>{formatAge(report.createdAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default StaffDashboard
