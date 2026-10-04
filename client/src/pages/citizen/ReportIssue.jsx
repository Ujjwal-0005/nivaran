import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'
import CitizenNavbar from '../../components/CitizenNavbar'

// Fix Leaflet default icon issue with Vite
L.Icon.Default.mergeOptions({ iconUrl: icon, shadowUrl: iconShadow })

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) { setPosition([e.latlng.lat, e.latlng.lng]) },
  })
  return position === null ? null : (
    <Marker position={position} draggable eventHandlers={{
      dragend(e) { setPosition([e.target._latlng.lat, e.target._latlng.lng]) },
    }} />
  )
}

function ReportIssue() {
  const [formData, setFormData] = useState({
    category: '', description: '', lat: null, lng: null, isAnonymous: false,
  })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [position, setPosition] = useState(null)
  const [possibleDuplicate, setPossibleDuplicate] = useState(null)
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchCategories(); getUserLocation() }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/categories')
      setCategories(response.data.categories)
    } catch { setError('Failed to load categories.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (position) setFormData(prev => ({ ...prev, lat: position[0], lng: position[1] }))
  }, [position])

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setPosition([latitude, longitude])
          setFormData(prev => ({ ...prev, lat: latitude, lng: longitude }))
        },
        () => setError('Could not get your location. Please select it on the map.')
      )
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) { setPhoto(file); setPhotoPreview(URL.createObjectURL(file)) }
  }

  const handleSubmit = async (e, forceNew = false) => {
    e.preventDefault()
    setError(''); setSuccess(''); setSubmitting(true)
    if (!formData.category || !formData.description || !formData.lat || !formData.lng) {
      setError('Please fill all required fields and select a location on the map.')
      setSubmitting(false); return
    }
    try {
      const fd = new FormData()
      fd.append('category', formData.category)
      fd.append('description', formData.description)
      fd.append('lat', formData.lat)
      fd.append('lng', formData.lng)
      fd.append('isAnonymous', formData.isAnonymous)
      fd.append('forceNew', forceNew)
      if (photo) fd.append('photo', photo)
      const response = await api.post('/api/reports', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      if (response.data.possibleDuplicate) {
        setPossibleDuplicate(response.data.existingReport)
        setShowDuplicateConfirm(true)
        setSubmitting(false); return
      }
      setSuccess(`Your report has been filed as ${response.data.ticketId}`)
      setTimeout(() => navigate('/citizen/reports'), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit report')
    } finally { setSubmitting(false) }
  }

  const handleJoinDuplicate = async () => {
    if (!possibleDuplicate) return
    try {
      setSubmitting(true)
      await api.post(`/api/reports/${possibleDuplicate.id}/join`)
      setSuccess('Your report has been added to the existing issue.')
      setShowDuplicateConfirm(false)
      setTimeout(() => navigate('/citizen/reports'), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join report')
    } finally { setSubmitting(false) }
  }

  const handleForceNew = () => {
    setShowDuplicateConfirm(false)
    setPossibleDuplicate(null)
    handleSubmit(new Event('submit'), true)
  }

  if (loading) {
    return (
      <div className="page-shell">
        <CitizenNavbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-sovereign-indigo border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <CitizenNavbar />

      <main className="page-content max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="section-header mb-0">
          <div>
            <h1 className="font-display text-2xl font-bold text-sovereign-indigo">Report an Issue</h1>
            <p className="text-gray-400 text-xs mt-0.5">शिकायत दर्ज करें — File a civic complaint</p>
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {success && (
          <div className="alert-success flex items-center gap-2">
            <span>✦</span> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Category & Description */}
          <div className="card-nivaran p-5 space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Issue Details</p>

            <div>
              <label htmlFor="category" className="label-nivaran">Category *</label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                className="input-nivaran"
              >
                <option value="">Select a category…</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name} — {cat.department?.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="description" className="label-nivaran">Description *</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={4}
                className="input-nivaran resize-none"
                placeholder="Describe the issue clearly — what, where, and how long it's been there…"
              />
            </div>
          </div>

          {/* Photo upload */}
          <div className="card-nivaran p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Photo Evidence</p>
            <label
              htmlFor="photo"
              className="flex flex-col items-center justify-center border-2 border-dashed border-earthen-slate rounded cursor-pointer hover:border-kesariya hover:bg-parchment/50 transition-all p-6 text-center"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-40 w-auto rounded object-cover" />
              ) : (
                <>
                  <span className="text-3xl mb-2">📷</span>
                  <p className="text-sm font-medium text-gray-600">Click to upload a photo</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP up to 5MB</p>
                </>
              )}
              <input
                id="photo"
                type="file"
                onChange={handlePhotoChange}
                accept="image/*"
                className="sr-only"
              />
            </label>
            {photoPreview && (
              <button
                type="button"
                onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                className="mt-2 text-xs text-terracotta-alert hover:underline"
              >
                Remove photo
              </button>
            )}
          </div>

          {/* Location picker */}
          <div className="card-nivaran p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Location *</p>
            <p className="text-xs text-gray-400 mb-3">
              Click on the map to pin the issue location, or drag the marker to adjust.
            </p>
            <div className="h-72 rounded overflow-hidden border border-earthen-slate">
              <MapContainer
                center={position || [28.6139, 77.2090]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='© OpenStreetMap'
                />
                <LocationMarker position={position} setPosition={setPosition} />
              </MapContainer>
            </div>
            {position ? (
              <p className="text-xs text-jan-kalyan-green font-semibold mt-2">
                ✓ Location set: {position[0].toFixed(5)}, {position[1].toFixed(5)}
              </p>
            ) : (
              <p className="text-xs text-amber-600 mt-2">⚠ No location selected yet</p>
            )}
          </div>

          {/* Anonymous option */}
          <div className="card-nivaran px-5 py-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="isAnonymous"
                checked={formData.isAnonymous}
                onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                className="mt-0.5 accent-kesariya"
              />
              <div>
                <p className="text-sm font-medium text-gray-700">Report anonymously</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Your name won't be shown publicly, but your account stays linked for accountability.
                </p>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-kesariya w-full py-3 text-sm"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting…
              </span>
            ) : 'Submit Report →'}
          </button>
        </form>
      </main>

      {/* ── Duplicate confirmation modal ─────────────── */}
      {showDuplicateConfirm && possibleDuplicate && (
        <div className="fixed inset-0 bg-sovereign-indigo/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
            {/* Modal header */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h2 className="font-display font-bold text-gray-900">Possible Duplicate Found</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  A similar issue was already reported nearby. Is this the same problem?
                </p>
              </div>
            </div>

            {/* Existing report preview */}
            <div className="p-5">
              <div className="bg-parchment rounded border border-earthen-slate p-4 mb-4">
                <p className="font-mono text-xs font-bold text-gray-500 mb-1">{possibleDuplicate.ticketId}</p>
                <p className="font-semibold text-sovereign-indigo text-sm mb-1">{possibleDuplicate.category}</p>
                <p className="text-xs text-gray-500 line-clamp-3 mb-3">{possibleDuplicate.description}</p>
                {possibleDuplicate.photoUrl && (
                  <img
                    src={possibleDuplicate.photoUrl}
                    alt="Existing report"
                    className="h-28 w-auto rounded border border-earthen-slate object-cover"
                  />
                )}
                <p className="text-[10px] text-gray-400 mt-2">
                  Filed {new Date(possibleDuplicate.createdAt).toLocaleDateString('en-IN')} ·{' '}
                  {possibleDuplicate.reportCount} report(s)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleJoinDuplicate}
                  disabled={submitting}
                  className="btn-primary py-2.5 text-sm"
                >
                  {submitting ? 'Joining…' : '✓ Yes, same issue'}
                </button>
                <button
                  onClick={handleForceNew}
                  disabled={submitting}
                  className="btn-ghost py-2.5 text-sm"
                >
                  {submitting ? 'Creating…' : 'No, different issue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportIssue
