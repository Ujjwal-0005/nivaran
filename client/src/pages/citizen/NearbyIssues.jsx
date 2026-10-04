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
  const [position, setPosition] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('list')
  const [upvotedIds, setUpvotedIds] = useState(new Set())
  const [radius, setRadius] = useState(2000)

  useEffect(() => { getUserLocation() }, [])

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      setLoading(false); return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setPosition([latitude, longitude])
        fetchNearby(latitude, longitude, radius)
      },
      () => { setError('Could not get your location. Please allow location access and refresh.'); setLoading(false) }
    )
  }

  const fetchNearby = async (lat, lng, r) => {
    try {
      setLoading(true); setError('')
      const response = await api.get(`/api/reports/nearby?lat=${lat}&lng=${lng}&radius=${r}`)
      setReports(response.data.reports)
    } catch { setError('Failed to fetch nearby reports') }
    finally { setLoading(false) }
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="section-header mb-0">
            <div>
              <h1 className="font-display text-2xl font-bold text-sovereign-indigo">Nearby Issues</h1>
              <p className="text-gray-400 text-xs mt-0.5">पास की समस्याएं — Open civic reports in your area</p>
            </div>
          </div>

          {/* View toggle */}
          <div className="flex border border-earthen-slate rounded overflow-hidden bg-white">
            {[
              { key: 'list', label: '☰ List' },
              { key: 'map', label: '🗺 Map' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-4 py-1.5 text-sm font-medium transition ${
                  view === key
                    ? 'bg-sovereign-indigo text-white'
                    : 'text-gray-600 hover:bg-parchment'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        {/* Controls */}
        <div className="card-nivaran px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Radius:</span>
          {RADIUS_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => handleRadiusChange(r)}
              className={`px-3 py-1 rounded text-xs font-semibold transition ${
                radius === r
                  ? 'bg-sovereign-indigo text-white'
                  : 'border border-earthen-slate text-gray-600 hover:border-sovereign-indigo/40 hover:bg-parchment'
              }`}
            >
              {r < 1000 ? `${r}m` : `${r / 1000}km`}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-terracotta-alert inline-block" /> High</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Medium</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-jan-kalyan-green inline-block" /> Low</span>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          {reports.length} open {reports.length === 1 ? 'issue' : 'issues'} within{' '}
          {radius < 1000 ? `${radius}m` : `${radius / 1000}km`}
        </p>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <div className="card-nivaran p-10 text-center">
                <p className="text-3xl mb-3">🎉</p>
                <p className="font-display font-bold text-sovereign-indigo">No open issues nearby!</p>
                <p className="text-gray-400 text-sm mt-1">Try increasing the radius or check back later.</p>
              </div>
            ) : (
              reports.map(report => {
                const deptColor = getDeptColor(report.department)
                return (
                  <div
                    key={report.id}
                    className="card-nivaran p-4 flex gap-4 hover:shadow-md hover:border-earthen-slate-dark transition-all"
                    style={{ borderLeftColor: deptColor.dot, borderLeftWidth: '3px' }}
                  >
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-gray-500">{report.ticketId}</span>
                        <span className="text-gray-300 text-xs">·</span>
                        <span className="text-xs font-medium" style={{ color: deptColor.text }}>
                          {report.category}
                        </span>
                        <StatusBadge status={report.status} size="sm" />
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">{report.description}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
                        <span>📍 {formatDistance(report.distanceMeters)}</span>
                        <span>📋 {report.reportCount} report{report.reportCount !== 1 ? 's' : ''}</span>
                        <span>{new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>

                    {/* Upvote */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => handleUpvote(report.id)}
                        disabled={upvotedIds.has(report.id)}
                        className={`flex flex-col items-center px-3 py-2 rounded text-xs font-semibold transition ${
                          upvotedIds.has(report.id)
                            ? 'bg-sovereign-indigo/10 text-sovereign-indigo cursor-default'
                            : 'border border-earthen-slate text-gray-500 hover:border-kesariya hover:text-kesariya'
                        }`}
                      >
                        <span className="text-base">👍</span>
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
                center={position || [28.6139, 77.2090]}
                zoom={14}
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
