import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'
import StatusBadge from '../../components/StatusBadge'
import { useAuth } from '../../context/AuthContext'

// Fix Leaflet default icon
L.Icon.Default.mergeOptions({ iconUrl: icon, shadowUrl: iconShadow })

// Role label for comments
function roleLabel(role) {
  return role === 'staff' ? 'Staff' : role === 'admin' ? 'Admin' : 'Citizen'
}

// ── Resolve Form ──────────────────────────────────────────────────────────────
function ResolveForm({ reportId, onSuccess }) {
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!note.trim()) { setError('Please provide a resolution note'); return }
    if (!photo) { setError('An after-photo is required to mark this resolved'); return }

    const formData = new FormData()
    formData.append('status', 'resolved')
    formData.append('resolutionNote', note)
    formData.append('resolutionPhoto', photo)

    setSubmitting(true)
    setError('')
    try {
      await api.patch(`/api/reports/${reportId}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark resolved')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <h3 className="font-semibold text-green-800 mb-3">Mark as Resolved</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* After photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            After-Photo <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handlePhoto}
            required
            className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-green-100 file:text-green-700 hover:file:bg-green-200"
          />
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Preview"
              className="mt-2 h-32 w-auto rounded object-cover border border-green-200"
            />
          )}
        </div>

        {/* Resolution note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Resolution Note <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Briefly describe what was done to resolve this issue..."
            rows={3}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-700 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-green-800 transition disabled:bg-gray-400"
        >
          {submitting ? 'Uploading & Resolving...' : 'Confirm Resolution'}
        </button>
      </form>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
function StaffTicketDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Comment state
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')

  useEffect(() => {
    fetchReport()
  }, [id])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await api.get(`/api/reports/${id}`)
      setReport(res.data.report)
    } catch {
      setError('Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }

  // Start Work: acknowledged → in_progress
  const handleStartWork = async () => {
    setStatusUpdating(true)
    setActionError('')
    try {
      const formData = new FormData()
      formData.append('status', 'in_progress')
      await api.patch(`/api/reports/${id}/status`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      fetchReport()
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update status')
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleResolveSuccess = () => {
    setShowResolveForm(false)
    fetchReport()
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setCommentSubmitting(true)
    setCommentError('')
    try {
      const res = await api.post(`/api/reports/${id}/comments`, { text: commentText })
      setReport(prev => ({
        ...prev,
        comments: [...(prev.comments || []), res.data.comment],
      }))
      setCommentText('')
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Failed to add comment')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const mapsDirectionsUrl = report
    ? `https://www.openstreetmap.org/directions?from=&to=${report.location.lat}%2C${report.location.lng}#map=17/${report.location.lat}/${report.location.lng}`
    : '#'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-800 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-xl mx-auto">
          <p className="text-red-600 bg-red-50 border border-red-200 p-3 rounded">{error || 'Ticket not found'}</p>
          <button onClick={() => navigate('/staff')} className="mt-3 text-sm text-gray-600 hover:underline">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => navigate('/staff')}
          className="text-gray-400 hover:text-white transition text-lg leading-none"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">{report.category?.name}</p>
          <h1 className="text-base font-semibold truncate">{report.ticketId}</h1>
        </div>
        <StatusBadge status={report.status} size="sm" />
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-4">

        {/* Before photo */}
        {report.photoUrl && (
          <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500 font-medium px-4 pt-3 pb-1 uppercase tracking-wide">Before Photo</p>
            <img src={report.photoUrl} alt="Before" className="w-full object-cover max-h-64" />
          </div>
        )}

        {/* Description */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Description</p>
          <p className="text-sm text-gray-800">{report.description}</p>
        </div>

        {/* Location + Directions */}
        <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Location</p>
            <a
              href={mapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1"
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
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              <Marker position={[report.location.lat, report.location.lng]} />
            </MapContainer>
          </div>
          <p className="text-xs text-gray-400 px-4 py-2">
            {report.location.lat.toFixed(6)}, {report.location.lng.toFixed(6)}
          </p>
        </div>

        {/* Meta: priority, reports, age */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Priority', value: report.priorityScore || 0 },
            { label: 'Reports', value: report.reportCount },
            { label: 'Upvotes', value: report.upvotes?.length || 0 },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-xl p-3 text-center border border-gray-100 shadow-sm">
              <p className="text-lg font-bold text-gray-800">{m.value}</p>
              <p className="text-xs text-gray-500">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Resolution proof (if resolved) */}
        {report.status === 'resolved' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Resolution</p>
            {report.resolutionPhotoUrl && (
              <img
                src={report.resolutionPhotoUrl}
                alt="After"
                className="w-full rounded-lg object-cover max-h-64"
              />
            )}
            {report.resolutionNote && (
              <p className="text-sm text-green-900">{report.resolutionNote}</p>
            )}
          </div>
        )}

        {/* ── Action buttons ── */}
        {actionError && (
          <p className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">{actionError}</p>
        )}

        {/* Acknowledged → Start Work */}
        {report.status === 'acknowledged' && (
          <button
            onClick={handleStartWork}
            disabled={statusUpdating}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:bg-gray-400 active:scale-[0.98]"
          >
            {statusUpdating ? 'Updating...' : '▶ Start Work'}
          </button>
        )}

        {/* In Progress → Mark Resolved (with form) */}
        {report.status === 'in_progress' && !showResolveForm && (
          <button
            onClick={() => setShowResolveForm(true)}
            className="w-full bg-green-700 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-green-800 transition active:scale-[0.98]"
          >
            ✓ Mark as Resolved
          </button>
        )}

        {report.status === 'in_progress' && showResolveForm && (
          <ResolveForm reportId={id} onSuccess={handleResolveSuccess} />
        )}

        {/* Reported → shouldn't happen for staff (reported means unacknowledged/unassigned) */}
        {report.status === 'reported' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm text-yellow-800">
              This ticket is <strong>reported but not yet acknowledged</strong>. Acknowledging it signals you are aware. Use "Start Work" only once you have physically started addressing the issue.
            </p>
            <button
              onClick={handleStartWork}
              disabled={statusUpdating}
              className="mt-3 w-full bg-yellow-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-yellow-700 transition disabled:bg-gray-400"
            >
              {statusUpdating ? 'Updating...' : 'Acknowledge Ticket'}
            </button>
          </div>
        )}

        {/* ── Comments ── */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">
            Comments ({report.comments?.length || 0})
          </h2>

          <div className="space-y-3 mb-4">
            {(!report.comments || report.comments.length === 0) ? (
              <p className="text-xs text-gray-400">No comments yet.</p>
            ) : (
              report.comments.map((comment, idx) => (
                <div key={comment._id || idx} className="flex gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                    comment.authorRole === 'staff' ? 'bg-blue-600' :
                    comment.authorRole === 'admin' ? 'bg-purple-600' : 'bg-gray-500'
                  }`}>
                    {comment.author?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-gray-800">{comment.author?.name || 'Unknown'}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        comment.authorRole === 'staff' ? 'bg-blue-100 text-blue-700' :
                        comment.authorRole === 'admin' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {roleLabel(comment.authorRole)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2.5 py-1.5">
                      {comment.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add comment */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              type="submit"
              disabled={commentSubmitting || !commentText.trim()}
              className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-900 transition disabled:bg-gray-400"
            >
              {commentSubmitting ? '...' : 'Post'}
            </button>
          </form>
          {commentError && <p className="text-red-600 text-xs mt-1">{commentError}</p>}
        </div>
      </main>
    </div>
  )
}

export default StaffTicketDetail
