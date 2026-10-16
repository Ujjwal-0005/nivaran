import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'
import StatusBadge from '../../components/StatusBadge'
import CitizenNavbar from '../../components/CitizenNavbar'
import { getDeptColor } from '../../utils/deptColors'
import { useAuth } from '../../context/AuthContext'

L.Icon.Default.mergeOptions({ iconUrl: icon, shadowUrl: iconShadow })

function makePriorityIcon(color) {
  return L.divIcon({
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  })
}

const HIGH_ICON = makePriorityIcon('#B84A39')
const MED_ICON  = makePriorityIcon('#F59E0B')
const LOW_ICON  = makePriorityIcon('#00875A')

function getPriorityIcon(score) {
  if (score >= 50) return HIGH_ICON
  if (score >= 25) return MED_ICON
  return LOW_ICON
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toFixed(1)} km`
}

const RADIUS_OPTIONS = [500, 1000, 2000, 5000]

function NearbyIssues() {
  const { user } = useAuth()
  const [position, setPosition] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('list')
  const [upvotedIds, setUpvotedIds] = useState(new Set())
  const [radius, setRadius] = useState(2000)

  // Map center hierarchy:
  // 1. User's GPS position
  // 2. Municipality centroid and defaultZoom
  // 3. India's centroid
  const muniCentroid = user?.municipality?.centroid
  const fallbackCenter = muniCentroid
    ? [muniCentroid.lat, muniCentroid.lng]
    : [20.5937, 78.9629]
  const fallbackZoom = user?.municipality?.defaultZoom || 13

  useEffect(() => {
    getUserLocation()
  }, [])

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      if (muniCentroid) {
        setPosition([muniCentroid.lat, muniCentroid.lng])
        fetchNearby(muniCentroid.lat, muniCentroid.lng, radius)
      } else {
        setError('Geolocation is not supported by your browser.')
        setLoading(false)
      }
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setPosition([latitude, longitude])
        fetchNearby(latitude, longitude, radius)
      },
      () => {
        if (muniCentroid) {
          setPosition([muniCentroid.lat, muniCentroid.lng])
          fetchNearby(muniCentroid.lat, muniCentroid.lng, radius)
        } else {
          setError('Could not get your location. Please allow location access.')
          setLoading(false)
        }
      }
    )
  }

  const fetchNearby = async (lat, lng, r) => {
    try {
      setLoading(true)
      setError('')
      const response = await api.get(`/api/reports/nearby?lat=${lat}&lng=${lng}&radius=${r}`)
      setReports(response.data.reports || [])
    } catch {
      setError('Failed to fetch nearby reports')
    } finally {
      setLoading(false)
    }
  }

  const handleRadiusChange = (r) => {
    setRadius(r)
    if (position) fetchNearby(position[0], position[1], r)
  }

  const handleUpvote = async (reportId) => {
    if (upvotedIds.has(reportId)) return
    try {
      const response = await api.post(`/api/reports/${reportId}/upvote`)
      setUpvotedIds(prev => new Set([...prev, reportId]))
      setReports(prev => prev.map(r =>
        r.id === reportId ? { ...r, upvoteCount: response.data.report.upvotes } : r
      ))
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <CitizenNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-sovereign-indigo border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Finding nearby issues…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <CitizenNavbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-sovereign-indigo">
              Nearby Issues
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Open civic issues in your municipality within {formatDistance(radius)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Radius select */}
            <select
              value={radius}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              className="text-xs border border-earthen-slate rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-sovereign-indigo"
            >
              {RADIUS_OPTIONS.map(r => (
                <option key={r} value={r}>{formatDistance(r)}</option>
              ))}
            </select>

            {/* View toggle */}
            <div className="flex border border-earthen-slate rounded overflow-hidden">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-xs font-semibold transition ${
                  view === 'list'
                    ? 'bg-sovereign-indigo text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                List ({reports.length})
              </button>
              <button
                onClick={() => setView('map')}
                className={`px-3 py-1.5 text-xs font-semibold transition ${
                  view === 'map'
                    ? 'bg-sovereign-indigo text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Map
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert-error mb-5 flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="card-nivaran p-12 text-center">
                <span className="text-4xl">🎉</span>
                <h3 className="font-display font-bold text-sovereign-indigo text-lg mt-3">
                  No open issues nearby
                </h3>
                <p className="text-gray-400 text-sm mt-1 max-w-sm mx-auto">
                  No issues found within {formatDistance(radius)}. Try expanding your radius.
                </p>
              </div>
            ) : (
              reports.map((report) => {
                const isUpvoted = upvotedIds.has(report.id)
                return (
                  <div key={report.id} className="card-nivaran p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-sovereign-indigo">{report.ticketId}</span>
                        <StatusBadge status={report.status} />
                        <span className="text-xs text-gray-400">📍 {formatDistance(report.distanceMeters)} away</span>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm">{report.category}</p>
                      <p className="text-xs text-gray-500 line-clamp-1">{report.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleUpvote(report.id)}
                        disabled={isUpvoted}
                        className={`btn-sm flex items-center gap-1.5 text-xs ${
                          isUpvoted ? 'bg-jan-kalyan-green/10 text-jan-kalyan-green' : 'btn-secondary'
                        }`}
                      >
                        <span>👍</span>
                        <span>{report.upvoteCount}</span>
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* MAP VIEW */}
        {view === 'map' && (
          <div className="card-nivaran overflow-hidden">
            <div style={{ height: '520px' }}>
              <MapContainer
                center={position || fallbackCenter}
                zoom={fallbackZoom}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />

                {position && (
                  <Marker position={position}>
                    <Popup><strong>Your Location</strong></Popup>
                  </Marker>
                )}

                {reports.map(report => (
                  <Marker
                    key={report.id}
                    position={[report.location.lat, report.location.lng]}
                    icon={getPriorityIcon(report.priorityScore)}
                  >
                    <Popup>
                      <div className="text-sm min-w-[180px]">
                        <p className="font-bold text-sovereign-indigo">{report.ticketId}</p>
                        <p className="text-gray-500 text-xs">{report.category}</p>
                        <p className="mt-1 text-gray-700 text-xs line-clamp-3">{report.description}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-400">📍 {formatDistance(report.distanceMeters)}</span>
                          <button
                            onClick={() => handleUpvote(report.id)}
                            disabled={upvotedIds.has(report.id)}
                            className="text-xs text-kesariya hover:underline disabled:text-gray-400"
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
      </main>
    </div>
  )
}

export default NearbyIssues
