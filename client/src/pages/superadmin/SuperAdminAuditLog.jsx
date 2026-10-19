import { useState, useEffect, useCallback } from 'react'
import api from '../../utils/api'
import SuperAdminLayout from './SuperAdminLayout'

const ACTION_LABELS = {
  'municipality.create': { label: 'City Created', color: 'bg-green-100 text-green-700' },
  'municipality.update': { label: 'City Updated', color: 'bg-blue-100 text-blue-700' },
  'municipality.deactivate': { label: 'City Deactivated', color: 'bg-red-100 text-red-700' },
  'municipality.activate': { label: 'City Activated', color: 'bg-green-100 text-green-700' },
  'cityadmin.invite': { label: 'Admin Invited', color: 'bg-orange-100 text-orange-700' },
  'cityadmin.revoke': { label: 'Admin Revoked', color: 'bg-red-100 text-red-600' },
  'cityadmin.reset_password': { label: 'Password Reset', color: 'bg-yellow-100 text-yellow-700' },
}

/**
 * /superadmin/audit-log – paginated, filterable audit log table
 */
function SuperAdminAuditLog() {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page, limit: 30 })
      if (actionFilter) params.set('action', actionFilter)
      const res = await api.get(`/api/superadmin/audit-log?${params}`)
      setLogs(res.data.data)
      setPagination(res.data.pagination)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => { fetchLogs(1) }, [fetchLogs])

  return (
    <SuperAdminLayout title="Audit Log">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          id="audit-action-filter"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input-nivaran w-auto"
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <span className="text-gray-400 text-sm ml-auto">
          {pagination.total} total entries
        </span>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No audit log entries found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Timestamp', 'Action', 'City', 'Target User', 'Performed By', 'IP'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => {
                const meta = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={log._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {log.targetMunicipality
                        ? `${log.targetMunicipality.name}, ${log.targetMunicipality.state}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {log.targetUser
                        ? <span>{log.targetUser.name}<br /><span className="text-gray-400">{log.targetUser.email}</span></span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{log.actorEmail}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{log.ip || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchLogs(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => fetchLogs(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SuperAdminLayout>
  )
}

export default SuperAdminAuditLog
