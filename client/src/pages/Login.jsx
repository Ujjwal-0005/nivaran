import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const { login } = useAuth()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.post('/api/auth/login', formData)
      login(response.data.token, response.data.user)
      const redirects = { citizen: '/citizen', staff: '/staff', admin: '/admin' }
      navigate(redirects[response.data.user.role] || '/')
    } catch (err) {
      if (err.response?.data?.requiresVerification) {
        setError('Please verify your email before logging in.')
      } else {
        setError(err.response?.data?.message || 'Login failed. Please check your credentials.')
      }
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
            नागरिक पोर्टल<br />
            <span className="text-white/60 text-2xl font-medium">Citizen Portal</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Log in to report civic issues, track your complaints, and engage with your municipality in real time.
          </p>
        </div>
        <div className="space-y-3">
          {['Real-time status tracking', 'Photo & location evidence', 'Dispute resolution'].map((t) => (
            <div key={t} className="flex items-center gap-2 text-sm text-white/60">
              <span className="w-1.5 h-1.5 rounded-full bg-kesariya flex-shrink-0" />
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded bg-sovereign-indigo flex items-center justify-center text-white text-sm">🏛</div>
            <span className="font-display font-bold text-sovereign-indigo text-xl">Nivaran</span>
          </div>

          <h1 className="font-display text-3xl font-bold text-sovereign-indigo mb-1">
            Welcome back
          </h1>
          <p className="text-gray-500 text-sm mb-7">
            Sign in to your Nivaran account
          </p>

          {error && (
            <div className="alert-error mb-5 flex items-start gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="label-nivaran">Email Address</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                className="input-nivaran"
              />
            </div>

            <div>
              <label htmlFor="password" className="label-nivaran">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="input-nivaran"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging in…
                </span>
              ) : 'Login →'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-kesariya font-semibold hover:text-civic-flame transition">
              Sign Up
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-earthen-slate text-center">
            <Link
              to="/transparency"
              className="text-xs text-gray-400 hover:text-kesariya transition"
            >
              📊 View Public Transparency Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
