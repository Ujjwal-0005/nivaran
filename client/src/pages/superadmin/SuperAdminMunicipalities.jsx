import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import SuperAdminLayout from './SuperAdminLayout'

const TYPES = ['corporation', 'council', 'nagar_panchayat']
const TYPE_LABELS = { corporation: 'Municipal Corporation', council: 'Municipal Council', nagar_panchayat: 'Nagar Panchayat' }

const EMPTY_FORM = {
  name: '', nameLocal: '', state: '', type: 'council',
  lgdCode: '', centroidLat: '', centroidLng: '', defaultZoom: 13,
}

/**
 * /superadmin/municipalities
 * List all cities + Create / Edit / Deactivate / Activate / manage admins
 */
function SuperAdminMunicipalities() {
  const navigate = useNavigate()
  const [munis, setMunis] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 })
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('') // '', 'true', 'false'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create / Edit modal state
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // null = create, else muni doc
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErr, setFormErr] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formSuccess, setFormSuccess] = useState('')

  // Admins modal state
  const [adminsMuni, setAdminsMuni] = useState(null)
  const [admins, setAdmins] = useState([])
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [adminsErr, setAdminsErr] = useState('')
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  // Deactivate confirmation
  const [confirmMuni, setConfirmMuni] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const fetchMunis = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page, limit: 15 })
      if (search) params.set('search', search)
      if (activeFilter) params.set('active', activeFilter)
      const res = await api.get(`/api/superadmin/municipalities?${params}`)
      setMunis(res.data.data)
      setPagination(res.data.pagination)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load municipalities')
    } finally {
      setLoading(false)
    }
  }, [search, activeFilter])

  useEffect(() => { fetchMunis(1) }, [fetchMunis])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setFormErr('')
    setFormSuccess('')
    setShowForm(true)
  }

  const openEdit = (muni) => {
    setEditTarget(muni)
    setForm({
      name: muni.name,
      nameLocal: muni.nameLocal || '',
      state: muni.state,
      type: muni.type,
      lgdCode: muni.lgdCode || '',
      centroidLat: muni.centroid.lat,
      centroidLng: muni.centroid.lng,
      defaultZoom: muni.defaultZoom || 13,
    })
    setFormErr('')
    setFormSuccess('')
    setShowForm(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormErr('')
    setFormSuccess('')
    const lat = parseFloat(form.centroidLat)
    const lng = parseFloat(form.centroidLng)
    if (isNaN(lat) || isNaN(lng)) {
      setFormErr('Centroid latitude and longitude must be valid numbers.')
      return
    }

    const payload = {
      name: form.name.trim(),
      nameLocal: form.nameLocal.trim(),
      state: form.state.trim(),
      type: form.type,
      lgdCode: form.lgdCode.trim() || null,
      centroid: { lat, lng },
      defaultZoom: parseInt(form.defaultZoom) || 13,
    }

    setFormLoading(true)
    try {
      if (editTarget) {
        await api.put(`/api/superadmin/municipalities/${editTarget._id}`, payload)
        setFormSuccess('Municipality updated.')
      } else {
        await api.post('/api/superadmin/municipalities', payload)
        setFormSuccess('Municipality created and departments seeded.')
      }
      fetchMunis(pagination.page)
      setTimeout(() => setShowForm(false), 1500)
    } catch (err) {
      setFormErr(err.response?.data?.message || 'Failed to save municipality')
    } finally {
      setFormLoading(false)
    }
  }

  const toggleActive = async (muni) => {
    if (muni.isActive) {
      setConfirmMuni(muni)
    } else {
      setConfirmLoading(true)
      try {
        await api.patch(`/api/superadmin/municipalities/${muni._id}/activate`)
        fetchMunis(pagination.page)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to activate municipality')
      } finally {
        setConfirmLoading(false)
      }
    }
  }

  const confirmDeactivate = async () => {
    if (!confirmMuni) return
    setConfirmLoading(true)
    try {
      await api.patch(`/api/superadmin/municipalities/${confirmMuni._id}/deactivate`)
      setConfirmMuni(null)
      fetchMunis(pagination.page)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deactivate municipality')
    } finally {
      setConfirmLoading(false)
    }
  }

  const openAdmins = async (muni) => {
    setAdminsMuni(muni)
    setAdmins([])
    setAdminsErr('')
    setInviteMsg('')
    setInviteForm({ name: '', email: '' })
    setAdminsLoading(true)
    try {
      const res = await api.get(`/api/superadmin/municipalities/${muni._id}/admins`)
      setAdmins(res.data.data)
    } catch (err) {
      setAdminsErr(err.response?.data?.message || 'Failed to load admins')
    } finally {
      setAdminsLoading(false)
    }
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteMsg('')
    setAdminsErr('')
    setInviteLoading(true)
    try {
      const res = await api.post(`/api/superadmin/municipalities/${adminsMuni._id}/admins`, inviteForm)
      setInviteMsg(res.data.message)
      setInviteForm({ name: '', email: '' })
      const refreshed = await api.get(`/api/superadmin/municipalities/${adminsMuni._id}/admins`)
      setAdmins(refreshed.data.data)
      fetchMunis(pagination.page)
    } catch (err) {
      setAdminsErr(err.response?.data?.message || 'Failed to invite admin')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRevoke = async (uid) => {
    if (!window.confirm('Revoke this city admin? Their sessions will be invalidated.')) return
    try {
      await api.delete(`/api/superadmin/municipalities/${adminsMuni._id}/admins/${uid}`)
      const refreshed = await api.get(`/api/superadmin/municipalities/${adminsMuni._id}/admins`)
      setAdmins(refreshed.data.data)
      fetchMunis(pagination.page)
    } catch (err) {
      setAdminsErr(err.response?.data?.message || 'Failed to revoke admin')
    }
  }

  const handleResetPassword = async (uid) => {
    if (!window.confirm('Send a new set-password link to this admin?')) return
    try {
      const res = await api.post(`/api/superadmin/municipalities/${adminsMuni._id}/admins/${uid}/reset-password`)
      setInviteMsg(res.data.message)
    } catch (err) {
      setAdminsErr(err.response?.data?.message || 'Failed to reset password')
    }
  }

  return (
    <SuperAdminLayout title="Cities & Municipalities">
      {/* ── Toolbar ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          id="muni-search"
          type="text"
          placeholder="Search city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-nivaran flex-1 min-w-48"
        />
        <select
          id="muni-active-filter"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="input-nivaran w-auto"
        >
          <option value="">All statuses</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <button
          id="muni-create-btn"
          onClick={openCreate}
          className="btn-primary px-5 py-2 whitespace-nowrap"
        >
          + Add City
        </button>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}

      {/* ── Table ────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
      ) : munis.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No municipalities found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['City', 'State', 'Type', 'Admins', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {munis.map((m) => (
                <tr key={m._id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-sovereign-indigo">
                    {m.name}
                    {m.nameLocal && <span className="text-gray-400 ml-1 font-normal text-xs">({m.nameLocal})</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.state}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {TYPE_LABELS[m.type] || m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-center">{m.adminCount || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openAdmins(m)}
                        className="text-xs text-blue-600 hover:underline font-medium"
                        title="Manage city admins"
                      >
                        Admins
                      </button>
                      <button
                        onClick={() => openEdit(m)}
                        className="text-xs text-gray-600 hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(m)}
                        disabled={confirmLoading}
                        className={`text-xs font-medium hover:underline ${
                          m.isActive ? 'text-red-500' : 'text-green-600'
                        }`}
                      >
                        {m.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>
                Showing {(pagination.page - 1) * 15 + 1}–{Math.min(pagination.page * 15, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchMunis(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => fetchMunis(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-display font-bold text-sovereign-indigo text-lg">
                {editTarget ? 'Edit Municipality' : 'Add New City'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleFormSubmit} className="px-6 py-5 space-y-4" id="muni-form">
              {formErr && <div className="alert-error">{formErr}</div>}
              {formSuccess && <div className="alert-success">{formSuccess}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-nivaran" htmlFor="mf-name">City Name *</label>
                  <input id="mf-name" className="input-nivaran" required value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ludhiana" />
                </div>
                <div>
                  <label className="label-nivaran" htmlFor="mf-nameLocal">Local Name</label>
                  <input id="mf-nameLocal" className="input-nivaran" value={form.nameLocal}
                    onChange={(e) => setForm({ ...form, nameLocal: e.target.value })} placeholder="ਲੁਧਿਆਣਾ" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-nivaran" htmlFor="mf-state">State *</label>
                  <input id="mf-state" className="input-nivaran" required value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Punjab" />
                </div>
                <div>
                  <label className="label-nivaran" htmlFor="mf-type">Type *</label>
                  <select id="mf-type" className="input-nivaran" value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label-nivaran" htmlFor="mf-lgd">LGD Code (optional)</label>
                <input id="mf-lgd" className="input-nivaran" value={form.lgdCode}
                  onChange={(e) => setForm({ ...form, lgdCode: e.target.value })} placeholder="e.g. 12345" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-nivaran" htmlFor="mf-lat">Centroid Latitude *</label>
                  <input id="mf-lat" className="input-nivaran" type="number" step="any" required
                    value={form.centroidLat}
                    onChange={(e) => setForm({ ...form, centroidLat: e.target.value })} placeholder="31.3260" />
                </div>
                <div>
                  <label className="label-nivaran" htmlFor="mf-lng">Centroid Longitude *</label>
                  <input id="mf-lng" className="input-nivaran" type="number" step="any" required
                    value={form.centroidLng}
                    onChange={(e) => setForm({ ...form, centroidLng: e.target.value })} placeholder="75.5762" />
                </div>
              </div>

              <div>
                <label className="label-nivaran" htmlFor="mf-zoom">Default Zoom (1–18)</label>
                <input id="mf-zoom" className="input-nivaran" type="number" min="1" max="18"
                  value={form.defaultZoom}
                  onChange={(e) => setForm({ ...form, defaultZoom: e.target.value })} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1 py-2.5">Cancel</button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1 py-2.5" id="muni-form-submit">
                  {formLoading ? 'Saving…' : editTarget ? 'Save Changes' : 'Create City'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Deactivate Confirmation Modal ─────────── */}
      {confirmMuni && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="font-display font-bold text-xl text-gray-800 mb-2">Deactivate City?</h3>
            <p className="text-gray-500 text-sm mb-5">
              This will deactivate <strong>{confirmMuni.name}</strong>. Citizens will not be able to register
              or submit reports for this city. This can be reversed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmMuni(null)}
                className="btn-secondary flex-1 py-2.5">Cancel</button>
              <button onClick={confirmDeactivate} disabled={confirmLoading}
                className="btn-danger flex-1 py-2.5" id="confirm-deactivate">
                {confirmLoading ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── City Admins Modal ─────────────────────── */}
      {adminsMuni && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-sovereign-indigo text-lg">City Admins</h2>
                <p className="text-gray-400 text-xs mt-0.5">{adminsMuni.name}</p>
              </div>
              <button onClick={() => setAdminsMuni(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Invite form */}
              <form onSubmit={handleInvite} className="bg-blue-50 rounded-xl p-4 space-y-3" id="invite-admin-form">
                <h3 className="font-semibold text-blue-900 text-sm">Invite New City Admin</h3>
                {adminsErr && <div className="alert-error text-sm">{adminsErr}</div>}
                {inviteMsg && <div className="alert-success text-sm">{inviteMsg}</div>}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-nivaran text-xs" htmlFor="invite-name">Full Name *</label>
                    <input id="invite-name" className="input-nivaran" required
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                      placeholder="Rajinder Kumar" />
                  </div>
                  <div>
                    <label className="label-nivaran text-xs" htmlFor="invite-email">Email *</label>
                    <input id="invite-email" className="input-nivaran" type="email" required
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      placeholder="rajinder@city.gov" />
                  </div>
                </div>
                <button type="submit" disabled={inviteLoading}
                  className="btn-primary px-5 py-2 text-sm" id="invite-submit">
                  {inviteLoading ? 'Sending…' : 'Send Invite Email'}
                </button>
              </form>

              {/* Admins list */}
              {adminsLoading ? (
                <div className="text-center text-gray-400 py-4">Loading admins…</div>
              ) : admins.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No city admins yet for this municipality.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {admins.map((admin) => (
                    <div key={admin._id} className="py-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-sovereign-indigo/10 flex items-center justify-center text-sovereign-indigo font-bold text-sm">
                        {admin.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 text-sm truncate">{admin.name}</div>
                        <div className="text-gray-400 text-xs truncate">{admin.email}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          admin.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {admin.isVerified ? 'Active' : 'Pending'}
                        </span>
                        {!admin.isActive && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Revoked</span>
                        )}
                        <button
                          onClick={() => handleResetPassword(admin._id)}
                          className="text-xs text-blue-600 hover:underline font-medium"
                          title="Reset password (send new invite link)"
                        >
                          Reset Pwd
                        </button>
                        {admin.isActive && (
                          <button
                            onClick={() => handleRevoke(admin._id)}
                            className="text-xs text-red-500 hover:underline font-medium"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}

export default SuperAdminMunicipalities
