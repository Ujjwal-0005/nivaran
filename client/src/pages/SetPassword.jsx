import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

/**
 * /set-password
 *
 * City admins land here after clicking the invite link in their email.
 * The token is in the query string: /set-password?token=<hex>
 */
function SetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { login } = useAuth()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('No invite token found. Please use the link from your invitation email.')
    }
  }, [token])

  const validate = () => {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirm) return 'Passwords do not match.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/auth/set-password', { token, password })
      login(res.data.token, res.data.user)
      setDone(true)
      // Redirect to admin dashboard after brief success screen
      setTimeout(() => navigate('/admin'), 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set password. The link may have expired.')
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
            City Admin<br />
            <span className="text-white/60 text-2xl font-medium">Account Activation</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs">
            Set a secure password to activate your City Administrator account. 
            You will be able to manage civic reports and staff for your municipality.
          </p>
        </div>
        <div className="space-y-3">
          {['Manage city departments', 'Oversee civic reports', 'Track staff performance'].map((t) => (
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

          {done ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="font-display text-2xl font-bold text-sovereign-indigo mb-2">Account Activated!</h2>
              <p className="text-gray-500 text-sm">Redirecting to your admin dashboard…</p>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold text-sovereign-indigo mb-1">
                Activate Account
              </h1>
              <p className="text-gray-500 text-sm mb-7">
                Set a password for your Nivaran City Admin account.
              </p>

              {error && (
                <div className="alert-error mb-5 flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {!token ? (
                <p className="text-gray-500 text-sm">
                  Please use the invitation link sent to your email to reach this page.
                </p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" id="set-password-form">
                  <div>
                    <label htmlFor="sp-password" className="label-nivaran">New Password</label>
                    <input
                      id="sp-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      className="input-nivaran"
                    />
                  </div>
                  <div>
                    <label htmlFor="sp-confirm" className="label-nivaran">Confirm Password</label>
                    <input
                      id="sp-confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      placeholder="Re-enter password"
                      className="input-nivaran"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full py-3"
                    id="set-password-submit"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Activating…
                      </span>
                    ) : 'Set Password & Activate →'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SetPassword
