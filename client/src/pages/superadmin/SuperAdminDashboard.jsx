import { useState, useEffect } from 'react'
import api from '../../utils/api'
import SuperAdminLayout from './SuperAdminLayout'

/**
 * /superadmin – Dashboard (summary cards + recent audit log)
 */
function SuperAdminDashboard() {
  const [stats, setStats] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [munisRes, logsRes] = await Promise.all([
          api.get('/api/superadmin/municipalities?limit=100'),
          api.get('/api/superadmin/audit-log?limit=5'),
        ])
        const munis = munisRes.data.data
        setStats({
          total: munisRes.data.pagination.total,
          active: munis.filter((m) => m.isActive).length,
          inactive: munis.filter((m) => !m.isActive).length,
          totalAdmins: munis.reduce((acc, m) => acc + (m.adminCount || 0), 0),
        })
        setRecentLogs(logsRes.data.data)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const ACTION_LABELS = {
    'municipality.create': 'City Created',
    'municipality.update': 'City Updated',
    'municipality.deactivate': 'City Deactivated',
    'municipality.activate': 'City Activated',
    'cityadmin.invite': 'Admin Invited',
    'cityadmin.revoke': 'Admin Revoked',
    'cityadmin.reset_password': 'Password Reset',
  }

  return (
    <SuperAdminLayout title="Super Admin Dashboard">
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="alert-error">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Cities', value: stats.total, icon: '🏙️', color: 'bg-blue-50 text-blue-700' },
              { label: 'Active Cities', value: stats.active, icon: '✅', color: 'bg-green-50 text-green-700' },
              { label: 'Inactive Cities', value: stats.inactive, icon: '⏸️', color: 'bg-gray-50 text-gray-600' },
              { label: 'City Admins', value: stats.totalAdmins, icon: '👤', color: 'bg-orange-50 text-orange-700' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className={`rounded-xl p-5 ${color} border border-current/10`}>
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-3xl font-bold font-display">{value}</div>
                <div className="text-sm font-medium mt-1 opacity-80">{label}</div>
              </div>
            ))}
          </div>

          {/* Recent Audit Log */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-display font-semibold text-sovereign-indigo">Recent Activity</h2>
              <a href="/superadmin/audit-log" className="text-sm text-kesariya hover:underline">View all →</a>
            </div>
            {recentLogs.length === 0 ? (
              <p className="text-gray-400 text-sm p-5">No audit log entries yet.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentLogs.map((log) => (
                  <div key={log._id} className="px-5 py-3 flex items-start gap-3">
                    <span className="text-lg mt-0.5">📝</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        {log.targetMunicipality?.name && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {log.targetMunicipality.name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        by {log.actorEmail} · {new Date(log.createdAt).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}

export default SuperAdminDashboard
