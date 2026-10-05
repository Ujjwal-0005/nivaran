import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'
import StatusBadge from '../../components/StatusBadge'
import StaffNavbar from '../../components/StaffNavbar'
import { getDeptColor } from '../../utils/deptColors'

L.Icon.Default.mergeOptions({ iconUrl: icon, shadowUrl: iconShadow })

function roleLabel(role) {
  return role === 'staff' ? 'Staff' : role === 'admin' ? 'Admin' : 'Citizen'
}

function roleBadgeClass(role) {
  if (role === 'staff') return 'bg-blue-50 text-blue-700 border border-blue-200'
  if (role === 'admin') return 'bg-violet-50 text-violet-700 border border-violet-200'
  return 'bg-gray-50 text-gray-600 border border-earthen-slate'
}

// ── Resolve Form ───────────────────────────────────────
function ResolveForm({ reportId, onSuccess }) {
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (file) { setPhoto(file); setPhotoPreview(URL.createObjectURL(file)) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!note.trim()) { setError('Please provide a resolution note'); return }
    if (!photo) { setError('An after-photo is required to mark this resolved'); return }
    const formData = new FormData()
    formData.append('status', 'resolved')
    formData.append('resolutionNote', note)
    formData.append('resolutionPhoto', photo)
    setSubmitting(true); setError('')
    try {
      await api.patch(`/api/reports/${reportId}/status`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark resolved')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="card-nivaran p-5 border-jan-kalyan-green/40" style={{ borderColor: '#00875A50' }}>
      <p className="text-xs font-bold uppercase tracking-widest text-jan-kalyan-green mb-3">Mark as Resolved</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-nivaran">After-Photo <span className="text-terracotta-alert">*</span></label>
          <label
            htmlFor="resolve-photo"
            className="flex flex-col items-center border-2 border-dashed border-earthen-slate rounded cursor-pointer hover:border-jan-kalyan-green hover:bg-jan-kalyan-green/5 transition p-4 text-center"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="h-32 w-auto rounded object-cover" />
            ) : (
              <>
                <span className="text-2xl mb-1">📷</span>
                <p className="text-xs text-gray-500 font-medium">Upload after-photo</p>
              </>
            )}
            <input id="resolve-photo" type="file" accept="image/jpeg,image/jpg,image/png" onChange={handlePhoto} required className="sr-only" />
          </label>
        </div>

        <div>
          <label className="label-nivaran">Resolution Note <span className="text-terracotta-alert">*</span></label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Briefly describe what was done to resolve this issue…"
            rows={3}
            required
            className="input-nivaran resize-none"
          />
        </div>

        {error && <p className="text-terracotta-alert text-xs">{error}</p>}

        <button type="submit" disabled={submitting} className="w-full py-3 text-sm font-bold text-white rounded transition"
          style={{ background: submitting ? '#B5A895' : '#00875A' }}>
          {submitting ? 'Uploading & Resolving…' : '✦ Confirm Resolution'}
        </button>
      </form>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────
function StaffTicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')

  useEffect(() => { fetchReport() }, [id])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/api/reports/${id}`)
      setReport(res.data.report)
    } catch { setError('Failed to load ticket') }
    finally { setLoading(false) }
  }

  const handleStartWork = async () => {
    setStatusUpdating(true); setActionError('')
    try {
      const fd = new FormData()
      fd.append('status', 'in_progress')
      await api.patch(`/api/reports/${id}/status`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      fetchReport()
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update status')
    } finally { setStatusUpdating(false) }
  }

  const handleResolveSuccess = () => { setShowResolveForm(false); fetchReport() }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setCommentSubmitting(true); setCommentError('')
    try {
      const res = await api.post(`/api/reports/${id}/comments`, { text: commentText })
      setReport(prev => ({ ...prev, comments: [...(prev.comments || []), res.data.comment] }))
      setCommentText('')
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Failed to add comment')
    } finally { setCommentSubmitting(false) }
  }

  const mapsUrl = report
    ? `https://www.openstreetmap.org/directions?from=&to=${report.location.lat}%2C${report.location.lng}#map=17/${report.location.lat}/${report.location.lng}`
    : '#'

  if (loading) {
    return (
      <div className="page-shell">
        <StaffNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-sovereign-indigo border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="page-shell">
        <StaffNavbar />
        <div className="max-w-xl mx-auto px-4 py-5">
          <div className="alert-error">{error || 'Ticket not found'}</div>
          <button onClick={() => navigate('/staff')} className="mt-3 text-sm text-gray-500 hover:text-sovereign-indigo transition">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const deptColor = getDeptColor(report.department?.name || report.category?.department?.name)
  const isResolved = report.status === 'resolved'

  return (
    <div className="page-shell">
      {/* Sticky ticket header */}
      <header className="bg-sovereign-indigo text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-40 shadow">
        <button
          onClick={() => navigate('/staff')}
          className="text-white/70 hover:text-white transition text-lg leading-none"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-white/50 uppercase tracking-widest" style={{ color: deptColor.dot }}>
            {report.category?.name}
          </p>
          <h1 className="font-display font-bold text-sm truncate">{report.ticketId}</h1>
        </div>
        <StatusBadge status={report.status} size="sm" />
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-4">

        {/* Resolved stamp */}
        {isResolved && (
          <div className="flex justify-center py-2">
            <span className="stamp-resolved text-sm">✦ निवारण · Issue Resolved</span>
          </div>
        )}

        {/* Before photo */}
        {report.photoUrl && (
          <div className="card-nivaran overflow-hidden">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">Before Photo</p>
            <img src={report.photoUrl} alt="Before" className="w-full object-cover max-h-60" />
          </div>
        )}

        {/* Description */}
        <div className="card-nivaran p-4">
          <p className="label-nivaran mb-2">Description</p>
          <p className="text-sm text-gray-700 leading-relaxed">{report.description}</p>
        </div>

        {/* Location */}
        <div className="card-nivaran overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="label-nivaran mb-0">Location</p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-kesariya hover:text-civic-flame transition flex items-center gap-1"
            >
              🧭 Get Directions
            </a>
          </div>
          <div style={{ height: '200px' }}>
            <MapContainer
              center={[report.location.lat, report.location.lng]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[report.location.lat, report.location.lng]} />
            </MapContainer>
          </div>
          <p className="text-[10px] text-gray-400 px-4 py-2">
            {report.location.lat.toFixed(6)}, {report.location.lng.toFixed(6)}
          </p>
        </div>

        {/* Meta strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Priority', value: report.priorityScore || 0 },
            { label: 'Reports', value: report.reportCount },
            { label: 'Upvotes', value: report.upvotes?.length || 0 },
          ].map(m => (
            <div key={m.label} className="card-nivaran p-3 text-center">
              <p className="font-display font-bold text-sovereign-indigo text-lg">{m.value}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Resolution proof */}
        {isResolved && (
          <div className="card-nivaran overflow-hidden" style={{ borderColor: '#00875A40' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-jan-kalyan-green px-4 pt-3 pb-1">Resolution Proof</p>
            {report.resolutionPhotoUrl && (
              <img src={report.resolutionPhotoUrl} alt="After" className="w-full object-cover max-h-60" />
            )}
            {report.resolutionNote && (
              <p className="text-sm text-gray-700 px-4 py-3">{report.resolutionNote}</p>
            )}
          </div>
        )}

        {/* Action buttons */}
        {actionError && <div className="alert-error text-xs">{actionError}</div>}

        {report.status === 'reported' && (
          <div className="card-nivaran p-4 border-amber-200" style={{ borderColor: '#FCD34D' }}>
            <p className="text-sm text-amber-800 mb-3">
              This ticket is <strong>reported but not yet acknowledged</strong>. Acknowledging it signals you are aware.
            </p>
            <button
              onClick={handleStartWork}
              disabled={statusUpdating}
              className="w-full py-2.5 text-sm font-bold text-white rounded transition"
              style={{ background: statusUpdating ? '#B5A895' : '#F57F17' }}
            >
              {statusUpdating ? 'Updating…' : '👁 Acknowledge Ticket'}
            </button>
          </div>
        )}

        {report.status === 'acknowledged' && (
          <button
            onClick={handleStartWork}
            disabled={statusUpdating}
            className="w-full btn-primary py-3 text-sm"
          >
            {statusUpdating ? 'Updating…' : '▶ Start Work'}
          </button>
        )}

        {report.status === 'in_progress' && !showResolveForm && (
          <button
            onClick={() => setShowResolveForm(true)}
            className="w-full py-3 text-sm font-bold text-white rounded transition active:scale-[0.98]"
            style={{ background: '#00875A' }}
          >
            ✦ Mark as Resolved
          </button>
        )}

        {report.status === 'in_progress' && showResolveForm && (
          <ResolveForm reportId={id} onSuccess={handleResolveSuccess} />
        )}

        {/* Comments */}
        <div className="card-nivaran p-4">
          <p className="label-nivaran mb-3">Comments ({report.comments?.length || 0})</p>

          <div className="space-y-3 mb-4">
            {(!report.comments || report.comments.length === 0) ? (
              <p className="text-xs text-gray-400">No comments yet.</p>
            ) : (
              report.comments.map((comment, idx) => (
                <div key={comment._id || idx} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-sovereign-indigo/10 flex items-center justify-center text-sovereign-indigo text-xs font-bold flex-shrink-0">
                    {comment.author?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-gray-800">{comment.author?.name || 'Unknown'}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${roleBadgeClass(comment.authorRole)}`}>
                        {roleLabel(comment.authorRole)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 bg-parchment rounded px-2.5 py-1.5 border border-earthen-slate">
                      {comment.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a note…"
              className="input-nivaran flex-1"
            />
            <button
              type="submit"
              disabled={commentSubmitting || !commentText.trim()}
              className="btn-primary px-3 py-2 text-sm"
            >
              {commentSubmitting ? '…' : 'Post'}
            </button>
          </form>
          {commentError && <p className="text-terracotta-alert text-xs mt-1">{commentError}</p>}
        </div>
      </main>
    </div>
  )
}

export default StaffTicketDetail
