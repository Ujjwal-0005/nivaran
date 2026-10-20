import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../utils/api'
import AuthLayout from '../components/AuthLayout'

// Leaflet click & drag marker component for home pin
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

const REGISTRATION_STEPS = [
  { title: 'Citizen Identity' },
  { title: 'Ward & Jurisdiction' },
  { title: 'Instant Verification' },
]

export default function Register() {
  const [role, setRole] = useState('citizen')
  const [currentStep, setCurrentStep] = useState(1) // 1: Identity, 2: Jurisdiction, 3: (Moves to VerifyOTP)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    municipality: '',
    addressText: '',
    department: '',
    employeeId: '',
    designation: '',
    preferredLanguage: 'English',
    consentSms: true,
    declareJurisdiction: true,
  })

  const [homePin, setHomePin] = useState(null)
  const [municipalities, setMunicipalities] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedMuni, setSelectedMuni] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const [isDark, setIsDark] = useState(() => {
    return (localStorage.getItem('nivaran_auth_theme') || 'dark') === 'dark'
  })

  useEffect(() => {
    const handleStorage = () => {
      setIsDark((localStorage.getItem('nivaran_auth_theme') || 'dark') === 'dark')
    }
    window.addEventListener('storage', handleStorage)
    const interval = setInterval(handleStorage, 400)
    return () => {
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
    }
  }, [])

  // City request modal state
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestForm, setRequestForm] = useState({ cityName: '', state: 'Punjab', email: '' })
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState('')
  const [requestError, setRequestError] = useState('')

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

  // Fetch departments when municipality changes (for staff)
  useEffect(() => {
    const fetchDepartments = async () => {
      if (role === 'staff' && formData.municipality) {
        try {
          const res = await api.get(`/api/municipalities/${formData.municipality}/departments`)
          setDepartments(res.data.departments || [])
        } catch (err) {
          console.error('Failed to load departments:', err)
        }
      } else {
        setDepartments([])
      }
    }
    fetchDepartments()
  }, [role, formData.municipality])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    if (name === 'municipality') {
      const muni = municipalities.find((m) => m._id === value)
      setSelectedMuni(muni || null)
      if (muni && muni.centroid) {
        setHomePin([muni.centroid.lat, muni.centroid.lng])
      }
    }
  }

  const handleNextStep = (e) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Please provide your full legal name.')
      return
    }
    if (!formData.email.trim()) {
      setError('Please provide a valid email address.')
      return
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setCurrentStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.municipality) {
      setError('Please select your municipal corporation or town jurisdiction.')
      return
    }

    if (role === 'staff') {
      if (!formData.department) {
        setError('Please select your municipal department.')
        return
      }
      if (!formData.employeeId) {
        setError('Employee ID is required for staff verification.')
        return
      }
    }

    setLoading(true)

    try {
      // Clean phone number: if 10 digits provided, prefix with +91
      let formattedPhone = formData.phone ? formData.phone.trim().replace(/[\s-]/g, '') : ''
      if (formattedPhone) {
        if (/^[0-9]{10}$/.test(formattedPhone)) {
          formattedPhone = `+91${formattedPhone}`
        }
      }

      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formattedPhone || undefined,
        municipality: formData.municipality,
        role: role,
      }

      if (role === 'staff') {
        payload.department = formData.department
        payload.employeeId = formData.employeeId.trim()
        payload.designation = formData.designation ? formData.designation.trim() : 'Staff Officer'
      } else {
        payload.homeAddress = {
          text: formData.addressText || '',
          lat: homePin ? homePin[0] : null,
          lng: homePin ? homePin[1] : null,
        }
      }

      await api.post('/api/auth/register', payload)
      navigate('/verify-otp', { state: { email: formData.email.trim().toLowerCase(), role, phone: formattedPhone } })
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCityRequestSubmit = async (e) => {
    e.preventDefault()
    setRequestLoading(true)
    setRequestSuccess('')
    setRequestError('')
    try {
      const res = await api.post('/api/city-requests', requestForm)
      setRequestSuccess(res.data.message || 'Request submitted successfully.')
      setRequestForm({ cityName: '', state: 'Punjab', email: '' })
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Failed to submit city request.')
    } finally {
      setRequestLoading(false)
    }
  }

  const mapCenter = selectedMuni?.centroid
    ? [selectedMuni.centroid.lat, selectedMuni.centroid.lng]
    : [31.326, 75.5762]
  const mapZoom = selectedMuni?.defaultZoom || 13

  return (
    <AuthLayout
      badgeText="PUBLIC SERVICE GUARANTEE • ਸੇਵਾ ਅਧਿਕਾਰ"
      badgeSub="RTS PUNJAB"
      step={{ current: currentStep, total: 3 }}
      steps={REGISTRATION_STEPS}
      showTicker={true}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`font-display text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Create Citizen Account
            </h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              isDark
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              FAST ACCESS
            </span>
          </div>
          <p className="text-xs text-orange-600 font-bold mt-1">
            ਨਵਾਂ ਨਾਗਰਿਕ ਖਾਤਾ ਬਣਾਓ • त्वरित नागरिक पंजीकरण
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Quick 2-minute registration backed by Punjab Right to Service
          </p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
          isDark
            ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
            : 'bg-orange-50 border border-orange-200 text-orange-600'
        }`}>
          📝
        </div>
      </div>

      {/* ── Role Switcher ───────────────────────────────────────── */}
      <div className={`grid grid-cols-2 p-1 rounded-xl mb-5 border ${
        isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-slate-100 border-slate-200'
      }`}>
        <button
          type="button"
          onClick={() => {
            setRole('citizen')
            setCurrentStep(1)
          }}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            role === 'citizen'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm'
              : isDark
              ? 'text-slate-400 hover:text-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>👤 Citizen</span>
          <span className="text-[10px] opacity-80 font-normal">(ਨਾਗਰਿਕ)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setRole('staff')
            setCurrentStep(1)
          }}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            role === 'staff'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm'
              : isDark
              ? 'text-slate-400 hover:text-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>👔 Municipal Staff</span>
          <span className="text-[10px] opacity-80 font-normal">(ਸਟਾਫ਼)</span>
        </button>
      </div>

      {/* ── Error Banner ────────────────────────────────────────── */}
      {error && (
        <div className="mb-5 p-3.5 rounded-xl text-xs bg-red-500/10 border border-red-500/30 text-red-500 flex items-start gap-2.5">
          <span className="text-base flex-shrink-0">⚠️</span>
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* ── Multi-Step Form ─────────────────────────────────────── */}
      {currentStep === 1 ? (
        /* STEP 1: Citizen Identity */
        <form onSubmit={handleNextStep} className="space-y-4">
          <div className={`flex items-center justify-between pb-1 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
              Step 1: Identity & Credentials
            </span>
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>1 of 2</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="name" className={`text-xs font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Full Legal Name / ਪੂਰਾ ਨਾਮ *
              </label>
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>As per official ID</span>
            </div>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g. Harpreet Singh Dhillon"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                isDark
                  ? 'border-slate-700 bg-slate-900/60 text-slate-100 placeholder-slate-500'
                  : 'border-slate-300 bg-slate-50/80 text-slate-900 placeholder-slate-400 focus:bg-white'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="email" className={`text-xs font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Email Address / ਈਮੇਲ *
              </label>
              <span className="text-[10px] text-emerald-600 font-semibold">OTP Dispatched Here</span>
            </div>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="harpreet@domain.com"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                isDark
                  ? 'border-slate-700 bg-slate-900/60 text-slate-100 placeholder-slate-500'
                  : 'border-slate-300 bg-slate-50/80 text-slate-900 placeholder-slate-400 focus:bg-white'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="phone" className={`text-xs font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Mobile Number / ਮੋਬਾਈਲ ਨੰਬਰ (Optional)
              </label>
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>SMS updates</span>
            </div>
            <div className="flex gap-2">
              <div className={`flex items-center px-3 rounded-xl border text-xs font-mono font-bold ${
                isDark
                  ? 'border-slate-700 bg-slate-800/80 text-slate-300'
                  : 'border-slate-300 bg-slate-100 text-slate-700'
              }`}>
                🇮🇳 +91
              </div>
              <input
                id="phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="98765 43210"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                  isDark
                    ? 'border-slate-700 bg-slate-900/60 text-slate-100 placeholder-slate-500'
                    : 'border-slate-300 bg-slate-50/80 text-slate-900 placeholder-slate-400 focus:bg-white'
                }`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className={`text-xs font-semibold uppercase tracking-wider ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Create Password / ਪਾਸਵਰਡ *
              </label>
              <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Min 6 characters</span>
            </div>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              placeholder="••••••••"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                isDark
                  ? 'border-slate-700 bg-slate-900/60 text-slate-100 placeholder-slate-500'
                  : 'border-slate-300 bg-slate-50/80 text-slate-900 placeholder-slate-400 focus:bg-white'
              }`}
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-[0.99] transition shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2"
          >
            <span>Proceed to Jurisdiction & Ward</span>
            <span>→</span>
          </button>
        </form>
      ) : (
        /* STEP 2: Jurisdiction & Role-specific details */
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={`flex items-center justify-between pb-1 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
              Step 2: Municipal Jurisdiction
            </span>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`text-xs transition flex items-center gap-1 ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              ← Back
            </button>
          </div>

          {/* Municipality Selector */}
          <div>
            <label htmlFor="municipality" className={`text-xs font-semibold uppercase tracking-wider block mb-1.5 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Select Municipal Corporation / ULB *
            </label>
            {municipalities.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl text-xs">
                Nivaran is rolling out across Punjab. There are currently no live cities accepting registrations.
              </div>
            ) : (
              <select
                id="municipality"
                name="municipality"
                value={formData.municipality}
                onChange={handleChange}
                required
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                  isDark
                    ? 'border-slate-700 bg-slate-900 text-slate-100'
                    : 'border-slate-300 bg-slate-50/90 text-slate-900 focus:bg-white'
                }`}
              >
                <option value="" className={isDark ? 'bg-slate-900 text-slate-400' : 'bg-white text-slate-500'}>
                  -- Choose Municipal Body --
                </option>
                {municipalities.map((m) => (
                  <option
                    key={m._id}
                    value={m._id}
                    className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}
                  >
                    {m.name} {m.nameLocal ? `(${m.nameLocal})` : ''} — {m.state} ({m.type})
                  </option>
                ))}
              </select>
            )}

            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className={isDark ? 'text-slate-500' : 'text-slate-500'}>Live Punjab RTS sync</span>
              <button
                type="button"
                onClick={() => {
                  setShowRequestModal(true)
                  setRequestSuccess('')
                  setRequestError('')
                }}
                className="text-orange-600 hover:text-orange-500 font-semibold transition underline"
              >
                Can't find your city? Request it
              </button>
            </div>
          </div>

          {/* Staff Department & Employee ID */}
          {role === 'staff' && (
            <div className={`space-y-3 p-3.5 rounded-xl border ${
              isDark ? 'bg-slate-900/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-[11px] font-mono uppercase text-orange-600 font-bold">
                Government Officer Credentials
              </span>
              <div>
                <label htmlFor="department" className={`text-xs font-semibold block mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Assigned Department *
                </label>
                <select
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-900'
                  }`}
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="employeeId" className={`text-xs font-semibold block mb-1 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Employee ID *
                  </label>
                  <input
                    id="employeeId"
                    type="text"
                    name="employeeId"
                    value={formData.employeeId}
                    onChange={handleChange}
                    required
                    placeholder="EMP-001"
                    className={`w-full px-3 py-2 rounded-lg border text-xs ${
                      isDark
                        ? 'border-slate-700 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label htmlFor="designation" className={`text-xs font-semibold block mb-1 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Designation *
                  </label>
                  <input
                    id="designation"
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    required
                    placeholder="Field Officer"
                    className={`w-full px-3 py-2 rounded-lg border text-xs ${
                      isDark
                        ? 'border-slate-700 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Citizen Address & Optional Pin */}
          {role === 'citizen' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="addressText" className={`text-xs font-semibold uppercase tracking-wider ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Locality / Street Address (Optional)
                  </label>
                  <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Private</span>
                </div>
                <input
                  id="addressText"
                  type="text"
                  name="addressText"
                  value={formData.addressText}
                  onChange={handleChange}
                  placeholder="Street / locality / landmark in municipal ward"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                    isDark
                      ? 'border-slate-700 bg-slate-900/60 text-slate-100 placeholder-slate-500'
                      : 'border-slate-300 bg-slate-50/80 text-slate-900 placeholder-slate-400 focus:bg-white'
                  }`}
                />
              </div>

              {selectedMuni && (
                <div>
                  <p className={`text-[11px] mb-1.5 flex items-center justify-between ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <span>Optional: Tap map to pin your neighborhood</span>
                    {homePin && <span className="text-emerald-600 font-mono text-[10px] font-bold">✓ Pin Placed</span>}
                  </p>
                  <div className={`h-36 rounded-xl overflow-hidden border shadow-inner ${
                    isDark ? 'border-slate-700' : 'border-slate-300'
                  }`}>
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
          )}

          {/* Language Preference */}
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wider block mb-1.5 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Preferred Notification Language / ਭਾਸ਼ਾ ਚੋਣ
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['ਪੰਜਾਬੀ (Punjabi)', 'हिन्दी (Hindi)', 'English'].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, preferredLanguage: lang }))}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition ${
                    formData.preferredLanguage === lang
                      ? isDark
                        ? 'bg-orange-500/20 border-orange-500 text-orange-400 font-bold'
                        : 'bg-orange-50 border-orange-500 text-orange-700 font-bold'
                      : isDark
                      ? 'border-slate-700 text-slate-400 hover:border-slate-600'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400 bg-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Statutory Consent Checkboxes */}
          <div className={`space-y-2 pt-1 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="consentSms"
                checked={formData.consentSms}
                onChange={handleChange}
                className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <span className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                I agree to receive automated grievance resolution status updates and engineer dispatch notices.
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="declareJurisdiction"
                checked={formData.declareJurisdiction}
                onChange={handleChange}
                required
                className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <span className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                I declare my grievance queries pertain to the selected municipal jurisdiction under the Punjab Right to Service Act.
              </span>
            </label>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-[0.99] transition shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Dispatching Verification OTP…
              </span>
            ) : (
              <>
                <span>Generate OTP & Complete Registration</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* ── Login Link ─────────────────────────────────────────── */}
      <div className={`mt-5 pt-4 border-t text-center ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Already registered with Nivaran?{' '}
          <Link to="/login" className="text-orange-600 font-bold hover:text-orange-500 transition">
            Sign In here →
          </Link>
        </p>
      </div>

      {/* ── City Request Modal ──────────────────────────────────── */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 ${
            isDark
              ? 'bg-[#0E1420] border-slate-800 text-white'
              : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <h3 className={`font-bold text-base flex items-center gap-2 ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}>
                <span>🏙️</span> Request Your City in Punjab
              </h3>
              <button
                type="button"
                onClick={() => setShowRequestModal(false)}
                className={`text-xl font-bold ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                &times;
              </button>
            </div>

            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Tell us which city or town you'd like to see on Nivaran. When citizen demand builds up, we coordinate with the municipal corporation to enable automated grievance redressal.
            </p>

            {requestSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-xl text-xs">
                {requestSuccess}
              </div>
            )}
            {requestError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 rounded-xl text-xs">
                {requestError}
              </div>
            )}

            <form onSubmit={handleCityRequestSubmit} className="space-y-3">
              <div>
                <label className={`text-xs font-semibold block mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>City / Town Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ludhiana, Bathinda, Patiala"
                  value={requestForm.cityName}
                  onChange={(e) => setRequestForm({ ...requestForm, cityName: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 text-white'
                      : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>Your Email</label>
                <input
                  type="email"
                  required
                  placeholder="you@domain.com"
                  value={requestForm.email}
                  onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    isDark
                      ? 'border-slate-700 bg-slate-900 text-white'
                      : 'border-slate-300 bg-slate-50 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs ${
                    isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestLoading}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 transition"
                >
                  {requestLoading ? 'Submitting…' : 'Submit City Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthLayout>
  )
}
