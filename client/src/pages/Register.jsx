import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../utils/api'

const STEPS = ['Account Details', 'City & Optional Pin', 'Done']

// Interactive marker component for optional home pin
function PinMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng])
    },
  })

  return position ? (
    <Marker
      position={position}
      draggable={true}
      eventHandlers={{
        dragend(e) {
          const marker = e.target
          const coords = marker.getLatLng()
          setPosition([coords.lat, coords.lng])
        },
      }}
    />
  ) : null
}

function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    municipality: '',
    addressText: '',
  })
  const [homePin, setHomePin] = useState(null)
  const [municipalities, setMunicipalities] = useState([])
  const [selectedMuni, setSelectedMuni] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchMunicipalities = async () => {
      try {
        const res = await api.get('/api/municipalities')
        setMunicipalities(res.data.municipalities || [])
      } catch (err) {
        console.error('Failed to load municipalities:', err)
      }
    }
    fetchMunicipalities()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (name === 'municipality') {
      const muni = municipalities.find((m) => m._id === value)
      setSelectedMuni(muni || null)
      if (muni && muni.centroid) {
        setHomePin([muni.centroid.lat, muni.centroid.lng])
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        municipality: formData.municipality,
        homeAddress: {
          text: formData.addressText || '',
          lat: homePin ? homePin[0] : null,
          lng: homePin ? homePin[1] : null,
        },
      }

      await api.post('/api/auth/register', payload)
      navigate('/verify-otp', { state: { email: formData.email } })
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const mapCenter = selectedMuni?.centroid
    ? [selectedMuni.centroid.lat, selectedMuni.centroid.lng]
    : [20.5937, 78.9629] // India centroid fallback
  const mapZoom = selectedMuni?.defaultZoom || 13

  return (
    <div className="min-h-screen bg-sandstone flex">
      {/* ── Left brand panel ─────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[42%] bg-sovereign-indigo text-white p-12">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded bg-kesariya flex items-center justify-center text-xl">🏛</div>
            <span className="font-display font-bold text-2xl">Nivaran</span>
          </div>
          <h2 className="font-display text-4xl font-bold leading-tight mb-4">
            नागरिक बनें<br />
            <span className="text-white/60 text-2xl font-medium">Become a Citizen</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Create your account and start reporting civic issues in your municipality. It's free, fast, and transparent.
          </p>
        </div>

        {/* Step indicators */}
        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full border-2 border-kesariya/60 flex items-center justify-center text-xs font-bold text-white/80">
                {i + 1}
              </div>
              <span className="text-sm text-white/60">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded bg-sovereign-indigo flex items-center justify-center text-white text-sm">🏛</div>
            <span className="font-display font-bold text-sovereign-indigo text-xl">Nivaran</span>
          </div>

          <h1 className="font-display text-3xl font-bold text-sovereign-indigo mb-1">
            Create Account
          </h1>
          <p className="text-gray-500 text-sm mb-7">
            Register as a citizen to report and track civic issues
          </p>

          {error && (
            <div className="alert-error mb-5 flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account details */}
            <div className="card-nivaran p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Account Details</p>

              <div>
                <label htmlFor="name" className="label-nivaran">Full Name</label>
                <input id="name" type="text" name="name" value={formData.name}
                  onChange={handleChange} required placeholder="Ramesh Kumar"
                  className="input-nivaran" />
              </div>

              <div>
                <label htmlFor="email" className="label-nivaran">Email</label>
                <input id="email" type="email" name="email" value={formData.email}
                  onChange={handleChange} required placeholder="you@example.com"
                  className="input-nivaran" />
              </div>

              <div>
                <label htmlFor="password" className="label-nivaran">Password</label>
                <input id="password" type="password" name="password" value={formData.password}
                  onChange={handleChange} required minLength="6" placeholder="Min. 6 characters"
                  className="input-nivaran" />
              </div>

              <div>
                <label htmlFor="phone" className="label-nivaran">Phone (optional)</label>
                <input id="phone" type="tel" name="phone" value={formData.phone}
                  onChange={handleChange} placeholder="+91XXXXXXXXXX"
                  className="input-nivaran" />
              </div>
            </div>

            {/* City / Municipality */}
            <div className="card-nivaran p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Your City / ULB *</p>

              <div>
                <label htmlFor="municipality" className="label-nivaran">Select Municipality</label>
                <select
                  id="municipality"
                  name="municipality"
                  value={formData.municipality}
                  onChange={handleChange}
                  required
                  className="input-nivaran"
                >
                  <option value="">-- Choose your city --</option>
                  {municipalities.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name} {m.nameLocal ? `(${m.nameLocal})` : ''} — {m.state} ({m.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Home Address & Pin */}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">Home Address (Optional)</p>
                  <span className="text-[10px] text-gray-400 uppercase">Private</span>
                </div>
                <input
                  id="addressText"
                  type="text"
                  name="addressText"
                  value={formData.addressText}
                  onChange={handleChange}
                  placeholder="Street / locality / landmark (optional)"
                  className="input-nivaran text-xs"
                />

                {selectedMuni && (
                  <div>
                    <p className="text-[11px] text-gray-400 mb-1.5">
                      Optional: Click map to pin your home location
                    </p>
                    <div className="h-44 rounded overflow-hidden border border-earthen-slate">
                      <MapContainer
                        key={`${selectedMuni._id}`}
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution="© OpenStreetMap"
                        />
                        <PinMarker position={homePin} setPosition={setHomePin} />
                      </MapContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Account…
                </span>
              ) : 'Create Account & Verify Email →'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-kesariya font-semibold hover:text-civic-flame transition">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
