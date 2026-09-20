import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'
import StatusBadge from '../../components/StatusBadge'

// Fix Leaflet default icon issue with Vite
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  shadowUrl: iconShadow,
})

// Priority-coded marker icons
function makePriorityIcon(color) {
  return L.divIcon({
    html: `<div style="
      width: 22px; height: 22px; border-radius: 50%;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    "></div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  })
}

const HIGH_ICON = makePriorityIcon('#ef4444') // red (score >= 50 or escalated)
const MED_ICON = makePriorityIcon('#f59e0b')  // amber (score >= 25)
const LOW_ICON = makePriorityIcon('#22c55e')  // green (< 25)

function getPriorityMarker(report) {
  if (report.isEscalated || (report.priorityScore || 0) >= 50) return HIGH_ICON
  if ((report.priorityScore || 0) >= 25) return MED_ICON
  return LOW_ICON
}

function AdminMap() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('open') // 'open' | 'all' | specific
  const [escalatedOnly, setEscalatedOnly] = useState(false)

  // Slide-in panel selected ticket
  const [activeTicket, setActiveTicket] = useState(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [reportsRes, deptRes, catRes] = await Promise.all([
        api.get('/api/reports'),
        api.get('/api/departments'),
        api.get('/api/categories'),
      ])
      setReports(reportsRes.data.reports || [])
      setDepartments(deptRes.data.departments || [])
      setCategories(catRes.data.categories || [])
    } catch (err) {
      console.error('Error fetching map data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter logic
  const filteredReports = reports.filter((r) => {
    if (!r.location?.lat || !r.location?.lng) return false

    // Status filter
    if (selectedStatus === 'open') {
      if (r.status === 'resolved') return false
    } else if (selectedStatus !== 'all' && selectedStatus !== '') {
      if (r.status !== selectedStatus) return false
    }

    // Dept filter
    if (selectedDept) {
      const deptId = r.department?._id || r.department
      if (deptId !== selectedDept) return false
    }

    // Category filter
    if (selectedCat) {
      const catId = r.category?._id || r.category
      if (catId !== selectedCat) return false
    }

    // Escalated filter
    if (escalatedOnly && !r.isEscalated) {
      return false
    }

    return true
  })

  // Map center calculation
  const defaultCenter = [31.25, 75.70] // Default Punjab center
  const mapCenter =
    filteredReports.length > 0
      ? [filteredReports[0].location.lat, filteredReports[0].location.lng]
      : defaultCenter

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <AdminNavbar />

      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Filter Toolbar / Sidebar */}
        <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-gray-200 p-4 z-20 overflow-y-auto flex-shrink-0 space-y-4 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-gray-900">Map Controls</h2>
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-orange-600">{filteredReports.length}</span> tickets plotted
            </p>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="open">Open Only (Excl. Resolved)</option>
              <option value="all">All Statuses (Including Resolved)</option>
              <option value="reported">Reported</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="disputed">Disputed</option>
            </select>
          </div>

          {/* Department filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value)
                setSelectedCat('') // reset cat filter when dept changes
              }}
              className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded-lg p-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">All Categories</option>
              {categories
                .filter((c) => !selectedDept || (c.department?._id || c.department) === selectedDept)
                .map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Escalated Toggle */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              type="checkbox"
              id="escalatedOnly"
              checked={escalatedOnly}
              onChange={(e) => setEscalatedOnly(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
            />
            <label htmlFor="escalatedOnly" className="text-xs font-semibold text-red-700 cursor-pointer">
              Escalated tickets only 🚨
            </label>
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-gray-100 text-xs space-y-1.5">
            <p className="font-semibold text-gray-700">Priority Markers:</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block border border-white shadow-sm" />
              <span className="text-gray-600">High / Escalated (&ge;50)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block border border-white shadow-sm" />
              <span className="text-gray-600">Medium (25 - 49)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block border border-white shadow-sm" />
              <span className="text-gray-600">Low (&lt;25)</span>
            </div>
          </div>
        </aside>

        {/* Map View */}
        <div className="flex-1 relative h-full">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <p className="text-sm text-gray-500">Loading civic map...</p>
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              <MarkerClusterGroup chunkedLoading>
                {filteredReports.map((report) => (
                  <Marker
                    key={report._id}
                    position={[report.location.lat, report.location.lng]}
                    icon={getPriorityMarker(report)}
                    eventHandlers={{
                      click: () => setActiveTicket(report),
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1 p-1">
                        <p className="font-bold text-gray-900">{report.ticketId}</p>
                        <p className="text-gray-600 font-medium">{report.category?.name}</p>
                        <p className="text-gray-500 line-clamp-2">{report.description}</p>
                        <div className="pt-1 flex items-center justify-between">
                          <StatusBadge status={report.status} size="sm" />
                          <button
                            onClick={() => navigate(`/admin/tickets/${report._id}`)}
                            className="text-orange-600 font-bold hover:underline"
                          >
                            Details →
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          )}

          {/* Slide-in Ticket Summary Panel */}
          {activeTicket && (
            <div className="absolute top-4 right-4 z-[1000] w-80 sm:w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 p-5 space-y-4 animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-gray-900">
                    {activeTicket.ticketId}
                  </span>
                  <StatusBadge status={activeTicket.status} size="sm" />
                </div>
                <button
                  onClick={() => setActiveTicket(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
                >
                  ✕
                </button>
              </div>

              {activeTicket.isEscalated && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 font-bold flex items-center gap-1.5 animate-pulse">
                  🚨 SLA Breached & Auto-Escalated (+50 Priority)
                </div>
              )}

              {activeTicket.photoUrl && (
                <img
                  src={activeTicket.photoUrl}
                  alt="Issue"
                  className="w-full h-36 object-cover rounded-xl border border-gray-200 shadow-sm"
                />
              )}

              <div className="space-y-1">
                <p className="text-xs text-gray-400 uppercase font-semibold">Category & Department</p>
                <p className="text-sm font-bold text-gray-800">
                  {activeTicket.category?.name || 'Issue'}{' '}
                  <span className="text-xs font-normal text-gray-500">
                    ({activeTicket.department?.name || 'General'})
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-gray-400 uppercase font-semibold">Description</p>
                <p className="text-xs text-gray-700 max-h-20 overflow-y-auto bg-gray-50 p-2 rounded-lg">
                  {activeTicket.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2 rounded-lg">
                  <span className="text-gray-400 block">Priority</span>
                  <span className="font-bold text-gray-800">{activeTicket.priorityScore || 0}</span>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg">
                  <span className="text-gray-400 block">Assigned Staff</span>
                  <span className="font-semibold text-gray-800 truncate block">
                    {activeTicket.assignedTo ? activeTicket.assignedTo.name : 'Unassigned'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => navigate(`/admin/tickets/${activeTicket._id}`)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2.5 rounded-xl shadow transition text-center"
                >
                  Manage & Assign Ticket →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminMap
