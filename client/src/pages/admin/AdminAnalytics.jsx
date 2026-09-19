import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'

function AdminAnalytics() {
  const [overview, setOverview] = useState(null)
  const [categoryData, setCategoryData] = useState([])
  const [departmentData, setDepartmentData] = useState([])
  const [trendData, setTrendData] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const [ovRes, catRes, deptRes, trRes, lbRes, znRes] = await Promise.all([
        api.get('/api/analytics/overview'),
        api.get('/api/analytics/by-category'),
        api.get('/api/analytics/by-department'),
        api.get('/api/analytics/trends'),
        api.get('/api/analytics/staff-leaderboard'),
        api.get('/api/analytics/zones'),
      ])

      setOverview(ovRes.data)
      setCategoryData(catRes.data.categories || [])
      setDepartmentData(deptRes.data.departments || [])
      setTrendData(trRes.data.trends || [])
      setLeaderboard(lbRes.data.leaderboard || [])
      setZones(znRes.data.zones || [])
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      setError('Failed to load municipal analytics data.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Municipal Operational Analytics
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Data intelligence, resolution velocity, department comparisons, trends, and hotspot zones.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}

        {/* 1. Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Reports</span>
            <p className="text-3xl font-extrabold text-gray-900 mt-2">{overview?.totalReports || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Lifetime civic grievances</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Open Tickets</span>
            <p className="text-3xl font-extrabold text-blue-700 mt-2">{overview?.openReports || 0}</p>
            <p className="text-xs text-blue-500/80 mt-1">Active in field pipeline</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-green-100 shadow-sm">
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Resolved Tickets</span>
            <p className="text-3xl font-extrabold text-green-700 mt-2">{overview?.resolvedReports || 0}</p>
            <p className="text-xs text-green-600/80 mt-1">
              {overview?.totalReports > 0
                ? `${((overview.resolvedReports / overview.totalReports) * 100).toFixed(1)}% closure rate`
                : '0% closure rate'}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-orange-100 shadow-sm">
            <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Avg Resolution Time</span>
            <p className="text-3xl font-extrabold text-orange-600 mt-2">
              {overview?.avgResolutionHours !== undefined ? `${overview.avgResolutionHours}h` : '0h'}
            </p>
            <p className="text-xs text-orange-500/80 mt-1">From report submission to resolution</p>
          </div>
        </div>

        {/* 2. Charts Row: Trends & Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 30-Day Line Chart Trends */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">30-Day Activity Trends</h3>
              <p className="text-xs text-gray-400">Reports submitted vs. resolved per day</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => val.slice(5)}
                    stroke="#94a3b8"
                    fontSize={11}
                  />
                  <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="created"
                    name="Reports Created"
                    stroke="#ea580c"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    name="Reports Resolved"
                    stroke="#16a34a"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Grievances by Category</h3>
              <p className="text-xs text-gray-400">Distribution of municipal issue types</p>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData.slice(0, 8)} margin={{ bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    fontSize={10}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                  />
                  <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="total" name="Total Tickets" fill="#0B2545" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#22c55e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 3. Department Comparison Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-5 space-y-4">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Department Performance Comparison</h3>
            <p className="text-xs text-gray-400">
              Departmental efficiency, resolution rate, resolution latency, and citizen feedback ratings.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4 text-center">Total Reports</th>
                  <th className="py-3 px-4 text-center">Resolved</th>
                  <th className="py-3 px-4 text-center">Open</th>
                  <th className="py-3 px-4 text-center">Resolution Rate</th>
                  <th className="py-3 px-4 text-center">Avg Resolution Time</th>
                  <th className="py-3 px-4 text-center">Avg Citizen Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {departmentData.map((d) => (
                  <tr key={d.departmentId} className="hover:bg-gray-50/70 transition">
                    <td className="py-3 px-4 font-bold text-gray-900">{d.name}</td>
                    <td className="py-3 px-4 text-center font-semibold text-gray-800">{d.total}</td>
                    <td className="py-3 px-4 text-center text-green-700 font-bold">{d.resolved}</td>
                    <td className="py-3 px-4 text-center text-blue-700 font-bold">{d.open}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block bg-green-50 text-green-700 border border-green-200 font-bold px-2 py-0.5 rounded text-xs">
                        {d.resolutionRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-gray-700">
                      {d.avgResolutionHours > 0 ? `${d.avgResolutionHours} hrs` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {d.avgRating ? (
                        <span className="text-amber-600 font-bold">⭐ {d.avgRating} / 5</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Unrated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Bottom Row: Staff Leaderboard & Hotspot Zones */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staff Leaderboard */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Top Resolving Staff Leaderboard</h3>
              <p className="text-xs text-gray-400">Ranked by verified resolved tickets and citizen satisfaction</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Staff Member</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-center">Resolved</th>
                    <th className="py-2.5 px-3 text-center">Active Open</th>
                    <th className="py-2.5 px-3 text-center">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaderboard.slice(0, 7).map((s, idx) => (
                    <tr key={s.staffId} className="hover:bg-gray-50 transition">
                      <td className="py-2.5 px-3 font-bold text-gray-900 flex items-center gap-1.5">
                        <span className="w-4 text-gray-400 font-normal">{idx + 1}.</span>
                        <span>{s.name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{s.department}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-green-700">{s.totalResolved}</td>
                      <td className="py-2.5 px-3 text-center text-blue-700 font-medium">{s.openAssigned}</td>
                      <td className="py-2.5 px-3 text-center">
                        {s.avgRating ? `⭐ ${s.avgRating}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Hotspot Zones (Approximate Geospatial Sectors) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Hotspot Zones (Sector Density)</h3>
              <p className="text-xs text-gray-400">
                Approximated ~1.1km² spatial clusters of currently open civic issues
              </p>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Sector Cluster</th>
                    <th className="py-2.5 px-3 text-center">Open Issues</th>
                    <th className="py-2.5 px-3">Leading Departments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {zones.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-6 text-center text-gray-400">
                        No open reports mapped to sectors.
                      </td>
                    </tr>
                  ) : (
                    zones.map((z) => (
                      <tr key={z.zone} className="hover:bg-gray-50 transition">
                        <td className="py-2.5 px-3 font-semibold text-gray-800">{z.zone}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-red-600">
                          <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                            {z.openCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 text-[11px] truncate">
                          {Object.entries(z.departments || {})
                            .map(([k, v]) => `${k} (${v})`)
                            .join(', ')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminAnalytics
