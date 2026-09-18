import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'

// Fix Leaflet default icon issue with Vite
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  shadowUrl: iconShadow,
})

function ReportDetail() {
  const { id } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    fetchReport()
  }, [id])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/reports/${id}`)
      setReport(response.data.report)
    } catch (err) {
      setError('Failed to fetch report details')
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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error || 'Report not found'}
          </div>
          <button
            onClick={() => navigate('/citizen/reports')}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Back to My Reports
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/citizen/reports')}
          className="mb-6 text-blue-600 hover:underline"
        >
          ← Back to My Reports
        </button>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{report.ticketId}</h1>
              <p className="text-gray-600">{report.category?.name}</p>
              <p className="text-sm text-gray-500">{report.department?.name}</p>
            </div>
            <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(report.status)}`}>
              {report.status.replace('_', ' ')}
            </span>
          </div>

          {report.photoUrl && (
            <div className="mb-6">
              <img src={report.photoUrl} alt="Report" className="w-full max-w-md rounded" />
            </div>
          )}

          <div className="mb-6">
            <h2 className="font-semibold text-gray-800 mb-2">Description</h2>
            <p className="text-gray-600">{report.description}</p>
          </div>

          <div className="mb-6">
            <h2 className="font-semibold text-gray-800 mb-2">Location</h2>
            <div className="h-64 rounded-lg overflow-hidden border border-gray-300">
              <MapContainer
                center={[report.location.lat, report.location.lng]}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <Marker position={[report.location.lat, report.location.lng]} />
              </MapContainer>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {report.location.lat.toFixed(6)}, {report.location.lng.toFixed(6)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Submitted</p>
              <p className="text-gray-800">
                {new Date(report.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Report Count</p>
              <p className="text-gray-800">{report.reportCount}</p>
            </div>
            <div>
              <p className="text-gray-500">Anonymous</p>
              <p className="text-gray-800">{report.isAnonymous ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-gray-500">Priority Score</p>
              <p className="text-gray-800">{report.priorityScore}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportDetail
