import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api'

function PublicTransparency() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTransparency()
  }, [])

  const fetchTransparency = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/public/transparency')
      setData(res.data)
    } catch (err) {
      console.error('Failed to load transparency data:', err)
      setError('Failed to fetch public accountability metrics.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-[#0B2545] text-white border-b border-slate-700/60 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#E65100] flex items-center justify-center font-bold text-lg shadow">
              🏛️
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white block leading-none">
                Nivaran <span className="text-[#E65100] text-xs uppercase font-semibold px-1.5 py-0.5 rounded bg-orange-950/60 border border-orange-700/50">Transparency</span>
              </span>
              <span className="text-xs text-slate-300 leading-none">Open Municipal Performance Portal</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-200 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-xs font-bold bg-[#E65100] hover:bg-orange-700 text-white px-3.5 py-1.5 rounded-lg shadow transition"
            >
              Report Issue
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Editorial Header */}
        <div className="max-w-3xl space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#E65100] bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-md inline-block">
            Public Civic Accountability
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Municipal Department Performance
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            In accordance with open governance principles, Nivaran publishes real-time aggregate statistics on civic grievance resolution. Citizens can review department responsiveness, closure rates, and average turnaround times without compromising individual privacy.
          </p>
          <p className="text-xs text-slate-400">
            * All data is anonymized and aggregated directly from live municipal field workflows.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Aggregate KPI Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Grievances Registered
            </span>
            <p className="text-4xl font-extrabold text-[#0B2545] mt-2">
              {data?.summary?.totalReported ?? 0}
            </p>
            <p className="text-xs text-slate-400 mt-1">Total citizen submissions across all wards</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
              Issues Resolved
            </span>
            <p className="text-4xl font-extrabold text-green-700 mt-2">
              {data?.summary?.totalResolved ?? 0}
            </p>
            <p className="text-xs text-slate-400 mt-1">Verified resolutions with before/after documentation</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <span className="text-xs font-semibold text-[#E65100] uppercase tracking-wider">
              Overall Resolution Rate
            </span>
            <p className="text-4xl font-extrabold text-[#E65100] mt-2">
              {data?.summary?.overallResolutionRate ?? 0}%
            </p>
            <p className="text-xs text-slate-400 mt-1">Municipal-wide resolution efficiency</p>
          </div>
        </div>

        {/* Department Breakdown Cards */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold text-slate-900">Departmental Scorecard</h2>
            <span className="text-xs text-slate-500">
              Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString() : 'Live'}
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Loading public accountability scorecard...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.departments?.map((dept) => (
                <div
                  key={dept.department}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-lg leading-tight">
                        {dept.department}
                      </h3>
                      <span className="bg-green-50 text-green-700 border border-green-200 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                        {dept.resolutionRate}% Resolved
                      </span>
                    </div>
                    {dept.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{dept.description}</p>
                    )}
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Progress</span>
                        <span>{dept.totalResolved} of {dept.totalReported} closed</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(dept.resolutionRate, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center pt-1">
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <p className="text-base font-bold text-slate-800">{dept.openIssues}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Active Open</p>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl">
                        <p className="text-base font-bold text-slate-800">
                          {dept.avgResolutionHours > 0 ? `${dept.avgResolutionHours}h` : '—'}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">Avg Turnaround</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accountability & Privacy Disclaimer */}
        <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-6 text-xs text-slate-600 space-y-2">
          <h4 className="font-bold text-slate-800 text-sm">Public Transparency Commitment</h4>
          <p>
            Nivaran is built upon the open civic model popularized by 311 municipal services worldwide. This transparency portal exposes non-sensitive municipal operational performance to encourage prompt service delivery and foster community participation. No personal identifying information (PII) or individual grievance records are disclosed.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} Nivaran Civic Governance System. Open public accountability.</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-white transition">Home</Link>
            <Link to="/transparency" className="text-orange-400 font-semibold hover:text-orange-300 transition">Transparency</Link>
            <Link to="/login" className="hover:text-white transition">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default PublicTransparency
