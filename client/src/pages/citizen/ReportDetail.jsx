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
import { useSocket } from '../../context/SocketContext'

// Fix Leaflet default icon issue with Vite
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  shadowUrl: iconShadow,
})

// --- Star Rating Picker ---
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
          <span className={(hover || value) >= star ? 'text-yellow-400' : 'text-gray-300'}>★</span>
        </button>
      ))}
    </div>
  )
}

// --- Role label helper ---
function roleLabel(role) {
  return role === 'staff' ? 'Staff' : role === 'admin' ? 'Admin' : 'Citizen'
}

function ReportDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Comment state
  const [commentText, setCommentText] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')

  // Rating state
  const [ratingScore, setRatingScore] = useState(0)
  const [ratingFeedback, setRatingFeedback] = useState('')
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState('')
  const [ratingSuccess, setRatingSuccess] = useState('')

  // Dispute state
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeSubmitting, setDisputeSubmitting] = useState(false)
  const [disputeError, setDisputeError] = useState('')

  useEffect(() => {
    fetchReport()
  }, [id])

  // Phase 8: Listen for live updates to this report
  useEffect(() => {
    if (!socket) return

    const handleStatusUpdate = (data) => {
      if (data.reportId === id) {
        setReport((prev) =>
          prev
            ? {
                ...prev,
                status: data.status,
                resolutionNote: data.resolutionNote || prev.resolutionNote,
                resolutionPhotoUrl: data.resolutionPhotoUrl || prev.resolutionPhotoUrl,
              }
            : prev
        )
      }
    }

    const handleNewComment = (data) => {
      if (data.reportId === id && data.comment) {
        setReport((prev) => {
          if (!prev) return prev
          // Avoid duplicate comments
          const exists = prev.comments?.some((c) => c._id === data.comment._id)
          if (exists) return prev
          return {
            ...prev,
            comments: [...(prev.comments || []), data.comment],
          }
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
    } catch (err) {
      setError('Failed to fetch report details')
    } finally {
      setLoading(false)
    }
  }

  const handleUpvote = async () => {
    try {
      await api.post(`/api/reports/${id}/upvote`)
      fetchReport()
    } catch (err) {
      console.error('Failed to upvote:', err)
    }
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setCommentSubmitting(true)
    setCommentError('')
    try {
      const response = await api.post(`/api/reports/${id}/comments`, { text: commentText })
      setReport(prev => ({
        ...prev,
        comments: [...(prev.comments || []), response.data.comment],
      }))
      setCommentText('')
    } catch (err) {
      setCommentError(err.response?.data?.message || 'Failed to add comment')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleRating = async (e) => {
    e.preventDefault()
    if (!ratingScore) {
      setRatingError('Please select a star rating')
      return
    }
    setRatingSubmitting(true)
    setRatingError('')
    try {
      await api.post(`/api/reports/${id}/rate`, { score: ratingScore, feedback: ratingFeedback })
      setRatingSuccess('Thank you for your feedback!')
      setReport(prev => ({
        ...prev,
        rating: { score: ratingScore, feedback: ratingFeedback },
      }))
    } catch (err) {
      setRatingError(err.response?.data?.message || 'Failed to submit rating')
    } finally {
      setRatingSubmitting(false)
    }
  }

  const handleDispute = async (e) => {
    e.preventDefault()
    if (!disputeReason.trim()) {
      setDisputeError('Please provide a reason for disputing')
      return
    }
    setDisputeSubmitting(true)
    setDisputeError('')
    try {
      await api.post(`/api/reports/${id}/dispute`, { reason: disputeReason })
      setReport(prev => ({
        ...prev,
        status: 'disputed',
        isDisputed: true,
        disputeReason,
      }))
      setShowDisputeForm(false)
    } catch (err) {
      setDisputeError(err.response?.data?.message || 'Failed to submit dispute')
    } finally {
      setDisputeSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Loading report...</p>
        </div>
      </div>
    )
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

  const isOwner = user && report.citizen && (
    report.citizen._id === user.id || report.citizen === user.id
  )
  const isResolved = report.status === 'resolved'
  const isDisputed = report.status === 'disputed'
  const alreadyRated = report.rating && report.rating.score

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <button
          onClick={() => navigate('/citizen/reports')}
          className="text-blue-600 hover:underline flex items-center gap-1"
        >
          ← Back to My Reports
        </button>

        {/* Header card */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{report.ticketId}</h1>
              <p className="text-gray-600 mt-1">{report.category?.name}</p>
              <p className="text-sm text-gray-400">{report.department?.name}</p>
            </div>
            <StatusBadge status={report.status} size="lg" />
          </div>

          {/* Photo */}
          {report.photoUrl && (
            <div className="mb-6">
              <img
                src={report.photoUrl}
                alt="Report"
                className="w-full max-w-md rounded-lg shadow-sm"
              />
            </div>
          )}

          {/* Resolution photo (if present) */}
          {report.resolutionPhotoUrl && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Resolution Photo</p>
              <img
                src={report.resolutionPhotoUrl}
                alt="Resolution"
                className="w-full max-w-md rounded-lg shadow-sm"
              />
            </div>
          )}

          {/* Description */}
          <div className="mb-6">
            <h2 className="font-semibold text-gray-800 mb-2">Description</h2>
            <p className="text-gray-600">{report.description}</p>
          </div>

          {/* Location map */}
          <div className="mb-6">
            <h2 className="font-semibold text-gray-800 mb-2">Location</h2>
            <div className="h-56 rounded-lg overflow-hidden border border-gray-200">
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
            <p className="text-sm text-gray-400 mt-1">
              {report.location.lat.toFixed(6)}, {report.location.lng.toFixed(6)}
            </p>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t pt-4">
            <div>
              <p className="text-gray-400">Submitted</p>
              <p className="text-gray-700">{new Date(report.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-400">Report Count</p>
              <p className="text-gray-700">{report.reportCount}</p>
            </div>
            <div>
              <p className="text-gray-400">Priority Score</p>
              <p className="text-gray-700">{report.priorityScore}</p>
            </div>
            <div>
              <p className="text-gray-400">Upvotes</p>
              <p className="text-gray-700">{report.upvotes?.length || 0}</p>
            </div>
          </div>

          {/* Upvote button */}
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={handleUpvote}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
            >
              <span>👍</span>
              <span>Upvote ({report.upvotes?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* Existing rating display (if already rated) */}
        {alreadyRated && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold text-gray-800 mb-3">Your Rating</h2>
            <div className="flex items-center gap-2">
              {[1,2,3,4,5].map(s => (
                <span key={s} className={`text-2xl ${s <= report.rating.score ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
              ))}
              <span className="text-gray-500 text-sm ml-1">({report.rating.score}/5)</span>
            </div>
            {report.rating.feedback && (
              <p className="text-gray-600 mt-2 text-sm">{report.rating.feedback}</p>
            )}
          </div>
        )}

        {/* Resolved actions: rate or dispute */}
        {isOwner && isResolved && !alreadyRated && !isDisputed && (
          <div className="bg-white rounded-xl shadow p-6 space-y-6">
            {/* Rating form */}
            <div>
              <h2 className="font-semibold text-gray-800 mb-1">Rate the Resolution</h2>
              <p className="text-sm text-gray-500 mb-3">How satisfied are you with how this issue was handled?</p>
              <form onSubmit={handleRating} className="space-y-3">
                <StarPicker value={ratingScore} onChange={setRatingScore} />
                <textarea
                  value={ratingFeedback}
                  onChange={e => setRatingFeedback(e.target.value)}
                  placeholder="Optional feedback..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {ratingError && <p className="text-red-600 text-sm">{ratingError}</p>}
                {ratingSuccess && <p className="text-green-600 text-sm">{ratingSuccess}</p>}
                <button
                  type="submit"
                  disabled={ratingSubmitting}
                  className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 text-sm"
                >
                  {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
                </button>
              </form>
            </div>

            {/* Divider */}
            <hr />

            {/* Dispute section */}
            <div>
              <h2 className="font-semibold text-gray-800 mb-1">Not Satisfied?</h2>
              <p className="text-sm text-gray-500 mb-3">
                If the issue has not actually been resolved, you can dispute this resolution. It will be sent to the municipal admin for review.
              </p>
              {!showDisputeForm ? (
                <button
                  onClick={() => setShowDisputeForm(true)}
                  className="text-orange-600 hover:underline text-sm font-medium"
                >
                  Dispute this resolution →
                </button>
              ) : (
                <form onSubmit={handleDispute} className="space-y-3">
                  <textarea
                    value={disputeReason}
                    onChange={e => setDisputeReason(e.target.value)}
                    placeholder="Explain why you're disputing this resolution..."
                    rows={3}
                    required
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  {disputeError && <p className="text-red-600 text-sm">{disputeError}</p>}
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={disputeSubmitting}
                      className="bg-orange-600 text-white px-5 py-2 rounded-lg hover:bg-orange-700 transition disabled:bg-gray-400 text-sm"
                    >
                      {disputeSubmitting ? 'Submitting...' : 'Submit Dispute'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDisputeForm(false); setDisputeError('') }}
                      className="text-gray-500 hover:underline text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Disputed state banner */}
        {isDisputed && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-orange-500 text-lg">⚠️</span>
              <h2 className="font-semibold text-orange-800">Under Review by Municipal Admin</h2>
            </div>
            <p className="text-orange-700 text-sm">
              You disputed this resolution. The admin team will review the case and take appropriate action.
            </p>
            {report.disputeReason && (
              <div className="mt-3 bg-white border border-orange-200 rounded p-3">
                <p className="text-xs text-gray-500 mb-1">Your reason:</p>
                <p className="text-sm text-gray-700">{report.disputeReason}</p>
              </div>
            )}
          </div>
        )}

        {/* Comments section */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            Comments ({report.comments?.length || 0})
          </h2>

          {/* Existing comments */}
          <div className="space-y-4 mb-6">
            {(!report.comments || report.comments.length === 0) ? (
              <p className="text-sm text-gray-400">No comments yet. Be the first to comment.</p>
            ) : (
              report.comments.map((comment, idx) => (
                <div key={comment._id || idx} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                    {comment.author?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-800">
                        {comment.author?.name || 'Unknown'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        comment.authorRole === 'staff'
                          ? 'bg-blue-100 text-blue-700'
                          : comment.authorRole === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {roleLabel(comment.authorRole)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                      {comment.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add comment form */}
          <form onSubmit={handleAddComment} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={commentSubmitting || !commentText.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 text-sm whitespace-nowrap"
              >
                {commentSubmitting ? '...' : 'Post'}
              </button>
            </div>
          </form>
          {commentError && <p className="text-red-600 text-sm mt-2">{commentError}</p>}
        </div>
      </div>
    </div>
  )
}

export default ReportDetail
