import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { getDeptColor } from '../utils/deptColors'

function VerifyOTP() {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendDisabled, setResendDisabled] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const email = location.state?.email

  useEffect(() => {
    if (!email) {
      navigate('/register')
    }
  }, [email, navigate])

  useEffect(() => {
    let interval
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(countdown - 1)
      }, 1000)
    } else {
      setResendDisabled(false)
    }
    return () => clearInterval(interval)
  }, [countdown])

  const handleVerify = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/api/auth/verify-otp', { email, otp })
      
      // Store token and user data
      login(response.data.token, response.data.user)
      
      // Redirect based on role
      const roleRedirects = {
        citizen: '/citizen',
        staff: '/staff',
        admin: '/admin',
      }
      navigate(roleRedirects[response.data.user.role] || '/')
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed. Please try again.')
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
      setError(err.response?.data?.message || 'Failed to resend OTP. Please try again.')
      setResendDisabled(false)
      setCountdown(0)
    }
  }

  return (
    <div className="min-h-screen bg-sandstone flex flex-col md:flex-row">
      {/* Left panel - Branding (Hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-sovereign-indigo text-white flex-col justify-center p-12">
        <div className="max-w-md mx-auto">
          <h1 className="font-display text-4xl lg:text-5xl font-bold mb-4">Nivaran</h1>
          <p className="text-xl text-blue-100 font-display mb-6">निवारण</p>
          <p className="text-blue-50 text-lg leading-relaxed border-l-4 border-kesariya pl-4">
            Security Verification
          </p>
        </div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 py-12 md:py-8 bg-sandstone md:rounded-l-[2rem] md:-ml-8 md:shadow-[-10px_0_20px_rgba(0,0,0,0.05)] z-10">
        <div className="w-full max-w-sm mx-auto">
          <div className="md:hidden text-center mb-8">
            <h1 className="font-display text-3xl font-bold text-sovereign-indigo mb-1">Nivaran</h1>
            <p className="text-sm font-semibold text-gray-500">निवारण</p>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Verify Email</h2>
            <p className="text-sm text-gray-500">
              Enter the 6-digit code sent to <span className="font-medium text-gray-700">{email}</span>
            </p>
          </div>

          {error && <div className="alert-error mb-6">{error}</div>}

          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="label-nivaran">OTP Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="123456"
                className="input-nivaran text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? 'Verifying…' : 'Verify Account'}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-earthen-slate pt-6">
            <p className="text-sm text-gray-500 mb-3">Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={resendDisabled}
              className="text-sm font-semibold text-kesariya hover:text-civic-flame transition disabled:text-gray-400 disabled:pointer-events-none"
            >
              {resendDisabled ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VerifyOTP
