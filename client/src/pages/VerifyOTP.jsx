import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function VerifyOTP() {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendDisabled, setResendDisabled] = useState(false)
  const [countdown, setCountdown] = useState(39)
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState('')

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

  const inputRefs = useRef([])
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const email = location.state?.email
  const role = location.state?.role || 'citizen'
  const phone = location.state?.phone || ''

  useEffect(() => {
    if (!email) {
      navigate('/register')
    }
  }, [email, navigate])

  useEffect(() => {
    let interval
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1)
      }, 1000)
    } else {
      setResendDisabled(false)
    }
    return () => clearInterval(interval)
  }, [countdown])

  const handleDigitChange = (index, value) => {
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6).split('')
      const updated = [...digits]
      pasted.forEach((char, i) => {
        if (index + i < 6) updated[index + i] = char
      })
      setDigits(updated)
      const nextIndex = Math.min(index + pasted.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    const cleanChar = value.replace(/\D/g, '')
    const updated = [...digits]
    updated[index] = cleanChar
    setDigits(updated)

    if (cleanChar && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')

    const otpCode = digits.join('')
    if (otpCode.length !== 6) {
      setError('Please enter the full 6-digit verification code.')
      return
    }

    setLoading(true)

    try {
      const response = await api.post('/api/auth/verify-otp', { email, otp: otpCode })

      if (response.data.requiresApproval) {
        setRequiresApproval(true)
        setApplicationStatus(response.data.applicationStatus)
        setLoading(false)
        return
      }

      login(response.data.token, response.data.user)

      const roleRedirects = {
        citizen: '/citizen',
        staff: '/staff',
        admin: '/admin',
        superadmin: '/superadmin',
      }
      navigate(roleRedirects[response.data.user.role] || '/')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'OTP verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setResendDisabled(true)
    setCountdown(60)

    try {
      await api.post('/api/auth/resend-otp', { email })
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resend OTP. Please try again.')
      setResendDisabled(false)
      setCountdown(0)
    }
  }

  return (
    <AuthLayout
      badgeText="PUNJAB RIGHT TO SERVICE • VERIFICATION GATEWAY"
      badgeSub="SEC-7 AUDIT"
      step={{ current: 3, total: 3 }}
      steps={[
        { title: 'Citizen Identity' },
        { title: 'Ward & Jurisdiction' },
        { title: 'Instant Verification' },
      ]}
      showTicker={false}
    >
      {/* ── Top Bar with Edit Target Link ─────────────────────── */}
      <div className={`flex items-center justify-between pb-4 mb-4 border-b ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <Link
          to="/register"
          className={`text-xs transition flex items-center gap-1.5 ${
            isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>←</span>
          <span>Edit Target ({phone || email})</span>
        </Link>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${
          isDark
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          SECURE DISPATCH ROUTE
        </span>
      </div>

      {/* ── Verification Icon Shield ─────────────────────────── */}
      <div className="text-center mb-6">
        <div className="relative inline-block mb-3">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border shadow-lg ${
            isDark
              ? 'bg-gradient-to-br from-orange-500/20 to-amber-600/10 border-orange-500/30 text-orange-400 shadow-orange-500/10'
              : 'bg-orange-50 border-orange-200 text-orange-600 shadow-orange-200/50'
          }`}>
            🛡️
          </div>
          <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold ring-2 ${
            isDark ? 'ring-[#0E1420]' : 'ring-white'
          }`}>
            ✓
          </span>
        </div>

        <h2 className={`font-display text-2xl font-black tracking-tight ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          Verify Your Identity
        </h2>
        <p className="text-xs text-orange-600 font-bold mt-1">
          ਮੋਬਾਈਲ / ਈਮੇਲ ਪੁਸ਼ਟੀਕਰਨ • नागरिक सत्यापन
        </p>
        <p className={`text-xs mt-1 max-w-sm mx-auto leading-relaxed ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          A statutory 6-digit one-time authorization code was dispatched to{' '}
          <span className={`font-bold font-mono ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{email}</span>
        </p>
      </div>

      {/* ── Auto-Catch Indicator Badge ────────────────────────── */}
      <div className={`mb-6 p-2.5 rounded-xl border flex items-center justify-between text-xs ${
        isDark
          ? 'bg-slate-900/60 border-slate-800 text-slate-300'
          : 'bg-slate-100/80 border-slate-200 text-slate-700'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-emerald-500">⚡</span>
          <span>Instant Redressal Dispatch Active</span>
        </div>
        <span className="text-[10px] font-mono text-orange-600 font-bold">
          PUNJAB-NODE #04
        </span>
      </div>

      {/* ── Error Banner ────────────────────────────────────────── */}
      {error && (
        <div className="mb-5 p-3.5 rounded-xl text-xs bg-red-500/10 border border-red-500/30 text-red-500 flex items-start gap-2.5">
          <span className="text-base flex-shrink-0">⚠️</span>
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* ── Approval waiting screen for staff ─────────────────── */}
      {requiresApproval ? (
        <div className={`p-6 rounded-xl border text-center space-y-4 ${
          isDark
            ? 'bg-slate-900/60 border-emerald-500/30'
            : 'bg-emerald-50/50 border-emerald-200'
        }`}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto border ${
            isDark
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-emerald-100 border-emerald-200 text-emerald-700'
          }`}>
            ⏳
          </div>
          <div>
            <h3 className={`font-display text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Application Submitted to Municipality
            </h3>
            <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Your municipal staff application is currently pending verification from your city nodal administrator.
            </p>
          </div>
          <div className={`p-3 rounded-lg border text-left flex items-center justify-between ${
            isDark
              ? 'bg-slate-950/70 border-slate-800'
              : 'bg-white border-slate-200'
          }`}>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Current Status:</span>
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-600 uppercase">
              {applicationStatus || 'Pending Approval'}
            </span>
          </div>
          <button
            onClick={() => navigate('/login')}
            className={`w-full py-2.5 rounded-xl font-bold text-xs transition ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            Return to Login Portal
          </button>
        </div>
      ) : (
        /* ── 6-Digit Segmented Box Form ────────────────────────── */
        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-center gap-2 sm:gap-3">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-2xl font-black font-mono rounded-xl border transition-all ${
                  digit
                    ? isDark
                      ? 'border-orange-500 bg-orange-500/10 text-white shadow-md shadow-orange-500/20'
                      : 'border-orange-500 bg-orange-50 text-orange-950 shadow-md shadow-orange-500/10'
                    : isDark
                    ? 'border-slate-700 bg-slate-900/80 text-slate-100 focus:border-orange-500 focus:bg-slate-900'
                    : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-orange-500 focus:bg-white'
                } focus:outline-none focus:ring-2 focus:ring-orange-500/40`}
              />
            ))}
          </div>

          {/* Validity Countdown Window */}
          <div className="flex items-center justify-between text-xs px-1">
            <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <span>⏳</span>
              <span>Validity Window:</span>
            </div>
            <span className="font-mono font-bold text-orange-600">
              00:{countdown < 10 ? `0${countdown}` : countdown}s
            </span>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-[0.99] transition shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Verifying Credentials…
              </span>
            ) : (
              <>
                <span>🔒 Verify & Enter Civic Portal</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* ── Resend Triggers ────────────────────────────────────── */}
      {!requiresApproval && (
        <div className={`mt-6 pt-4 border-t text-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Didn't receive the verification code?
          </p>
          <button
            onClick={handleResend}
            disabled={resendDisabled}
            className="text-xs font-bold text-orange-600 hover:text-orange-500 transition disabled:text-slate-400 disabled:pointer-events-none"
          >
            {resendDisabled ? `Resend new code in ${countdown}s` : 'Resend Code Now'}
          </button>
        </div>
      )}

      {/* ── Regulatory Compliance Badges ───────────────────────── */}
      <div className={`mt-5 pt-4 border-t flex flex-wrap items-center justify-center gap-3 text-[10px] font-mono ${
        isDark ? 'border-slate-800/80 text-slate-500' : 'border-slate-200 text-slate-500'
      }`}>
        <span>● NIC SMS Certified</span>
        <span>● UIDAI Standard Encrypted</span>
        <span>● Punjab RTS Enacted</span>
      </div>
    </AuthLayout>
  )
}
