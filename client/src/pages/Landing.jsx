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
        <div className="space-x-4">
          <Link to="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition inline-block">
            Login
          </Link>
          <Link to="/register" className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition inline-block">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Landing
