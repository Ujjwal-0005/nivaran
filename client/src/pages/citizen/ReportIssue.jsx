import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'
import CitizenNavbar from '../../components/CitizenNavbar'
import { useAuth } from '../../context/AuthContext'

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
  const { user } = useAuth()
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

  // Initial map center resolution:
  // 1. User's GPS (if allowed)
  // 2. User's municipality centroid and defaultZoom
  // 3. India's center [20.5937, 78.9629]
  const muniCentroid = user?.municipality?.centroid
  const fallbackCenter = muniCentroid
    ? [muniCentroid.lat, muniCentroid.lng]
    : [20.5937, 78.9629]
  const fallbackZoom = user?.municipality?.defaultZoom || 13

  const [pinCity, setPinCity] = useState(null)
  const [detectingCity, setDetectingCity] = useState(false)

  useEffect(() => {
    getUserLocation()
  }, [])

  useEffect(() => {
    if (position) {
      setFormData(prev => ({ ...prev, lat: position[0], lng: position[1] }))
      fetchCityAndCategories(position[0], position[1])
    } else {
      fetchCityAndCategories()
    }
  }, [position])

  const fetchCityAndCategories = async (lat, lng) => {
    try {
      const params = (lat !== undefined && lng !== undefined) ? { lat, lng } : {}
      const catRes = await api.get('/api/categories', { params })
      setCategories(catRes.data.categories)

      if (lat !== undefined && lng !== undefined) {
        setDetectingCity(true)
        try {
          const res = await api.get('/api/municipalities/resolve', { params: { lat, lng } })
          setPinCity(res.data.municipality)
        } catch (resErr) {
          if (resErr.response?.status === 403) {
            setPinCity({
              name: resErr.response.data.name,
              state: resErr.response.data.state,
              isLive: false,
              message: resErr.response.data.message,
            })
          } else if (resErr.response?.status === 400) {
            setPinCity({
              outOfRange: true,
              message: resErr.response.data.message || 'Location is outside supported municipal boundaries',
            })
          } else {
            setPinCity(null)
          }
        }
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setDetectingCity(false)
    }
  }

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setPosition([latitude, longitude])
          setFormData(prev => ({ ...prev, lat: latitude, lng: longitude }))
        },
        () => {
          // If GPS denied/failed, center on user's municipality centroid
          if (muniCentroid) {
            setPosition([muniCentroid.lat, muniCentroid.lng])
            setFormData(prev => ({ ...prev, lat: muniCentroid.lat, lng: muniCentroid.lng }))
          }
        }
      )
    } else if (muniCentroid) {
      setPosition([muniCentroid.lat, muniCentroid.lng])
      setFormData(prev => ({ ...prev, lat: muniCentroid.lat, lng: muniCentroid.lng }))
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

  const handleJoinExisting = async () => {
    if (!possibleDuplicate) return
    try {
      setSubmitting(true)
      await api.post(`/api/reports/${possibleDuplicate.id}/join`, {
        lat: formData.lat,
        lng: formData.lng,
      })
      setSuccess(`You have joined ticket ${possibleDuplicate.ticketId}. Report count updated.`)
      setShowDuplicateConfirm(false)
      setTimeout(() => navigate('/citizen/reports'), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join report')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-sandstone">
      <CitizenNavbar />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-sovereign-indigo">
            Report an Issue
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Pin the location, attach a photo, and our local team will address it.
          </p>
        </div>

        {error && (
          <div className="alert-error mb-5 flex items-start gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert-success mb-5 flex items-start gap-2">
            <span>✓</span>
            <span>{success}</span>
          </div>
        )}

        {showDuplicateConfirm && possibleDuplicate && (
          <div className="card-nivaran p-5 mb-5 border-2 border-kesariya bg-parchment">
            <h3 className="font-display font-bold text-sovereign-indigo text-base mb-2">
              Similar Issue Already Reported Nearby
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              A report matching this category was recently filed nearby ({possibleDuplicate.ticketId}).
              Joining an existing ticket increases its priority and gets it fixed faster.
            </p>
            <div className="bg-white rounded p-3 text-xs space-y-1 mb-4 border border-earthen-slate">
              <p><span className="font-semibold">Ticket:</span> {possibleDuplicate.ticketId}</p>
              <p><span className="font-semibold">Category:</span> {possibleDuplicate.category}</p>
              <p><span className="font-semibold">Description:</span> {possibleDuplicate.description}</p>
              <p><span className="font-semibold">Status:</span> {possibleDuplicate.status}</p>
              <p><span className="font-semibold">Citizens who reported:</span> {possibleDuplicate.reportCount}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleJoinExisting}
                disabled={submitting}
                className="btn-primary flex-1 py-2 text-sm"
              >
                Join This Ticket (+1 Report)
              </button>
              <button
                type="button"
                onClick={(e) => { setShowDuplicateConfirm(false); handleSubmit(e, true) }}
                disabled={submitting}
                className="btn-secondary flex-1 py-2 text-sm"
              >
                File as New Issue Anyway
              </button>
            </div>
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
                    {cat.name} ({cat.slaHours}h SLA)
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
                center={position || fallbackCenter}
                zoom={fallbackZoom}
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
              <div className="mt-2 space-y-1">
                <p className="text-xs text-jan-kalyan-green font-semibold">
                  ✓ Location set: {position[0].toFixed(5)}, {position[1].toFixed(5)}
                </p>
                {pinCity && pinCity.outOfRange ? (
                  <div className="text-xs px-2.5 py-1.5 rounded flex items-center justify-between bg-red-50 text-red-800 border border-red-200">
                    <span>⚠️ {pinCity.message}</span>
                    <span className="font-semibold text-[11px] uppercase tracking-wider">Out of Range</span>
                  </div>
                ) : pinCity && pinCity.isLive === false ? (
                  <div className="text-xs px-2.5 py-1.5 rounded flex items-center justify-between bg-amber-50 text-amber-800 border border-amber-200">
                    <span>⚠️ <strong>{pinCity.name}, {pinCity.state}</strong> is not live on Nivaran yet.</span>
                    <span className="font-semibold text-[11px] uppercase tracking-wider">Not Live</span>
                  </div>
                ) : pinCity ? (
                  <div className="text-xs px-2.5 py-1.5 rounded flex items-center justify-between bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span>
                      📍 Assigned to: <strong>{pinCity.name}, {pinCity.state}</strong>
                      {pinCity.name !== user?.municipality?.name && ' (travelling)'}
                    </span>
                    <span className="font-semibold text-[11px] uppercase tracking-wider">
                      Live City ✓
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-amber-600 mt-2">⚠ No location selected yet</p>
            )}
          </div>

          {/* Anonymous checkbox */}
          <div className="card-nivaran p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-sovereign-indigo">Report Anonymously</p>
              <p className="text-xs text-gray-500">
                Your name will not be shown to other citizens or staff
              </p>
            </div>
            <input
              type="checkbox"
              id="isAnonymous"
              checked={formData.isAnonymous}
              onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
              className="w-4 h-4 text-kesariya border-gray-300 rounded focus:ring-kesariya"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="btn-primary w-full py-3.5 text-base"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting Report…
              </span>
            ) : 'Submit Report →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ReportIssue
