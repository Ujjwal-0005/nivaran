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
  const [departments, setDepartments] = useState([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [assignMsg, setAssignMsg] = useState('')
  const [assignError, setAssignError] = useState('')

  // Action modals state
  const [reassignModalOpen, setReassignModalOpen] = useState(false)
  const [reassignDeptId, setReassignDeptId] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [reassignLoading, setReassignLoading] = useState(false)
  const [reassignError, setReassignError] = useState('')

  const [forwardModalOpen, setForwardModalOpen] = useState(false)
  const [forwardDeptId, setForwardDeptId] = useState('')
  const [forwardRef, setForwardRef] = useState('')
  const [forwardNote, setForwardNote] = useState('')
  const [forwardLoading, setForwardLoading] = useState(false)
  const [forwardError, setForwardError] = useState('')

  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [extStatus, setExtStatus] = useState('acknowledged')
  const [extNote, setExtNote] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState('')

  // Comment state
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)

  useEffect(() => {
    fetchTicketAndStaff()
  }, [id])

  const fetchTicketAndStaff = async () => {
    try {
      setLoading(true)
      const [res, deptsRes, staffRes] = await Promise.all([
        api.get(`/api/reports/${id}`),
        api.get('/api/departments'),
        api.get('/api/staff')
      ])
      const reportData = res.data.report
      setReport(reportData)
      setDepartments(deptsRes.data.departments || [])

      // Filter staff matching ticket's handled department
      const allStaff = staffRes.data.staff || []
      const deptId = reportData.handledBy?._id || reportData.department?._id || reportData.department
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

  // Handle Reassign
  const handleReassign = async (e) => {
    e.preventDefault()
    if (!reassignDeptId) {
      setReassignError('Please select a target department')
      return
    }
    if (reassignReason.trim().length < 5) {
      setReassignError('Reason must be at least 5 characters')
      return
    }
    setReassignLoading(true)
    setReassignError('')
    try {
      await api.patch(`/api/reports/${id}/reassign-department`, {
        targetDepartmentId: reassignDeptId,
        reason: reassignReason.trim(),
      })
      setReassignModalOpen(false)
      setReassignReason('')
      setReassignDeptId('')
      fetchTicketAndStaff()
    } catch (err) {
      setReassignError(err.response?.data?.message || 'Failed to reassign ticket')
    } finally {
      setReassignLoading(false)
    }
  }

  // Handle Forward
  const handleForward = async (e) => {
    e.preventDefault()
    if (!forwardDeptId) {
      setForwardError('Please select an external agency')
      return
    }
    if (forwardNote.trim().length < 5) {
      setForwardError('Forwarding note must be at least 5 characters')
      return
    }
    setForwardLoading(true)
    setForwardError('')
    try {
      await api.post(`/api/reports/${id}/forward`, {
        departmentId: forwardDeptId,
        agencyReference: forwardRef.trim() || undefined,
        note: forwardNote.trim(),
      })
      setForwardModalOpen(false)
      setForwardDeptId('')
      setForwardRef('')
      setForwardNote('')
      fetchTicketAndStaff()
    } catch (err) {
      setForwardError(err.response?.data?.message || 'Failed to forward ticket')
    } finally {
      setForwardLoading(false)
    }
  }

  // Handle External Status Update
  const handleExternalStatus = async (e) => {
    e.preventDefault()
    if (extNote.trim().length < 10) {
      setStatusError('Update note must be at least 10 characters')
      return
    }
    setStatusLoading(true)
    setStatusError('')
    try {
      await api.patch(`/api/reports/${id}/external-status`, {
        status: extStatus,
        note: extNote.trim(),
      })
      setStatusModalOpen(false)
      setExtNote('')
      fetchTicketAndStaff()
    } catch (err) {
      setStatusError(err.response?.data?.message || 'Failed to update external status')
    } finally {
      setStatusLoading(false)
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
      <div className="page-shell flex flex-col">
        <AdminNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-sovereign-indigo border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="page-shell flex flex-col">
        <AdminNavbar />
        <div className="p-8 max-w-xl mx-auto text-center">
          <p className="text-terracotta-alert font-semibold">Ticket not found</p>
          <button onClick={() => navigate('/admin/tickets')} className="mt-4 text-sm text-gray-500 hover:text-kesariya transition underline">
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
    <div className="page-shell flex flex-col">
      <AdminNavbar />

      <main className="flex-1 page-content-wide space-y-6">
        {/* Top Breadcrumb & Action */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/admin/tickets')}
            className="text-xs sm:text-sm font-semibold text-gray-500 hover:text-kesariya transition flex items-center gap-1.5"
          >
            ← Back to All Tickets
          </button>
          <div className="flex items-center gap-2">
            <StatusBadge status={report.status} size="md" />
            {report.isEscalated && (
              <span className="badge-escalated text-xs px-2.5 py-1">
                🚨 AUTO-ESCALATED (+50)
              </span>
            )}
          </div>
        </div>

        {/* Unresolved Department Banner */}
        {report.departmentUnresolved && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h2 className="text-sm font-bold text-amber-900">
                  Needs Department Assignment
                </h2>
                <p className="text-xs text-amber-700 mt-0.5">
                  Automatic routing could not find a primary or fallback department for this sector. Please assign a department manually.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setReassignError('')
                setReassignDeptId('')
                setReassignReason('Initial manual department assignment')
                setReassignModalOpen(true)
              }}
              className="btn-kesariya text-xs px-4 py-2 font-bold whitespace-nowrap shadow-sm"
            >
              Assign a Department →
            </button>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="card-nivaran p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                <div>
                  <span className="font-mono text-xs font-bold text-sovereign-indigo bg-parchment border border-earthen-slate px-2 py-0.5 rounded">
                    {report.ticketId}
                  </span>
                  <h1 className="font-display text-xl font-bold text-gray-900 mt-1">
                    {report.category?.name || 'General Issue'}
                  </h1>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Department</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {report.handledBy?.name || report.department?.name || 'Unassigned'}
                  </p>
                </div>
              </div>

              {/* Handled by & Routing Panel */}
              <div className="bg-parchment/60 rounded-xl p-4 border border-earthen-slate space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                      Handled By
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-display font-bold text-base text-sovereign-indigo">
                        {report.handledBy?.name || report.department?.name || '⚠️ Unassigned'}
                      </span>
                      {report.handledBy?.isExternal && (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-300">
                          External Agency
                        </span>
                      )}
                      {report.departmentUnresolved && (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-300">
                          Unresolved
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions for city admin */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                    <button
                      onClick={() => {
                        setReassignError('')
                        setReassignDeptId(report.handledBy?._id || report.department?._id || '')
                        setReassignReason('')
                        setReassignModalOpen(true)
                      }}
                      className="btn-ghost text-xs px-3 py-1.5 font-bold"
                    >
                      Reassign
                    </button>
                    <button
                      onClick={() => {
                        setForwardError('')
                        setForwardDeptId('')
                        setForwardRef('')
                        setForwardNote('')
                        setForwardModalOpen(true)
                      }}
                      className="btn-ghost text-xs px-3 py-1.5 font-bold text-purple-700 hover:text-purple-900 border-purple-200"
                    >
                      Forward to Agency
                    </button>
                    {report.handledBy?.isExternal && (
                      <button
                        onClick={() => {
                          setStatusError('')
                          setExtStatus(report.status === 'resolved' ? 'resolved' : 'in_progress')
                          setExtNote('')
                          setStatusModalOpen(true)
                        }}
                        className="btn-primary text-xs px-3 py-1.5 font-bold"
                      >
                        Update Agency Ticket
                      </button>
                    )}
                  </div>
                </div>

                {/* Routing explanation in plain words */}
                <div className="text-xs text-gray-600 bg-white/70 p-2.5 rounded-lg border border-gray-200/60">
                  <span className="font-semibold text-gray-700">How it was routed: </span>
                  {report.routedBy === 'category_override' && (
                    <span>Forced by your city's category setting</span>
                  )}
                  {report.routedBy === 'sector_primary' && (
                    <span>Primary department for this sector</span>
                  )}
                  {report.routedBy === 'sector_fallback' && (
                    <span>Fallback department (no primary available)</span>
                  )}
                  {report.routedBy === 'reassigned' && (
                    <span>Manually reassigned by city administrator</span>
                  )}
                  {(!report.routedBy || report.routedBy === 'none') && (
                    <span>No department matched</span>
                  )}
                  {report.forwarding?.forwardedAt && (
                    <div className="mt-1 pt-1 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-purple-800">
                      <span><strong>Forwarded on:</strong> {new Date(report.forwarding.forwardedAt).toLocaleDateString()}</span>
                      {report.forwarding.agencyReference && (
                        <span><strong>Agency Ref:</strong> {report.forwarding.agencyReference}</span>
                      )}
                      {report.forwarding.note && (
                        <span className="w-full text-gray-600"><strong>Note:</strong> {report.forwarding.note}</span>
                      )}
                    </div>
                  )}
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
                <p className="text-sm text-gray-800 bg-parchment p-3 rounded border border-earthen-slate">
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
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                      ⚠️ Citizen Dispute Filed
                    </span>
                    <button
                      onClick={() => navigate('/admin/disputes')}
                      className="text-xs font-bold text-kesariya hover:text-civic-flame transition"
                    >
                      Resolve in Disputes Queue →
                    </button>
                  </div>
                  <p className="text-sm text-amber-950 font-medium italic">
                    "{report.disputeReason}"
                  </p>
                </div>
              )}
            </div>

            {/* Map & Location */}
            <div className="card-nivaran overflow-hidden">
              <div className="px-6 py-3 border-b border-earthen-slate flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Geographic Location</span>
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

            {/* Routing History Timeline */}
            <div className="card-nivaran p-6 space-y-3">
              <h3 className="font-display font-bold text-sovereign-indigo text-sm">
                Routing & Reassignment History ({report.routingHistory?.length || 0})
              </h3>
              {(!report.routingHistory || report.routingHistory.length === 0) ? (
                <p className="text-xs text-gray-400">No reassignments recorded. Ticket is on its initial route.</p>
              ) : (
                <div className="space-y-2.5 border-l-2 border-sovereign-indigo/20 ml-2 pl-3 py-1 text-xs">
                  {report.routingHistory.map((item, idx) => (
                    <div key={item._id || idx} className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">
                          {item.fromDepartment?.name || 'Previous'} → {item.toDepartment?.name || 'New'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {item.changedAt ? new Date(item.changedAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <p className="text-gray-600 italic">
                        "{item.reason}"
                      </p>
                      {item.changedBy?.name && (
                        <p className="text-[10px] text-gray-400">By {item.changedBy.name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments Thread */}
            <div className="card-nivaran p-6 space-y-4">
              <h3 className="font-display font-bold text-sovereign-indigo text-sm">
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
                  className="input-nivaran flex-1"
                />
                <button
                  type="submit"
                  disabled={commentSubmitting || !commentText.trim()}
                  className="btn-primary text-xs px-4 py-2"
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
                  ? 'bg-terracotta-alert/10 border-terracotta-alert/30 text-terracotta-alert'
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
                      isOverdue || report.isEscalated ? 'text-terracotta-alert' : 'text-jan-kalyan-green'
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
                  <div className="pt-2 border-t border-terracotta-alert/30 text-terracotta-alert font-bold text-xs">
                    🚨 Ticket has breached SLA! Priority score boosted (+50) to expedite resolution.
                  </div>
                )}
              </div>
            </div>

            {/* Staff Assignment Control */}
            <div className="card-nivaran p-5 space-y-4">
              <div>
                <h3 className="font-display font-bold text-sovereign-indigo text-sm">Staff Assignment</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Allocate to verified staff in {report.handledBy?.name || report.department?.name || 'the routed department'}.
                </p>
              </div>

              {/* Blocked for External Agency Tickets */}
              {report.handledBy?.isExternal ? (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-purple-900">
                    🏢 External Agency Ticket
                  </p>
                  <p className="text-xs text-purple-700">
                    Handled by an external agency; cannot be assigned to city staff. Use "Update Agency Ticket" to record external updates.
                  </p>
                </div>
              ) : (
                <>
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
                      className="input-nivaran w-full"
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
                        No staff found assigned to {report.handledBy?.name || report.department?.name}. Create staff in Staff Management.
                      </p>
                    )}
                  </div>

                  {/* Manual Assign Button */}
                  <button
                    onClick={() => handleAssign(false)}
                    disabled={assigning || !selectedStaffId}
                    className="btn-kesariya w-full py-2.5 text-xs font-bold"
                  >
                    {assigning ? 'Assigning...' : 'Assign Selected Staff'}
                  </button>

                  {/* Load-Balanced Auto-Assign Button */}
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleAssign(true)}
                      disabled={assigning || departmentStaff.length === 0}
                      className="btn-ghost w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      ⚖️ Auto-Assign (Least Loaded)
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1 text-center">
                      Selects least-loaded staff in {report.handledBy?.name || report.department?.name || 'department'} automatically.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="card-nivaran p-5 space-y-3 text-xs">
              <h3 className="font-display font-bold text-sovereign-indigo uppercase tracking-wider text-[11px]">
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

        {/* Modal: Reassign Department */}
        {reassignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="card-nivaran max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div>
                <h3 className="font-display font-bold text-lg text-sovereign-indigo">
                  Reassign Department
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Move this ticket to another department in your city. A mandatory audit reason will be recorded.
                </p>
              </div>

              {reassignError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {reassignError}
                </div>
              )}

              <form onSubmit={handleReassign} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Target Department *
                  </label>
                  <select
                    value={reassignDeptId}
                    onChange={(e) => setReassignDeptId(e.target.value)}
                    className="input-nivaran w-full"
                    required
                  >
                    <option value="">-- Select Department --</option>
                    {departments.filter((d) => d.isActive !== false).map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} {d.isExternal ? '(External)' : '(Municipal)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Reason for Reassignment * (minimum 5 characters)
                  </label>
                  <textarea
                    rows={3}
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="e.g. Jurisdiction is under Roads wing rather than Sanitation"
                    className="input-nivaran w-full"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setReassignModalOpen(false)}
                    className="btn-ghost text-xs px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reassignLoading}
                    className="btn-kesariya text-xs px-5 py-2 font-bold"
                  >
                    {reassignLoading ? 'Reassigning...' : 'Confirm Reassign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Forward to External Agency */}
        {forwardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="card-nivaran max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div>
                <h3 className="font-display font-bold text-lg text-purple-900">
                  Forward to External Agency
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Hand off this ticket to an external authority (e.g., PSPCL, PWD, Police). City staff cannot be assigned to it once forwarded.
                </p>
              </div>

              {forwardError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {forwardError}
                </div>
              )}

              <form onSubmit={handleForward} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    External Agency *
                  </label>
                  <select
                    value={forwardDeptId}
                    onChange={(e) => setForwardDeptId(e.target.value)}
                    className="input-nivaran w-full"
                    required
                  >
                    <option value="">-- Select External Agency --</option>
                    {departments.filter((d) => d.isExternal && d.isActive !== false).map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} {d.agencyCode ? `[${d.agencyCode}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Agency Reference Number / Token (Optional, max 100 chars)
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={forwardRef}
                    onChange={(e) => setForwardRef(e.target.value)}
                    placeholder="e.g. PSPCL-GR-88421"
                    className="input-nivaran w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Forwarding Note * (minimum 5 characters)
                  </label>
                  <textarea
                    rows={3}
                    value={forwardNote}
                    onChange={(e) => setForwardNote(e.target.value)}
                    placeholder="e.g. High-voltage transformer sparking, requires immediate grid division response."
                    className="input-nivaran w-full"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setForwardModalOpen(false)}
                    className="btn-ghost text-xs px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forwardLoading}
                    className="btn-primary text-xs px-5 py-2 font-bold"
                  >
                    {forwardLoading ? 'Forwarding...' : 'Forward to Agency'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Update Agency Ticket Status */}
        {statusModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="card-nivaran max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div>
                <h3 className="font-display font-bold text-lg text-sovereign-indigo">
                  Update External Agency Ticket
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Log status updates received from the external agency. This updates ticket progress without requiring city staff action.
                </p>
              </div>

              {statusError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {statusError}
                </div>
              )}

              <form onSubmit={handleExternalStatus} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    External Status *
                  </label>
                  <select
                    value={extStatus}
                    onChange={(e) => setExtStatus(e.target.value)}
                    className="input-nivaran w-full"
                  >
                    <option value="acknowledged">Acknowledged (Agency received ticket)</option>
                    <option value="in_progress">In Progress (Agency dispatch on site)</option>
                    <option value="resolved">Resolved (Agency completed resolution)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Update Note * (minimum 10 characters)
                  </label>
                  <textarea
                    rows={3}
                    value={extNote}
                    onChange={(e) => setExtNote(e.target.value)}
                    placeholder="e.g. PSPCL Lineman team has arrived and isolated the sparking connection."
                    className="input-nivaran w-full"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setStatusModalOpen(false)}
                    className="btn-ghost text-xs px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={statusLoading}
                    className="btn-kesariya text-xs px-5 py-2 font-bold"
                  >
                    {statusLoading ? 'Updating...' : 'Save Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminTicketDetail
