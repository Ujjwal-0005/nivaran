import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'
import StatusBadge from '../../components/StatusBadge'
import CitizenNavbar from '../../components/CitizenNavbar'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { getDeptColor } from '../../utils/deptColors'

L.Icon.Default.mergeOptions({ iconUrl: icon, shadowUrl: iconShadow })

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl transition-transform hover:scale-110 focus:outline-none"
        >
          <span className={(hover || value) >= star ? 'text-amber-400' : 'text-gray-200'}>★</span>
        </button>
      ))}
    </div>
  )
}

function roleLabel(role) {
  return role === 'staff' ? 'Staff' : role === 'admin' ? 'Admin' : 'Citizen'
}

function roleBadgeClass(role) {
  if (role === 'staff') return 'bg-blue-50 text-blue-700 border border-blue-200'
  if (role === 'admin') return 'bg-violet-50 text-violet-700 border border-violet-200'
  return 'bg-gray-50 text-gray-600 border border-earthen-slate'
}

function ReportDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')

  const [ratingScore, setRatingScore] = useState(0)
  const [ratingFeedback, setRatingFeedback] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState('')
  const [ratingSuccess, setRatingSuccess] = useState('')

  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [disputeError, setDisputeError] = useState('')

  useEffect(() => { fetchReport() }, [id])

  useEffect(() => {
    if (!socket) return
    const handleStatusUpdate = (data) => {
      if (data.reportId === id) {
        setReport((prev) => prev ? {
          ...prev,
          status: data.status,
          resolutionNote: data.resolutionNote || prev.resolutionNote,
          resolutionPhotoUrl: data.resolutionPhotoUrl || prev.resolutionPhotoUrl,
        } : prev)
      }
    }
    const handleNewComment = (data) => {
      if (data.reportId === id && data.comment) {
        setReport((prev) => {
          if (!prev) return prev
          const exists = prev.comments?.some((c) => c._id === data.comment._id)
          if (exists) return prev
          return { ...prev, comments: [...(prev.comments || []), data.comment] }
        })
      }
    }
    socket.on('status_update', handleStatusUpdate)
    socket.on('new_comment', handleNewComment)
    return () => {
      socket.off('status_update', handleStatusUpdate)
      socket.off('new_comment', handleNewComment)
    }
  }, [socket, id])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/reports/${id}`)
      setReport(response.data.report)
    } catch { setError('Failed to fetch report details') }
    finally { setLoading(false) }
  }

  const handleUpvote = async () => {
    try {
      await api.post(`/api/reports/${id}/upvote`)
      fetchReport()
    } catch { /* ignore */ }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setCommentSubmitting(true); setCommentError('')
    try {
      const response = await api.post(`/api/reports/${id}/comments`, { text: commentText })
      setReport(prev => ({ ...prev, comments: [...(prev.comments || []), response.data.comment] }))
      setCommentText('')
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Failed to add comment')
    } finally { setCommentSubmitting(false) }
  }

  const handleRating = async (e) => {
    e.preventDefault()
    if (!ratingScore) { setRatingError('Please select a star rating'); return }
    setRatingSubmitting(true); setRatingError('')
    try {
      await api.post(`/api/reports/${id}/rate`, { score: ratingScore, feedback: ratingFeedback })
      setRatingSuccess('Thank you for your feedback!')
      setReport(prev => ({ ...prev, rating: { score: ratingScore, feedback: ratingFeedback } }))
    } catch (err) {
      setRatingError(err.response?.data?.message || 'Failed to submit rating')
    } finally { setRatingSubmitting(false) }
  }

  const handleDispute = async (e) => {
    e.preventDefault()
    if (!disputeReason.trim()) { setDisputeError('Please provide a reason'); return }
    setDisputeSubmitting(true); setDisputeError('')
    try {
      await api.post(`/api/reports/${id}/dispute`, { reason: disputeReason })
      setReport(prev => ({ ...prev, status: 'disputed', isDisputed: true, disputeReason }))
      setShowDisputeForm(false)
    } catch (err) {
      setDisputeError(err.response?.data?.message || 'Failed to submit dispute')
    } finally { setDisputeSubmitting(false) }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <CitizenNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-sovereign-indigo border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading report…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="page-shell">
        <CitizenNavbar />
        <div className="page-content">
          <div className="alert-error">{error || 'Report not found'}</div>
          <button onClick={() => navigate('/citizen/reports')} className="btn-primary mt-3">
            ← Back to My Reports
          </button>
        </div>
      </div>
    )
  }

  const isOwner = user && report.citizen && (report.citizen._id === user.id || report.citizen === user.id)
  const isResolved = report.status === 'resolved'
  const isDisputed = report.status === 'disputed'
  const alreadyRated = report.rating?.score
  const deptColor = getDeptColor(report.department?.name || report.category?.department?.name)

  return (
    <div className="page-shell">
      <CitizenNavbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Back nav */}
        <button
          onClick={() => navigate('/citizen/reports')}
          className="text-sm text-gray-500 hover:text-kesariya transition flex items-center gap-1"
        >
          ← My Reports
        </button>

        {/* Header card */}
        <div className="card-nivaran overflow-hidden" style={{ borderTopColor: deptColor.dot, borderTopWidth: '3px' }}>
          <div className="p-6">
            {/* Title row */}
            <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
              <div>
                <p className="font-mono text-xs font-bold text-gray-400 mb-0.5">{report.ticketId}</p>
                <h1 className="font-display text-xl font-bold text-sovereign-indigo">
                  {report.category?.name || 'Issue'}
                </h1>
                {(report.department?.name || report.category?.department?.name) && (
                  <p className="text-xs font-semibold mt-0.5" style={{ color: deptColor.text }}>
                    {report.department?.name || report.category?.department?.name}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={report.status} size="lg" />
                {report.isEscalated && (
                  <span className="badge-escalated">🚨 Escalated</span>
                )}
              </div>
            </div>

            {/* Resolved stamp */}
            {isResolved && (
              <div className="mb-4">
                <span className="stamp-resolved">✦ निवारण · Issue Resolved</span>
              </div>
            )}

            {/* Photo */}
            {report.photoUrl && (
              <div className="mb-5">
                <img
                  src={report.photoUrl}
                  alt="Report"
                  className="w-full rounded border border-earthen-slate object-cover max-h-72"
                />
              </div>
            )}

            {/* Resolution photo */}
            {report.resolutionPhotoUrl && (
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-jan-kalyan-green mb-2">✦ Resolution Proof</p>
                <img
                  src={report.resolutionPhotoUrl}
                  alt="Resolution"
                  className="w-full rounded border border-jan-kalyan-green/20 object-cover max-h-64"
                />
              </div>
            )}

            {/* Resolution note */}
            {report.resolutionNote && (
              <div className="bg-jan-kalyan-green/5 border border-jan-kalyan-green/20 rounded p-3 mb-5">
                <p className="text-xs font-bold text-jan-kalyan-green mb-1">Staff Note</p>
                <p className="text-sm text-gray-700">{report.resolutionNote}</p>
              </div>
            )}

            {/* Description */}
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Description</p>
              <p className="text-gray-700 text-sm leading-relaxed">{report.description}</p>
            </div>

            {/* Location map */}
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Location</p>
              <div className="h-48 rounded overflow-hidden border border-earthen-slate">
                <MapContainer
                  center={[report.location.lat, report.location.lng]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[report.location.lat, report.location.lng]} />
                </MapContainer>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {report.location.lat.toFixed(6)}, {report.location.lng.toFixed(6)}
              </p>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-earthen-slate text-center">
              {[
                { label: 'Filed', value: new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) },
                { label: 'Reports', value: report.reportCount },
                { label: 'Priority', value: report.priorityScore },
                { label: 'Upvotes', value: report.upvotes?.length || 0 },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="font-display font-bold text-sovereign-indigo text-sm">{value}</p>
                </div>
              ))}
            </div>

            {/* Upvote */}
            <div className="mt-4 pt-3 border-t border-earthen-slate">
              <button
                onClick={handleUpvote}
                className="flex items-center gap-2 btn-ghost text-sm"
              >
                <span>👍</span>
                <span>Upvote ({report.upvotes?.length || 0})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Existing rating */}
        {alreadyRated && (
          <div className="card-nivaran p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Your Rating</p>
            <div className="flex items-center gap-2">
              {[1,2,3,4,5].map(s => (
                <span key={s} className={`text-2xl ${s <= report.rating.score ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
              ))}
              <span className="text-gray-500 text-sm ml-1">({report.rating.score}/5)</span>
            </div>
            {report.rating.feedback && (
              <p className="text-gray-600 mt-2 text-sm italic">"{report.rating.feedback}"</p>
            )}
          </div>
        )}

        {/* Resolved actions */}
        {isOwner && isResolved && !alreadyRated && !isDisputed && (
          <div className="card-nivaran p-5 space-y-5">
            {/* Rate */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Rate the Resolution</p>
              <p className="text-xs text-gray-500 mb-3">How satisfied are you with how this issue was handled?</p>
              <form onSubmit={handleRating} className="space-y-3">
                <StarPicker value={ratingScore} onChange={setRatingScore} />
                <textarea
                  value={ratingFeedback}
                  onChange={e => setRatingFeedback(e.target.value)}
                  placeholder="Optional feedback…"
                  rows={2}
                  className="input-nivaran resize-none"
                />
                {ratingError && <p className="text-terracotta-alert text-xs">{ratingError}</p>}
                {ratingSuccess && <p className="text-jan-kalyan-green text-xs font-semibold">✦ {ratingSuccess}</p>}
                <button type="submit" disabled={ratingSubmitting} className="btn-primary text-sm py-2">
                  {ratingSubmitting ? 'Submitting…' : 'Submit Rating'}
                </button>
              </form>
            </div>

            <hr className="border-earthen-slate" />

            {/* Dispute */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Not Satisfied?</p>
              <p className="text-xs text-gray-500 mb-3">
                If the issue hasn't actually been resolved, you can dispute this. It will go to the admin for review.
              </p>
              {!showDisputeForm ? (
                <button
                  onClick={() => setShowDisputeForm(true)}
                  className="text-sm font-semibold text-kesariya hover:text-civic-flame transition"
                >
                  Dispute this resolution →
                </button>
              ) : (
                <form onSubmit={handleDispute} className="space-y-3">
                  <textarea
                    value={disputeReason}
                    onChange={e => setDisputeReason(e.target.value)}
                    placeholder="Explain why you're disputing this resolution…"
                    rows={3}
                    required
                    className="input-nivaran resize-none"
                    style={{ borderColor: '#E65100' }}
                  />
                  {disputeError && <p className="text-terracotta-alert text-xs">{disputeError}</p>}
                  <div className="flex gap-3">
                    <button type="submit" disabled={disputeSubmitting} className="btn-kesariya text-sm py-2">
                      {disputeSubmitting ? 'Submitting…' : 'Submit Dispute'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDisputeForm(false); setDisputeError('') }}
                      className="text-sm text-gray-500 hover:text-gray-700 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Disputed banner */}
        {isDisputed && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-500 text-lg">⚠️</span>
              <h2 className="font-display font-bold text-amber-900">Under Review by Municipal Admin</h2>
            </div>
            <p className="text-amber-800 text-sm">
              You disputed this resolution. The admin team will review and take appropriate action.
            </p>
            {report.disputeReason && (
              <div className="mt-3 bg-white border border-amber-200 rounded p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Your reason</p>
                <p className="text-sm text-gray-700">{report.disputeReason}</p>
              </div>
            )}
          </div>
        )}

        {/* Comments */}
        <div className="card-nivaran p-5">
          <div className="section-header mb-4">
            <h2 className="font-display font-bold text-sovereign-indigo">
              Comments ({report.comments?.length || 0})
            </h2>
          </div>

          <div className="space-y-4 mb-5">
            {(!report.comments || report.comments.length === 0) ? (
              <p className="text-xs text-gray-400">No comments yet. Be the first to comment.</p>
            ) : (
              report.comments.map((comment, idx) => (
                <div key={comment._id || idx} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-sovereign-indigo/10 flex items-center justify-center text-sovereign-indigo font-bold text-xs flex-shrink-0">
                    {comment.author?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="font-semibold text-xs text-gray-800">
                        {comment.author?.name || 'Unknown'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${roleBadgeClass(comment.authorRole)}`}>
                        {roleLabel(comment.authorRole)}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(comment.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 bg-parchment rounded px-3 py-2 border border-earthen-slate">
                      {comment.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add comment */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-kesariya flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                className="input-nivaran flex-1"
              />
              <button
                type="submit"
                disabled={commentSubmitting || !commentText.trim()}
                className="btn-primary text-sm px-4 py-2"
              >
                {commentSubmitting ? '…' : 'Post'}
              </button>
            </div>
          </form>
          {commentError && <p className="text-terracotta-alert text-xs mt-2">{commentError}</p>}
        </div>
      </main>
    </div>
  )
}

export default ReportDetail
