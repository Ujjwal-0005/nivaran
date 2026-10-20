import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function Login() {
  const [activeRole, setActiveRole] = useState('citizen') // 'citizen' | 'staff'
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

  const navigate = useNavigate()
  const { login } = useAuth()

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/api/auth/login', formData)
      login(response.data.token, response.data.user)

      const redirects = {
        citizen: '/citizen',
        staff: '/staff',
        admin: '/admin',
        superadmin: '/superadmin',
      }
      navigate(redirects[response.data.user.role] || '/')
    } catch (err) {
      if (err.response?.data?.requiresVerification) {
        setError('Please verify your email or phone OTP before logging in.')
        navigate('/verify-otp', { state: { email: formData.email, role: activeRole } })
      } else if (err.response?.data?.applicationStatus) {
        const status = err.response.data.applicationStatus
        const reason = err.response.data.rejectionReason
        if (status === 'pending') {
          setError(
            'Your staff application is currently pending approval from your city administration. Please check back shortly.'
          )
        } else if (status === 'rejected') {
          setError(
            `Your staff application was rejected. Reason: ${
              reason || 'Contact your municipal nodal administrator.'
            }`
          )
        } else {
          setError(err.response?.data?.message || 'Login failed. Please check your credentials.')
        }
      } else {
        setError(err.response?.data?.message || 'Invalid credentials. Please verify your details.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      badgeText="PUNJAB RIGHT TO SERVICE ACT • CITIZEN PORTAL"
      badgeSub="RTS SEC-7"
      showTicker={true}
    >
      {/* ── Card Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`font-display text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Sign In to Nivaran
            </h2>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
              isDark
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                : 'bg-orange-50 text-orange-700 border-orange-200'
            }`}>
              SECURE
            </span>
          </div>
          <p className="text-xs text-orange-600 font-bold mt-1">
            ਨਾਗਰਿਕ ਲਾਗਇਨ • नागरिक प्रवेश
          </p>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Access your civic dashboard to report, track & verify grievances
          </p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
          isDark
            ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
            : 'bg-orange-50 border border-orange-200 text-orange-600'
        }`}>
          🔒
        </div>
      </div>

      {/* ── Role Switcher Tabs (Citizen / Municipal Officer) ────── */}
      <div className={`grid grid-cols-2 p-1 rounded-xl mb-6 border ${
        isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-slate-100 border-slate-200'
      }`}>
        <button
          type="button"
          onClick={() => setActiveRole('citizen')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            activeRole === 'citizen'
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
          onClick={() => setActiveRole('staff')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            activeRole === 'staff'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm'
              : isDark
              ? 'text-slate-400 hover:text-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🏛 Municipal Officer</span>
          <span className="text-[10px] opacity-80 font-normal">(ਅਧਿਕਾਰੀ)</span>
        </button>
      </div>

      {/* ── Error Banner ────────────────────────────────────────── */}
      {error && (
        <div className="mb-5 p-3.5 rounded-xl text-xs bg-red-500/10 border border-red-500/30 text-red-500 flex items-start gap-2.5">
          <span className="text-base flex-shrink-0">⚠️</span>
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* ── Login Form ─────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email / ID Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="email"
              className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
            >
              {activeRole === 'citizen'
                ? 'Email Address / ਈਮੇਲ'
                : 'Official Email or Employee ID'}
            </label>
            <span className="text-[11px] font-mono text-emerald-600">● Verified Route</span>
          </div>

          <div className="relative">
            <input
              id="email"
              type="text"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder={activeRole === 'citizen' ? 'name@domain.com' : 'officer@punjab.gov.in'}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                isDark
                  ? 'border-slate-700 bg-slate-900/60 text-slate-100 placeholder-slate-500'
                  : 'border-slate-300 bg-slate-50/80 text-slate-900 placeholder-slate-400 focus:bg-white'
              }`}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-sm">
              ✉️
            </div>
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
            >
              Password / ਪਾਸਵਰਡ
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[11px] text-orange-600 hover:text-orange-500 font-semibold transition"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 ${
                isDark
                  ? 'border-slate-700 bg-slate-900/60 text-slate-100 placeholder-slate-500'
                  : 'border-slate-300 bg-slate-50/80 text-slate-900 placeholder-slate-400 focus:bg-white'
              }`}
            />
            <div
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 text-sm cursor-pointer hover:text-slate-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              🔑
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-[0.99] transition shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Authenticating Credentials…
            </span>
          ) : (
            <>
              <span>Sign In to Portal</span>
              <span>→</span>
            </>
          )}
        </button>
      </form>

      {/* ── Security Trust Notice ──────────────────────────────── */}
      <div className={`mt-5 pt-4 border-t flex items-center justify-center gap-2 text-[11px] ${
        isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
      }`}>
        <span className="text-emerald-500">🛡️</span>
        <span>256-bit TLS encrypted municipal handshake • Zero data sharing</span>
      </div>

      {/* ── Register Prompt Card ───────────────────────────────── */}
      <div className={`mt-4 p-3.5 rounded-xl flex items-center justify-between border ${
        isDark
          ? 'bg-orange-500/5 border-orange-500/20'
          : 'bg-orange-50/60 border-orange-200/80'
      }`}>
        <div>
          <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            First time on Nivaran?
          </p>
          <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Register in under 2 minutes
          </p>
        </div>
        <Link
          to="/register"
          className="text-xs font-bold text-orange-600 hover:text-orange-500 transition flex items-center gap-1"
        >
          <span>Register Now</span>
          <span>→</span>
        </Link>
      </div>

      {/* ── Urgent Civic Alert Notice ───────────────────────────── */}
      <div className={`mt-3 p-3 rounded-xl flex items-center justify-between gap-3 text-xs border ${
        isDark
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-amber-500 flex-shrink-0">⚠️</span>
          <p className="text-[11px] truncate font-medium">
            Critical Civic Hazard? Open manhole or broken line
          </p>
        </div>
        <Link
          to="/login"
          className={`px-2.5 py-1 rounded font-bold text-[10px] flex-shrink-0 transition ${
            isDark
              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
              : 'bg-amber-200/80 hover:bg-amber-200 text-amber-950'
          }`}
        >
          Emergency Redressal
        </Link>
      </div>
    </AuthLayout>
  )
}
