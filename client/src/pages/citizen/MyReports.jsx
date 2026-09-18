import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'

function MyReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    fetchMyReports()
  }, [])

  const fetchMyReports = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/reports/mine')
      setReports(response.data.reports)
    } catch (err) {
      setError('Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'reported':
        return 'bg-yellow-100 text-yellow-800'
      case 'acknowledged':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-purple-100 text-purple-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (score) => {
    if (score >= 50) return 'bg-red-500'
    if (score >= 25) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const handleUpvote = async (e, reportId) => {
    e.stopPropagation()
    try {
      await api.post(`/api/reports/${reportId}/upvote`)
      fetchMyReports()
    } catch (err) {
      console.error('Failed to upvote:', err)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">My Reports</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">You haven't submitted any reports yet.</p>
            <button
              onClick={() => navigate('/citizen/report')}
              className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Report an Issue
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <div
                key={report._id}
                onClick={() => navigate(`/citizen/reports/${report._id}`)}
                className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition relative"
              >
                <div className="absolute top-2 right-2">
                  <div
                    className={`w-3 h-3 rounded-full ${getPriorityColor(report.priorityScore || 0)}`}
                    title={`Priority Score: ${report.priorityScore || 0}`}
                  />
                </div>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-800">{report.ticketId}</h3>
                    <p className="text-sm text-gray-600">{report.category?.name}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(report.status)}`}>
                    {report.status.replace('_', ' ')}
                  </span>
                </div>
                
                {report.photoUrl && (
                  <img
                    src={report.photoUrl}
                    alt="Report"
                    className="w-full h-32 object-cover rounded mb-4"
                  />
                )}
                
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                  {report.description}
                </p>
                
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-500">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                  <button
                    onClick={(e) => handleUpvote(e, report._id)}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition"
                  >
                    <span>👍</span>
                    <span>{report.upvotes?.length || 0}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MyReports
