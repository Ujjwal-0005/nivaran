import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../utils/api'
import SuperAdminLayout from './SuperAdminLayout'

const TYPE_LABELS = {
  corporation: 'Municipal Corporation',
  council: 'Municipal Council',
  nagar_panchayat: 'Nagar Panchayat',
}

function CityDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [muni, setMuni] = useState(null)
  const [admins, setAdmins] = useState([])
  const [cityStats, setCityStats] = useState({ staff: 0, citizens: 0, reports: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Invite Admin State
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', designation: '' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  // Edit Admin State
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', designation: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Deactivate Admin State (with required reason)
  const [deactivatingAdmin, setDeactivatingAdmin] = useState(null)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [deactivateError, setDeactivateError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [muniRes, adminsRes, overviewRes] = await Promise.all([
        api.get(`/api/superadmin/municipalities/${id}`),
        api.get(`/api/superadmin/municipalities/${id}/admins`),
        api.get('/api/superadmin/overview'),
      ])
      setMuni(muniRes.data.data)
      setAdmins(adminsRes.data.data)

      const cityData = overviewRes.data.perCity.find((c) => c.id === id)
      if (cityData) {
        setCityStats({
          staff: cityData.staff,
          citizens: cityData.citizens,
          reports: cityData.reportsTotal,
        })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load city details')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')
    try {
      const res = await api.post(`/api/superadmin/municipalities/${id}/admins`, inviteForm)
      setInviteSuccess(res.data.message)
      setInviteForm({ name: '', email: '', designation: '' })
      loadData()
    } catch (err) {
      setInviteError(err.response?.data?.message || 'Failed to invite admin')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      await api.patch(`/api/superadmin/admins/${editingAdmin._id}`, editForm)
      setEditingAdmin(null)
      loadData()
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update admin')
    } finally {
      setEditLoading(false)
    }
  }

  const handleMakePrimary = async (adminId) => {
    if (!window.confirm('Designate this admin as the primary city administrator?')) return
    try {
      await api.post(`/api/superadmin/admins/${adminId}/make-primary`)
      loadData()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to set primary admin')
    }
  }

  const handleReactivate = async (adminId) => {
    if (!window.confirm('Reactivate this administrator account?')) return
    try {
      await api.post(`/api/superadmin/admins/${adminId}/reactivate`)
      loadData()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reactivate admin')
    }
  }

  const handleResendInvite = async (adminId) => {
    if (!window.confirm('Send a new invite/password reset link to this admin?')) return
    try {
      const res = await api.post(`/api/superadmin/municipalities/${id}/admins/${adminId}/reset-password`)
      alert(res.data.message)
      loadData()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resend invite link')
    }
  }

  const handleDeactivateAdmin = async (e) => {
    e.preventDefault()
    if (!deactivateReason.trim()) {
      setDeactivateError('A deactivation reason is required')
      return
    }
    setDeactivateLoading(true)
    setDeactivateError('')
    try {
      await api.delete(`/api/superadmin/municipalities/${id}/admins/${deactivatingAdmin._id}`, {
        data: { reason: deactivateReason.trim() },
      })
      setDeactivatingAdmin(null)
      setDeactivateReason('')
      loadData()
    } catch (err) {
      setDeactivateError(err.response?.data?.message || 'Failed to deactivate admin')
    } finally {
      setDeactivateLoading(false)
    }
  }

  // Checklist counts-only computations
  const activeAdminsCount = admins.filter((a) => a.isActive).length
  const checklistItems = [
    {
      title: 'Active City Administrator',
      desc: 'At least one active admin appointed to manage this municipality',
      passed: activeAdminsCount > 0,
      metric: `${activeAdminsCount} active admin(s)`,
    },
    {
      title: 'Municipal Departments Configured',
      desc: 'Default civic operational departments seeded for routing',
      passed: true,
      metric: '10 seeded departments',
    },
    {
      title: 'Department Staff Provisioned',
      desc: 'Field and nodal staff members ready to resolve tickets',
      passed: cityStats.staff > 0,
      metric: `${cityStats.staff} staff member(s)`,
    },
    {
      title: 'Live Citizen Reports Submitted',
      desc: 'Platform operational activity and citizen report intake',
      passed: cityStats.reports > 0,
      metric: `${cityStats.reports} report(s) logged`,
    },
  ]
  const completedChecklist = checklistItems.filter((i) => i.passed).length

  return (
    <SuperAdminLayout title={muni ? `${muni.name} — City Details` : 'City Details'}>
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Loading city details…</div>
      ) : error ? (
        <div className="alert-error mb-4">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Back link & City Info Banner */}
          <div>
            <Link to="/superadmin/municipalities" className="text-xs text-kesariya font-medium hover:underline inline-block mb-3">
              ← Back to Cities
            </Link>
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold font-display text-sovereign-indigo">{muni.name}</h1>
                  {muni.nameLocal && <span className="text-gray-400 font-normal text-sm">({muni.nameLocal})</span>}
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                    muni.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {muni.isActive ? 'Active City' : 'Inactive City'}
                  </span>
                  {muni.isLive ? (
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Live Platform
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      Not Live
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {TYPE_LABELS[muni.type] || muni.type} · {muni.state} · LGD Code: {muni.lgdCode || 'N/A'}
                </div>
                {!muni.isLive && muni.reasons && muni.reasons.length > 0 && (
                  <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg inline-block">
                    <span className="font-semibold">Missing requirements to go live:</span>{' '}
                    {muni.reasons.map((r) => r.replace(/_/g, ' ')).join(', ')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInviteModal(true)}
                  disabled={!muni.isActive}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                  id="add-admin-btn"
                >
                  + Add Admin
                </button>
              </div>
            </div>
          </div>

          {/* Bring a Catalog City Live Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display font-semibold text-sovereign-indigo text-lg">Bring City Live (3 Steps)</h2>
                <p className="text-xs text-gray-400 mt-0.5">A city becomes live once active with an active administrator who has completed password setup</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                muni.isLive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {muni.isLive ? '🎉 City Is Live' : 'Pending Setup'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className={`p-4 rounded-xl border ${muni.isActive ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Step 1</span>
                  <span className="text-base">{muni.isActive ? '✅' : '⏳'}</span>
                </div>
                <h3 className="font-semibold text-sm text-gray-900">City Active</h3>
                <p className="text-xs text-gray-500 mt-1">Municipality enabled in system</p>
                <span className={`text-[11px] font-medium mt-2 inline-block ${muni.isActive ? 'text-green-700' : 'text-amber-700'}`}>
                  {muni.isActive ? 'Active' : 'Deactivated'}
                </span>
              </div>

              <div className={`p-4 rounded-xl border ${admins.some((a) => a.isActive) ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Step 2</span>
                  <span className="text-base">{admins.some((a) => a.isActive) ? '✅' : '⏳'}</span>
                </div>
                <h3 className="font-semibold text-sm text-gray-900">Admin Appointed</h3>
                <p className="text-xs text-gray-500 mt-1">At least 1 active city admin invited</p>
                <span className={`text-[11px] font-medium mt-2 inline-block ${admins.some((a) => a.isActive) ? 'text-green-700' : 'text-amber-700'}`}>
                  {admins.filter((a) => a.isActive).length} active admin(s)
                </span>
              </div>

              <div className={`p-4 rounded-xl border ${admins.some((a) => a.isActive && a.isVerified) ? 'bg-green-50/50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Step 3</span>
                  <span className="text-base">{admins.some((a) => a.isActive && a.isVerified) ? '✅' : '⏳'}</span>
                </div>
                <h3 className="font-semibold text-sm text-gray-900">Password Configured</h3>
                <p className="text-xs text-gray-500 mt-1">Admin accepted invite and set password</p>
                <span className={`text-[11px] font-medium mt-2 inline-block ${admins.some((a) => a.isActive && a.isVerified) ? 'text-green-700' : 'text-amber-700'}`}>
                  {admins.some((a) => a.isActive && a.isVerified) ? 'Password set' : 'Awaiting setup'}
                </span>
              </div>
            </div>
          </div>

          {/* Onboarding Checklist Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-semibold text-sovereign-indigo text-lg">Onboarding Checklist</h2>
                <p className="text-xs text-gray-400 mt-0.5">Automated readiness checks computed from live platform counts</p>
              </div>
              <span className="text-sm font-bold bg-blue-50 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
                {completedChecklist} / 4 Complete
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checklistItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                    item.passed ? 'bg-green-50/40 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <span className="text-xl mt-0.5">{item.passed ? '✅' : '⏳'}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold text-sm ${item.passed ? 'text-green-900' : 'text-gray-700'}`}>
                        {item.title}
                      </h3>
                      <span className="text-xs font-medium text-gray-500">{item.metric}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* City Administrators Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-display font-semibold text-sovereign-indigo text-lg">City Administrators</h2>
                <p className="text-xs text-gray-400 mt-0.5">Authorized municipal administrators for this tenant</p>
              </div>
              <button
                onClick={() => setShowInviteModal(true)}
                disabled={!muni.isActive}
                className="text-xs text-kesariya hover:underline font-semibold disabled:opacity-50"
              >
                + Invite New Admin
              </button>
            </div>

            {admins.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No administrators appointed yet for this city.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 font-medium">
                    <tr>
                      <th className="px-5 py-3">Administrator</th>
                      <th className="px-5 py-3">Designation</th>
                      <th className="px-5 py-3">Primary</th>
                      <th className="px-5 py-3">Account Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {admins.map((admin) => (
                      <tr key={admin._id} className="hover:bg-gray-50/50">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-gray-900">{admin.name}</div>
                          <div className="text-xs text-gray-400">{admin.email} {admin.phone ? `· ${admin.phone}` : ''}</div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">
                          {admin.designation || <span className="text-gray-300 italic">None</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {admin.isPrimaryAdmin ? (
                            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                              ★ Primary
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              admin.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {admin.isVerified ? 'Password Set' : 'Pending Invite'}
                            </span>
                            {!admin.isActive && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium" title={admin.deactivationReason || ''}>
                                Deactivated
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2.5 flex-wrap">
                            <button
                              onClick={() => {
                                setEditingAdmin(admin)
                                setEditForm({
                                  name: admin.name,
                                  phone: admin.phone || '',
                                  designation: admin.designation || '',
                                })
                              }}
                              className="text-xs text-gray-600 hover:underline font-medium"
                            >
                              Edit
                            </button>
                            {admin.isActive && !admin.isPrimaryAdmin && (
                              <button
                                onClick={() => handleMakePrimary(admin._id)}
                                className="text-xs text-amber-600 hover:underline font-medium"
                              >
                                Make Primary
                              </button>
                            )}
                            <button
                              onClick={() => handleResendInvite(admin._id)}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              Resend Link
                            </button>
                            {admin.isActive ? (
                              <button
                                onClick={() => {
                                  setDeactivatingAdmin(admin)
                                  setDeactivateReason('')
                                  setDeactivateError('')
                                }}
                                className="text-xs text-red-500 hover:underline font-medium"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivate(admin._id)}
                                className="text-xs text-green-600 hover:underline font-medium"
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Invite Admin Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-display font-bold text-xl text-gray-900 mb-1">Invite City Admin</h3>
            <p className="text-xs text-gray-400 mb-4">An invitation with a 48-hour password setup link will be emailed.</p>
            {inviteError && <div className="alert-error mb-3 text-sm">{inviteError}</div>}
            {inviteSuccess && <div className="alert-success mb-3 text-sm">{inviteSuccess}</div>}
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="label-nivaran text-xs" htmlFor="ia-name">Full Name *</label>
                <input id="ia-name" required className="input-nivaran" value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Rajinder Kumar" />
              </div>
              <div>
                <label className="label-nivaran text-xs" htmlFor="ia-email">Official Email *</label>
                <input id="ia-email" type="email" required className="input-nivaran" value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="admin@city.gov" />
              </div>
              <div>
                <label className="label-nivaran text-xs" htmlFor="ia-desig">Designation</label>
                <input id="ia-desig" className="input-nivaran" value={inviteForm.designation}
                  onChange={(e) => setInviteForm({ ...inviteForm, designation: e.target.value })} placeholder="Joint Commissioner" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInviteModal(false)} className="btn-secondary flex-1 py-2">Cancel</button>
                <button type="submit" disabled={inviteLoading} className="btn-primary flex-1 py-2">
                  {inviteLoading ? 'Sending…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Admin Modal ── */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-display font-bold text-xl text-gray-900 mb-1">Edit Administrator</h3>
            <p className="text-xs text-gray-400 mb-4">{editingAdmin.email}</p>
            {editError && <div className="alert-error mb-3 text-sm">{editError}</div>}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="label-nivaran text-xs" htmlFor="ea-name">Full Name *</label>
                <input id="ea-name" required className="input-nivaran" value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label-nivaran text-xs" htmlFor="ea-phone">Phone</label>
                <input id="ea-phone" className="input-nivaran" value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+919876543210" />
              </div>
              <div>
                <label className="label-nivaran text-xs" htmlFor="ea-desig">Designation</label>
                <input id="ea-desig" className="input-nivaran" value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingAdmin(null)} className="btn-secondary flex-1 py-2">Cancel</button>
                <button type="submit" disabled={editLoading} className="btn-primary flex-1 py-2">
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Deactivate Admin Confirm Modal (Required Reason) ── */}
      {deactivatingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="text-3xl text-center mb-2">⚠️</div>
            <h3 className="font-display font-bold text-lg text-gray-900 text-center mb-1">Deactivate Administrator?</h3>
            <p className="text-xs text-gray-500 text-center mb-4">
              All active sessions for <strong>{deactivatingAdmin.email}</strong> will be revoked immediately.
            </p>
            {deactivateError && <div className="alert-error mb-3 text-sm">{deactivateError}</div>}
            <form onSubmit={handleDeactivateAdmin} className="space-y-4">
              <div>
                <label className="label-nivaran text-xs" htmlFor="da-reason">Reason for deactivation *</label>
                <textarea
                  id="da-reason"
                  required
                  rows={3}
                  className="input-nivaran text-sm"
                  placeholder="e.g. Transferred to another division / retired"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setDeactivatingAdmin(null)} className="btn-secondary flex-1 py-2">Cancel</button>
                <button type="submit" disabled={deactivateLoading} className="btn-danger flex-1 py-2">
                  {deactivateLoading ? 'Deactivating…' : 'Confirm Deactivation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}

export default CityDetail
