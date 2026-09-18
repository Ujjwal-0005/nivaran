import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import api from '../../utils/api'

// Fix Leaflet default icon issue with Vite
L.Icon.Default.mergeOptions({
  iconUrl: icon,
  shadowUrl: iconShadow,
})

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng])
    },
  })

  return position === null ? null : (
    <Marker position={position} draggable={true} eventHandlers={{
      dragend(e) {
        setPosition([e.target._latlng.lat, e.target._latlng.lng])
      },
    }} />
  )
}

function ReportIssue() {
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    lat: null,
    lng: null,
    isAnonymous: false,
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

  useEffect(() => {
    fetchCategories()
    getUserLocation()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/categories')
      setCategories(response.data.categories)
    } catch (err) {
      console.error('Failed to fetch categories:', err)
      setError('Failed to load categories. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Keep formData lat/lng in sync with position marker
  useEffect(() => {
    if (position) {
      setFormData(prev => ({
        ...prev,
        lat: position[0],
        lng: position[1],
      }))
    }
  }, [position])

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          setPosition([latitude, longitude])
          setFormData(prev => ({
            ...prev,
            lat: latitude,
            lng: longitude,
          }))
        },
        (err) => {
          console.error('Geolocation error:', err)
          setError('Could not get your location. Please select it on the map.')
        }
      )
    } else {
      setError('Geolocation is not supported by your browser. Please select location on the map.')
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e, forceNew = false) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    if (!formData.category || !formData.description || !formData.lat || !formData.lng) {
      setError('Please fill in all required fields and select a location on the map')
      setSubmitting(false)
      return
    }

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('category', formData.category)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('lat', formData.lat)
      formDataToSend.append('lng', formData.lng)
      formDataToSend.append('isAnonymous', formData.isAnonymous)
      formDataToSend.append('forceNew', forceNew)
      
      if (photo) {
        formDataToSend.append('photo', photo)
      }

      const response = await api.post('/api/reports', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // Check if possible duplicate was found
      if (response.data.possibleDuplicate) {
        setPossibleDuplicate(response.data.existingReport)
        setShowDuplicateConfirm(true)
        setSubmitting(false)
        return
      }

      setSuccess(`Your report has been filed as ${response.data.ticketId}`)
      
      // Redirect to My Reports after 2 seconds
      setTimeout(() => {
        navigate('/citizen/reports')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoinDuplicate = async () => {
    if (!possibleDuplicate) return

    try {
      setSubmitting(true)
      await api.post(`/api/reports/${possibleDuplicate.id}/join`)
      setSuccess('Your report has been added to the existing issue')
      setShowDuplicateConfirm(false)
      
      setTimeout(() => {
        navigate('/citizen/reports')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join report')
    } finally {
      setSubmitting(false)
    }
  }

  const handleForceNew = () => {
    setShowDuplicateConfirm(false)
    setPossibleDuplicate(null)
    handleSubmit(new Event('submit'), true)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Report an Issue</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 mb-2">Category *</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name} ({cat.department?.name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the issue in detail..."
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Photo</label>
            <input
              type="file"
              onChange={handlePhotoChange}
              accept="image/*"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {photoPreview && (
              <div className="mt-2">
                <img src={photoPreview} alt="Preview" className="h-48 w-auto rounded" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Location *</label>
            <p className="text-sm text-gray-600 mb-2">
              Click on the map to set the location, or drag the marker to adjust it.
            </p>
            <div className="h-96 rounded-lg overflow-hidden border border-gray-300">
              <MapContainer
                center={position || [28.6139, 77.2090]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <LocationMarker position={position} setPosition={setPosition} />
              </MapContainer>
            </div>
            {position && (
              <p className="text-sm text-gray-600 mt-2">
                Selected: {position[0].toFixed(6)}, {position[1].toFixed(6)}
              </p>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isAnonymous"
              checked={formData.isAnonymous}
              onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="isAnonymous" className="text-gray-700">
              Report anonymously — your name won't be shown publicly, but your account stays linked for accountability
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>

        {showDuplicateConfirm && possibleDuplicate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Possible Duplicate Found</h2>
              <p className="text-gray-600 mb-4">
                A similar issue was reported nearby recently. Is this the same issue?
              </p>
              
              <div className="bg-gray-50 rounded p-4 mb-4">
                <p className="font-semibold text-gray-800">{possibleDuplicate.ticketId}</p>
                <p className="text-sm text-gray-600">{possibleDuplicate.category}</p>
                <p className="text-sm text-gray-600 mt-2">{possibleDuplicate.description}</p>
                {possibleDuplicate.photoUrl && (
                  <img src={possibleDuplicate.photoUrl} alt="Existing report" className="mt-2 h-32 w-auto rounded" />
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Reported {new Date(possibleDuplicate.createdAt).toLocaleDateString()} • {possibleDuplicate.reportCount} report(s)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleJoinDuplicate}
                  disabled={submitting}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
                >
                  {submitting ? 'Joining...' : 'Yes, same issue'}
                </button>
                <button
                  onClick={handleForceNew}
                  disabled={submitting}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition disabled:bg-gray-400"
                >
                  {submitting ? 'Creating...' : 'No, different issue'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportIssue
