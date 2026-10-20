import { useState, useEffect, useCallback } from 'react'
import api from '../../utils/api'
import SuperAdminLayout from './SuperAdminLayout'

const STATUS_OPTIONS = ['all', 'open', 'planned', 'added', 'dismissed']

const STATUS_BADGE = {
  open: 'bg-blue-100 text-blue-800',
  planned: 'bg-purple-100 text-purple-800',
  added: 'bg-emerald-100 text-emerald-800',
  dismissed: 'bg-gray-100 text-gray-600',
}

function SuperAdminCityRequests() {
  const [requests, setRequests] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [stateFilter, setStateFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page, limit: 15 })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (stateFilter) params.set('state', stateFilter)
      if (search) params.set('search', search)

      const res = await api.get(`/api/superadmin/city-requests?${params}`)
      setRequests(res.data.data)
      setPagination(res.data.pagination)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load city requests')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, stateFilter, search])

  useEffect(() => {
    fetchRequests(1)
  }, [fetchRequests])

  const handleStatusChange = async (requestId, newStatus) => {
    setActionLoading(requestId)
    setSuccessMsg('')
    try {
      await api.patch(`/api/superadmin/city-requests/${requestId}`, { status: newStatus })
      setSuccessMsg(`Status updated to ${newStatus}`)
      fetchRequests(pagination.page)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update request status')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <SuperAdminLayout title="City Requests (Waitlist)">
      <div className="space-y-6">
        {/* Header summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm text-gray-500">
              Demand tracking for cities where citizens requested Nivaran.
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Unique requests are deduplicated by SHA-256 hashed emails. Plain emails are never stored.
            </p>
          </div>
          <span className="text-xs font-semibold bg-sovereign-indigo/10 text-sovereign-indigo px-3 py-1.5 rounded-full w-fit">
            {pagination.total} Total Requests Recorded
          </span>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search city name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-nivaran text-xs max-w-xs"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-nivaran text-xs w-auto"
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                Status: {st.charAt(0).toUpperCase() + st.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="input-nivaran text-xs w-auto"
          >
            <option value="">All States</option>
            <option value="Punjab">Punjab</option>
            <option value="Other">Other</option>
          </select>

          {(search || statusFilter !== 'all' || stateFilter) && (
            <button
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setStateFilter('')
              }}
              className="text-xs text-kesariya hover:underline font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>

        {error && <div className="alert-error">{error}</div>}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded">
            {successMsg}
          </div>
        )}

        {/* Requests Table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            Loading city requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No city requests found matching the current filters.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['City', 'State', 'Request Count', 'Status', 'First Requested', 'Last Requested', 'Change Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-sovereign-indigo">
                      {r.displayName || r.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.state}</td>
                    <td className="px-4 py-3 font-semibold text-center text-sovereign-indigo">
                      <span className="bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-full font-bold text-xs">
                        {r.requestCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(r.firstRequestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(r.lastRequestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status}
                        disabled={actionLoading === r._id}
                        onChange={(e) => handleStatusChange(r._id, e.target.value)}
                        className="input-nivaran text-xs py-1 px-2 w-auto"
                      >
                        <option value="open">Open</option>
                        <option value="planned">Planned</option>
                        <option value="added">Added</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} requests)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchRequests(pagination.page - 1)}
                    className="px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchRequests(pagination.page + 1)}
                    className="px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}

export default SuperAdminCityRequests
