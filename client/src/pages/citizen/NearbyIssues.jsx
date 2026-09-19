import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'
import StatusBadge from '../../components/StatusBadge'

// Fix Leaflet default icon issue with Vite
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  shadowUrl: iconShadow,
})

// Priority-coded marker icons (red, yellow, green)
function makePriorityIcon(color) {
  return L.divIcon({
    html: `<div style="
      width: 18px; height: 18px; border-radius: 50%;
      background: ${color}; border: 2.5px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  })
}

const HIGH_ICON   = makePriorityIcon('#ef4444')  // red
const MED_ICON    = makePriorityIcon('#f59e0b')  // amber
const LOW_ICON    = makePriorityIcon('#22c55e')  // green

function getPriorityIcon(score) {
  if (score >= 50) return HIGH_ICON
  if (score >= 25) return MED_ICON
  return LOW_ICON
}

function getPriorityDot(score) {
  if (score >= 50) return 'bg-red-500'
  if (score >= 25) return 'bg-yellow-500'
  return 'bg-green-500'
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters} m away`
  return `${(meters / 1000).toFixed(1)} km away`
}

function NearbyIssues() {
  const [position, setPosition] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('list') // 'list' | 'map'
  const [upvotedIds, setUpvotedIds] = useState(new Set())
  const [radius, setRadius] = useState(2000)

  useEffect(() => {
    getUserLocation()
  }, [])

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      setLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setPosition([latitude, longitude])
        fetchNearby(latitude, longitude, radius)
      },
      () => {
        setError('Could not get your location. Please allow location access and refresh.')
        setLoading(false)
      }
    )
  }

  const fetchNearby = async (lat, lng, r) => {
    try {
      setLoading(true)
      setError('')
      const response = await api.get(`/api/reports/nearby?lat=${lat}&lng=${lng}&radius=${r}`)
      setReports(response.data.reports)
    } catch (err) {
      setError('Failed to fetch nearby reports')
    } finally {
      setLoading(false)
    }
  }

  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius)
    if (position) {
      fetchNearby(position[0], position[1], newRadius)
    }
  }

  const handleUpvote = async (reportId) => {
    if (upvotedIds.has(reportId)) return
    try {
      const response = await api.post(`/api/reports/${reportId}/upvote`)
      setUpvotedIds(prev => new Set([...prev, reportId]))
      setReports(prev =>
        prev.map(r =>
          r.id === reportId
            ? { ...r, upvoteCount: response.data.report.upvotes }
            : r
        )
      )
    } catch (err) {
      console.error('Upvote failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Finding nearby issues...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Browse Nearby Issues</h1>
          <p className="text-gray-500 mt-1">Open civic reports in your area</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Radius filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 font-medium">Radius:</label>
            {[500, 1000, 2000, 5000].map(r => (
              <button
                key={r}
                onClick={() => handleRadiusChange(r)}
                className={`px-3 py-1 rounded text-sm transition ${
                  radius === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r < 1000 ? `${r}m` : `${r/1000}km`}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="ml-auto flex bg-white border border-gray-300 rounded overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-1.5 text-sm transition ${
                view === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              ☰ List
            </button>
            <button
              onClick={() => setView('map')}
              className={`px-4 py-1.5 text-sm transition ${
                view === 'map' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🗺 Map
            </button>
          </div>
        </div>

        {/* Result count */}
        <p className="text-sm text-gray-500 mb-4">
          {reports.length} open {reports.length === 1 ? 'issue' : 'issues'} found within{' '}
          {radius < 1000 ? `${radius}m` : `${radius/1000}km`}
        </p>

        {/* Priority legend */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> High priority</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Medium priority</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Low priority</span>
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-8 text-center">
                <p className="text-gray-400 text-lg">🎉</p>
                <p className="text-gray-600 font-medium mt-2">No open issues in this area!</p>
                <p className="text-gray-400 text-sm mt-1">Try increasing the radius or come back later.</p>
              </div>
            ) : (
              reports.map(report => (
                <div
                  key={report.id}
                  className="bg-white rounded-xl shadow p-5 flex gap-4"
                >
                  {/* Priority dot */}
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`w-3 h-3 rounded-full ${getPriorityDot(report.priorityScore)}`}
                      title={`Priority: ${report.priorityScore}`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800 text-sm">{report.ticketId}</span>
                      <span className="text-gray-400 text-xs">·</span>
                      <span className="text-gray-500 text-xs">{report.category}</span>
                      <StatusBadge status={report.status} size="sm" />
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-2">{report.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span>📍 {formatDistance(report.distanceMeters)}</span>
                      <span>📋 {report.reportCount} {report.reportCount === 1 ? 'report' : 'reports'}</span>
                      <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Upvote */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleUpvote(report.id)}
                      disabled={upvotedIds.has(report.id)}
                      className={`flex flex-col items-center px-3 py-2 rounded-lg text-sm transition ${
                        upvotedIds.has(report.id)
                          ? 'bg-blue-50 text-blue-600 cursor-default'
                          : 'bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                    >
                      <span className="text-lg">👍</span>
                      <span className="font-medium">{report.upvoteCount}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* MAP VIEW */}
        {view === 'map' && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div style={{ height: '520px' }}>
              <MapContainer
                center={position || [28.6139, 77.2090]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                {/* User position marker (default blue) */}
                {position && (
                  <Marker position={position}>
                    <Popup>
                      <strong>Your Location</strong>
                    </Popup>
                  </Marker>
                )}

                {/* Report markers */}
                {reports.map(report => (
                  <Marker
                    key={report.id}
                    position={[report.location.lat, report.location.lng]}
                    icon={getPriorityIcon(report.priorityScore)}
                  >
                    <Popup>
                      <div className="text-sm min-w-48">
                        <p className="font-semibold">{report.ticketId}</p>
                        <p className="text-gray-500 text-xs">{report.category}</p>
                        <p className="mt-1 text-gray-700 line-clamp-3">{report.description}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-400">{formatDistance(report.distanceMeters)}</span>
                          <button
                            onClick={() => handleUpvote(report.id)}
                            disabled={upvotedIds.has(report.id)}
                            className="text-xs text-blue-600 hover:underline disabled:text-gray-400"
                          >
                            👍 {report.upvoteCount}
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default NearbyIssues
