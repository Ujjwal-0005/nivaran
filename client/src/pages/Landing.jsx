function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">Nivaran</h1>
        <p className="text-xl text-gray-600 mb-8">Report it. Track it. Nivaran — Resolved.</p>
        <div className="space-x-4">
          <a href="/citizen" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
            Citizen Portal
          </a>
          <a href="/staff" className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition">
            Staff Portal
          </a>
          <a href="/admin" className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition">
            Admin Portal
          </a>
        </div>
      </div>
    </div>
  )
}

export default Landing
