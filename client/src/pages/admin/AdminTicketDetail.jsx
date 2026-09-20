import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'
import StatusBadge from '../../components/StatusBadge'

// Fix Leaflet default icon
L.Icon.Default.mergeOptions({ iconUrl: icon, shadowUrl: iconShadow })

function AdminTicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [report, setReport] = useState(null)
  const [departmentStaff, setDepartmentStaff] = useState([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [assignMsg, setAssignMsg] = useState('')
  const [assignError, setAssignError] = useState('')

  // Comment state
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)

  useEffect(() => {
    fetchTicketAndStaff()
  }, [id])

  const fetchTicketAndStaff = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/api/reports/${id}`)
      const reportData = res.data.report
      setReport(reportData)

      // Fetch all staff members to filter by ticket's department
      const staffRes = await api.get('/api/staff')
      const allStaff = staffRes.data.staff || []

      // Filter staff matching ticket's department
      const deptId = reportData.department?._id || reportData.department
      const matchedStaff = allStaff.filter(
        (s) => (s.department?._id || s.department) === deptId
      )
      setDepartmentStaff(matchedStaff)

      if (reportData.assignedTo?._id) {
        setSelectedStaffId(reportData.assignedTo._id)
      }
    } catch (err) {
      console.error('Failed to load ticket detail:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle Manual or Auto-assignment
  const handleAssign = async (isAuto = false) => {
    setAssigning(true)
    setAssignMsg('')
    setAssignError('')
    try {
      const payload = isAuto ? {} : { staffId: selectedStaffId }
      const res = await api.patch(`/api/reports/${id}/assign`, payload)
      setAssignMsg(res.data.message || 'Staff assigned successfully!')
      // Refresh report
      const updatedReportRes = await api.get(`/api/reports/${id}`)
      setReport(updatedReportRes.data.report)
      if (updatedReportRes.data.report.assignedTo?._id) {
        setSelectedStaffId(updatedReportRes.data.report.assignedTo._id)
      }
      // Also refresh staff workloads
      const staffRes = await api.get('/api/staff')
      const deptId = updatedReportRes.data.report.department?._id || updatedReportRes.data.report.department
      setDepartmentStaff((staffRes.data.staff || []).filter((s) => (s.department?._id || s.department) === deptId))
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to assign staff')
    } finally {
      setAssigning(false)
    }
  }

  // Handle Admin Comment
  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setCommentSubmitting(true)
    try {
      const res = await api.post(`/api/reports/${id}/comments`, { text: commentText })
      setReport((prev) => ({
        ...prev,
        comments: [...(prev.comments || []), res.data.comment],
      }))
      setCommentText('')
    } catch (err) {
      console.error('Failed to add comment:', err)
    } finally {
      setCommentSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AdminNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AdminNavbar />
        <div className="p-8 max-w-xl mx-auto text-center">
          <p className="text-red-600 font-semibold">Ticket not found</p>
          <button onClick={() => navigate('/admin/tickets')} className="mt-4 text-sm text-gray-600 underline">
            ← Back to Tickets
          </button>
        </div>
      </div>
    )
  }

  const now = new Date()
  const isOverdue = report.slaDeadline && new Date(report.slaDeadline) < now && report.status !== 'resolved'
  const hoursLeft = report.slaDeadline
    ? Math.round((new Date(report.slaDeadline) - now) / (1000 * 60 * 60))
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Breadcrumb & Action */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/admin/tickets')}
            className="text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1.5"
          >
            ← Back to All Tickets
          </button>
          <div className="flex items-center gap-2">
            <StatusBadge status={report.status} size="md" />
            {report.isEscalated && (
              <span className="bg-red-100 text-red-700 border border-red-300 text-xs font-bold px-2.5 py-1 rounded-md animate-pulse">
                🚨 AUTO-ESCALATED (+50)
              </span>
            )}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                <div>
                  <span className="font-mono text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                    {report.ticketId}
                  </span>
                  <h1 className="text-xl font-bold text-gray-900 mt-1">
                    {report.category?.name || 'General Issue'}
                  </h1>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Department</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {report.department?.name || 'Unassigned'}
                  </p>
                </div>
              </div>

              {/* Photos: Before & Resolution After */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {report.photoUrl && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Citizen Upload (Before)
                    </p>
                    <img
                      src={report.photoUrl}
                      alt="Before"
                      className="w-full h-48 object-cover rounded-xl border border-gray-200 shadow-sm"
                    />
                  </div>
                )}
                {report.resolutionPhotoUrl && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1.5">
                      Staff Proof (After Resolution)
                    </p>
                    <img
                      src={report.resolutionPhotoUrl}
                      alt="Resolution"
                      className="w-full h-48 object-cover rounded-xl border border-green-200 shadow-sm"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Citizen Description
                </p>
                <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {report.description}
                </p>
              </div>

              {/* Resolution Note if resolved */}
              {report.resolutionNote && (
                <div className="bg-green-50/70 border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">
                    Staff Resolution Note
                  </p>
                  <p className="text-sm text-green-900">{report.resolutionNote}</p>
                </div>
              )}

              {/* Dispute info if disputed */}
              {report.status === 'disputed' && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">
                      ⚠️ Citizen Dispute Filed
                    </span>
                    <button
                      onClick={() => navigate('/admin/disputes')}
                      className="text-xs font-bold text-orange-700 hover:underline"
                    >
                      Resolve in Disputes Queue →
                    </button>
                  </div>
                  <p className="text-sm text-orange-950 font-medium">
                    "{report.disputeReason}"
                  </p>
                </div>
              )}
            </div>

            {/* Map & Location */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">Geographic Location</span>
                <span className="text-xs text-gray-500">
                  Lat: {report.location?.lat.toFixed(5)}, Lng: {report.location?.lng.toFixed(5)}
                </span>
              </div>
              <div style={{ height: '240px' }}>
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
            </div>

            {/* Comments Thread */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-900 text-sm">
                Activity & Comment Thread ({report.comments?.length || 0})
              </h3>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {(!report.comments || report.comments.length === 0) ? (
                  <p className="text-xs text-gray-400">No comments posted yet.</p>
                ) : (
                  report.comments.map((c, i) => (
                    <div key={c._id || i} className="flex gap-3 text-xs">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${
                          c.authorRole === 'admin'
                            ? 'bg-purple-600'
                            : c.authorRole === 'staff'
                            ? 'bg-blue-600'
                            : 'bg-gray-500'
                        }`}
                      >
                        {c.authorRole === 'admin' ? 'A' : c.authorRole === 'staff' ? 'S' : 'C'}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-900">
                            {c.author?.name || 'User'} ({c.authorRole})
                          </span>
                          <span className="text-gray-400 text-[10px]">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-700">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add comment */}
              <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-gray-100">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write an internal admin note or instruction..."
                  className="flex-1 text-xs border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="submit"
                  disabled={commentSubmitting || !commentText.trim()}
                  className="bg-gray-900 hover:bg-black text-white text-xs font-semibold px-4 py-2 rounded-xl disabled:bg-gray-400 transition"
                >
                  {commentSubmitting ? '...' : 'Post Note'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Sidebar: Assignment & SLA Metrics */}
          <div className="space-y-6">
            {/* SLA Escalation Badge Card */}
            <div
              className={`rounded-2xl p-5 border shadow-sm ${
                report.isEscalated
                  ? 'bg-red-50/90 border-red-300 text-red-900'
                  : isOverdue
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-gray-200'
              }`}
            >
              <h3 className="font-bold text-xs uppercase tracking-wider mb-2">
                SLA & Escalation Status
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Target Category SLA:</span>
                  <span className="font-bold text-gray-800">
                    {report.category?.slaHours || 48} Hours
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Deadline:</span>
                  <span className="font-semibold text-gray-800">
                    {report.slaDeadline
                      ? new Date(report.slaDeadline).toLocaleString()
                      : 'Not defined'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time Remaining:</span>
                  <span
                    className={`font-bold ${
                      isOverdue || report.isEscalated ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {report.status === 'resolved'
                      ? 'Goal Complete'
                      : hoursLeft !== null
                      ? hoursLeft < 0
                        ? `${Math.abs(hoursLeft)}h Overdue`
                        : `${hoursLeft}h remaining`
                      : 'N/A'}
                  </span>
                </div>

                {report.isEscalated && (
                  <div className="pt-2 border-t border-red-200 text-red-700 font-bold text-xs">
                    🚨 Ticket has breached SLA! Priority score boosted (+50) to expedite resolution.
                  </div>
                )}
              </div>
            </div>

            {/* Staff Assignment Control */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Staff Assignment</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allocate to verified staff in {report.department?.name || 'the routed department'}.
                </p>
              </div>

              {assignMsg && (
                <div className="p-2.5 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg font-medium">
                  {assignMsg}
                </div>
              )}
              {assignError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium">
                  {assignError}
                </div>
              )}

              {/* Current Assignee */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
                <span className="text-gray-400 block text-[11px]">Currently Assigned:</span>
                <span className="font-bold text-gray-900 text-sm block mt-0.5">
                  {report.assignedTo ? report.assignedTo.name : '⚠️ None (Unassigned)'}
                </span>
                {report.assignedTo?.email && (
                  <span className="text-gray-500 text-[11px] block">{report.assignedTo.email}</span>
                )}
              </div>

              {/* Staff Dropdown with Live Workloads */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 block">
                  Select Department Staff Member:
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">-- Choose Staff Member --</option>
                  {departmentStaff.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.openTicketsCount} open tickets)
                    </option>
                  ))}
                </select>
                {departmentStaff.length === 0 && (
                  <p className="text-[11px] text-amber-600">
                    No staff found assigned to {report.department?.name}. Create staff in Staff Management.
                  </p>
                )}
              </div>

              {/* Manual Assign Button */}
              <button
                onClick={() => handleAssign(false)}
                disabled={assigning || !selectedStaffId}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2.5 rounded-xl shadow transition disabled:bg-gray-300"
              >
                {assigning ? 'Assigning...' : 'Assign Selected Staff'}
              </button>

              {/* Load-Balanced Auto-Assign Button */}
              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleAssign(true)}
                  disabled={assigning || departmentStaff.length === 0}
                  className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  ⚖️ Auto-Assign (Least Loaded)
                </button>
                <p className="text-[10px] text-gray-400 mt-1 text-center">
                  Selects least-loaded staff in {report.department?.name || 'department'} automatically.
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3 text-xs">
              <h3 className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
                Report Metrics
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 p-2.5 rounded-xl text-center">
                  <p className="text-lg font-bold text-gray-900">{report.priorityScore || 0}</p>
                  <p className="text-[10px] text-gray-400">Priority Score</p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl text-center">
                  <p className="text-lg font-bold text-gray-900">{report.reportCount || 1}</p>
                  <p className="text-[10px] text-gray-400">Citizen Reports</p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl text-center">
                  <p className="text-lg font-bold text-gray-900">{report.upvotes?.length || 0}</p>
                  <p className="text-[10px] text-gray-400">Upvotes</p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-xl text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {report.category?.severityWeight || 1}/10
                  </p>
                  <p className="text-[10px] text-gray-400">Severity Weight</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminTicketDetail
