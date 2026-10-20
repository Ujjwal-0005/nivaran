import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../../utils/api'
import SuperAdminLayout from './SuperAdminLayout'

/**
 * /superadmin – Dashboard
 * Platform summary cards, per-city metrics table, Recharts bar chart, recent audit log
 */
function SuperAdminDashboard() {
  const [overview, setOverview] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [overviewRes, logsRes] = await Promise.all([
          api.get('/api/superadmin/overview'),
          api.get('/api/superadmin/audit-log?limit=5'),
        ])
        setOverview(overviewRes.data)
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
    'admin.update': 'Admin Updated',
    'admin.make_primary': 'Primary Admin Changed',
    'admin.reactivate': 'Admin Reactivated',
    'admin.deactivate': 'Admin Deactivated',
  }

  const totals = overview?.totals || {}
  const perCity = overview?.perCity || []

  const chartData = perCity.map((c) => ({
    name: c.name,
    reports: c.reportsTotal,
    resolved: c.reportsByStatus?.resolved || 0,
  }))

  return (
    <SuperAdminLayout title="Super Admin Dashboard">
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
      ) : error ? (
        <div className="alert-error">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Cities', value: totals.totalCities, icon: '🏙️', color: 'bg-blue-50 text-blue-700' },
              { label: 'Active Cities', value: totals.activeCities, icon: '✅', color: 'bg-green-50 text-green-700' },
              { label: 'City Admins', value: totals.totalAdmins, icon: '👤', color: 'bg-orange-50 text-orange-700' },
              { label: 'Total Reports', value: totals.totalReports, icon: '📊', color: 'bg-purple-50 text-purple-700' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className={`rounded-xl p-5 ${color} border border-current/10`}>
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-3xl font-bold font-display">{value ?? 0}</div>
                <div className="text-sm font-medium mt-1 opacity-80">{label}</div>
              </div>
            ))}
          </div>

          {/* Reports Bar Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-display font-semibold text-sovereign-indigo mb-4">Reports Per City</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0B2545', color: '#fff', borderRadius: '8px', border: 'none' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="reports" fill="#0B2545" name="Total Reports" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resolved" fill="#137547" name="Resolved" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-City Table with Status Chips & Onboarding Progress */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-display font-semibold text-sovereign-indigo">Municipalities Overview</h2>
              <Link to="/superadmin/municipalities" className="text-sm text-kesariya hover:underline">Manage Cities →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 font-medium">
                  <tr>
                    <th className="px-5 py-3">City</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Admins</th>
                    <th className="px-5 py-3">Staff</th>
                    <th className="px-5 py-3">Citizens</th>
                    <th className="px-5 py-3">Reports</th>
                    <th className="px-5 py-3">Onboarding</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {perCity.map((c) => {
                    const onboardingSteps = [
                      c.admins > 0,
                      true, // default depts seeded
                      c.staff > 0,
                      c.reportsTotal > 0,
                    ]
                    const completedSteps = onboardingSteps.filter(Boolean).length
                    const pct = Math.round((completedSteps / 4) * 100)

                    return (
                      <tr key={c.id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3.5 font-medium text-gray-900">
                          {c.name} <span className="text-gray-400 text-xs">({c.state})</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {c.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-700">{c.admins}</td>
                        <td className="px-5 py-3.5 text-gray-700">{c.staff}</td>
                        <td className="px-5 py-3.5 text-gray-700">{c.citizens}</td>
                        <td className="px-5 py-3.5 font-medium text-gray-800">
                          {c.reportsTotal}
                          <span className="text-xs text-gray-400 ml-1 font-normal">
                            ({c.reportsByStatus?.resolved || 0} resolved)
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div className="bg-kesariya h-full" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-xs text-gray-500 font-medium">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            to={`/superadmin/municipalities/${c.id}`}
                            className="text-xs font-semibold text-kesariya hover:underline"
                          >
                            Details →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Audit Log */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-display font-semibold text-sovereign-indigo">Recent Activity</h2>
              <Link to="/superadmin/audit-log" className="text-sm text-kesariya hover:underline">View all →</Link>
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
