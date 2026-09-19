import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../utils/api'

const STEPS = ['Account Details', 'Location', 'Done']

function Register() {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '', state: '', city: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/api/auth/register', formData)
      navigate('/verify-otp', { state: { email: formData.email } })
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
            Create your account and start reporting civic issues in your locality. It's free, fast, and matters.
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
            Register as a citizen to report and track issues
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

            {/* Location */}
            <div className="card-nivaran p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Your Location</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="state" className="label-nivaran">State</label>
                  <input id="state" type="text" name="state" value={formData.state}
                    onChange={handleChange} required placeholder="Maharashtra"
                    className="input-nivaran" />
                </div>
                <div>
                  <label htmlFor="city" className="label-nivaran">City</label>
                  <input id="city" type="text" name="city" value={formData.city}
                    onChange={handleChange} required placeholder="Pune"
                    className="input-nivaran" />
                </div>
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
