import { Link } from 'react-router-dom'

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">Nivaran</h1>
        <p className="text-xl text-gray-600 mb-8">Report it. Track it. Nivaran — Resolved.</p>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          A civic issue reporting and resolution platform where citizens can report local issues,
          track their status, and help make their communities better.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/login" className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition font-semibold shadow">
            Login
          </Link>
          <Link to="/register" className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition font-semibold shadow">
            Sign Up
          </Link>
          <Link to="/transparency" className="bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 px-6 py-3 rounded-xl transition font-semibold shadow-sm flex items-center gap-1.5">
            📊 Public Transparency
          </Link>
        </div>

        <div className="mt-12 pt-6 border-t border-indigo-100 text-xs text-gray-500">
          <span>Open Governance: </span>
          <Link to="/transparency" className="text-orange-600 font-semibold hover:underline">
            View Live Municipal Performance Scorecards →
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Landing
