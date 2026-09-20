import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'
import StatusBadge from '../../components/StatusBadge'

function AdminTickets() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [reports, setReports] = useState([])
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters from URL or state
  const statusFilter = searchParams.get('status') || ''
  const deptFilter = searchParams.get('department') || ''
  const catFilter = searchParams.get('category') || ''
  const escalatedFilter = searchParams.get('escalated') === 'true'

  // Search query
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState('priorityScore') // 'priorityScore' | 'createdAt' | 'slaDeadline'
  const [sortOrder, setSortOrder] = useState('desc')

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [deptRes, catRes] = await Promise.all([
        api.get('/api/departments'),
        api.get('/api/categories'),
      ])
      setDepartments(deptRes.data.departments || [])
      setCategories(catRes.data.categories || [])
      await fetchReports()
    } catch (err) {
      console.error('Error fetching tickets table data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async () => {
    try {
      const params = {}
      if (statusFilter && statusFilter !== 'open') params.status = statusFilter
      if (deptFilter) params.department = deptFilter
      if (catFilter) params.category = catFilter
      if (escalatedFilter) params.escalated = 'true'

      const res = await api.get('/api/reports', { params })
      setReports(res.data.reports || [])
    } catch (err) {
      console.error('Error fetching reports:', err)
    }
  }

  // Refetch when filters change
  useEffect(() => {
    fetchReports()
  }, [statusFilter, deptFilter, catFilter, escalatedFilter])

  const handleFilterChange = (key, val) => {
    const nextParams = new URLSearchParams(searchParams)
    if (val) {
      nextParams.set(key, val)
    } else {
      nextParams.delete(key)
    }
    setSearchParams(nextParams)
  }

  // Filter and sort reports
  const now = new Date()

  const filteredAndSortedReports = reports
    .filter((r) => {
      // Special check for ?status=open (all non-resolved)
      if (statusFilter === 'open' && r.status === 'resolved') {
        return false
      }

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        r.ticketId?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.category?.name?.toLowerCase().includes(q) ||
        r.department?.name?.toLowerCase().includes(q) ||
        r.assignedTo?.name?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      let valA = a[sortField]
      let valB = b[sortField]

      if (sortField === 'slaDeadline') {
        valA = a.slaDeadline ? new Date(a.slaDeadline).getTime() : Infinity
        valB = b.slaDeadline ? new Date(b.slaDeadline).getTime() : Infinity
      } else if (sortField === 'createdAt') {
        valA = new Date(a.createdAt).getTime()
        valB = new Date(b.createdAt).getTime()
      } else {
        valA = a.priorityScore || 0
        valB = b.priorityScore || 0
      }

      if (sortOrder === 'asc') return valA > valB ? 1 : -1
      return valA < valB ? 1 : -1
    })

  // SLA status helper
  const getSlaStatus = (report) => {
    if (report.status === 'resolved') {
      return { label: 'Met (Resolved)', color: 'bg-green-100 text-green-700 border-green-300' }
    }
    if (report.isEscalated) {
      return { label: 'Escalated Breach', color: 'bg-red-100 text-red-700 border-red-300 font-bold animate-pulse' }
    }
    if (!report.slaDeadline) {
      return { label: 'No SLA', color: 'bg-gray-100 text-gray-500 border-gray-200' }
    }

    const diffHours = (new Date(report.slaDeadline) - now) / (1000 * 60 * 60)
    if (diffHours < 0) {
      return { label: 'Breached', color: 'bg-red-100 text-red-700 border-red-300 font-semibold' }
    }
    if (diffHours <= 6) {
      return {
        label: `Near Breach (${Math.round(diffHours)}h left)`,
        color: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
      }
    }
    return {
      label: `On Time (${Math.round(diffHours)}h left)`,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              All Tickets Master Table
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Comprehensive municipal registry with SLA tracker, priority sorting, and staff allocation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-lg">
              {filteredAndSortedReports.length} Records
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="lg:col-span-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket ID, description, category, staff..."
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-gray-50/50"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">All Statuses</option>
                <option value="open">Open Only</option>
                <option value="reported">Reported</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <select
                value={deptFilter}
                onChange={(e) => {
                  handleFilterChange('department', e.target.value)
                  handleFilterChange('category', '') // reset category
                }}
                className="w-full text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Escalated Toggle */}
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl bg-gray-50">
              <input
                type="checkbox"
                id="escalatedTable"
                checked={escalatedFilter}
                onChange={(e) => handleFilterChange('escalated', e.target.checked ? 'true' : '')}
                className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
              />
              <label htmlFor="escalatedTable" className="text-xs font-semibold text-red-700 cursor-pointer">
                Escalated Only 🚨
              </label>
            </div>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Ticket ID</th>
                  <th className="py-3.5 px-4">Category & Dept</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-gray-900"
                    onClick={() => {
                      if (sortField === 'priorityScore') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortField('priorityScore')
                        setSortOrder('desc')
                      }
                    }}
                  >
                    Priority {sortField === 'priorityScore' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3.5 px-4">Days Open</th>
                  <th className="py-3.5 px-4">Assigned Staff</th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-gray-900"
                    onClick={() => {
                      if (sortField === 'slaDeadline') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortField('slaDeadline')
                        setSortOrder('asc')
                      }
                    }}
                  >
                    SLA Status {sortField === 'slaDeadline' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-gray-400">
                      Loading tickets registry...
                    </td>
                  </tr>
                ) : filteredAndSortedReports.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-gray-400">
                      No tickets matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedReports.map((r) => {
                    const sla = getSlaStatus(r)
                    return (
                      <tr
                        key={r._id}
                        onClick={() => navigate(`/admin/tickets/${r._id}`)}
                        className="hover:bg-orange-50/40 cursor-pointer transition"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-900 whitespace-nowrap">
                          {r.ticketId}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-gray-900 leading-tight">
                            {r.category?.name || 'General'}
                          </p>
                          <p className="text-[11px] text-gray-500">{r.department?.name || 'Unassigned'}</p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={r.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-800">{r.priorityScore || 0}</span>
                            {r.isEscalated && (
                              <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded border border-red-200">
                                +50
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                          {r.daysOpen !== undefined ? `${r.daysOpen}d` : '0d'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {r.assignedTo ? (
                            <span className="font-medium text-gray-800">{r.assignedTo.name}</span>
                          ) : (
                            <span className="text-red-500 font-semibold text-xs">⚠️ Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block text-xs px-2 py-0.5 rounded border ${sla.color}`}
                          >
                            {sla.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="text-orange-600 font-semibold text-xs hover:underline">
                            View →
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminTickets
