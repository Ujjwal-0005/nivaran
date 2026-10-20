import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../../utils/api'
import SuperAdminLayout from './SuperAdminLayout'

function SuperAdminAdmins() {
  const [admins, setAdmins] = useState([])
  const [cities, setCities] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [cityFilter, setCityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Action Modals
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', designation: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const [deactivatingAdmin, setDeactivatingAdmin] = useState(null)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [deactivateLoading, setDeactivateLoading] = useState(false)
  const [deactivateError, setDeactivateError] = useState('')

  const fetchCities = async () => {
    try {
      const res = await api.get('/api/superadmin/municipalities?limit=100')
      setCities(res.data.data || [])
    } catch (err) {
      console.error('Failed to load cities for filter:', err)
    }
  }

  const fetchAdmins = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (cityFilter) params.set('city', cityFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await api.get(`/api/superadmin/admins?${params}`)
      setAdmins(res.data.items || [])
      setPagination({
        page: res.data.page,
        limit: res.data.limit,
        total: res.data.total,
        totalPages: res.data.totalPages,
      })
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load administrators')
    } finally {
      setLoading(false)
    }
  }, [cityFilter, statusFilter])

  useEffect(() => {
    fetchCities()
  }, [])

  useEffect(() => {
    fetchAdmins(1)
  }, [fetchAdmins])

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditLoading(true)
    setEditError('')
    try {
      await api.patch(`/api/superadmin/admins/${editingAdmin._id}`, editForm)
      setEditingAdmin(null)
      fetchAdmins(pagination.page)
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update admin')
    } finally {
      setEditLoading(false)
    }
  }

  const handleMakePrimary = async (adminId) => {
    if (!window.confirm('Designate this admin as primary administrator for their municipality?')) return
    try {
      await api.post(`/api/superadmin/admins/${adminId}/make-primary`)
      fetchAdmins(pagination.page)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to set primary admin')
    }
  }

  const handleReactivate = async (adminId) => {
    if (!window.confirm('Reactivate this administrator account?')) return
    try {
      await api.post(`/api/superadmin/admins/${adminId}/reactivate`)
      fetchAdmins(pagination.page)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reactivate admin')
    }
  }

  const handleResendInvite = async (admin) => {
    if (!window.confirm('Resend invite/password setup link to this admin?')) return
    try {
      const muniId = admin.municipality?._id || admin.municipality
      const res = await api.post(`/api/superadmin/municipalities/${muniId}/admins/${admin._id}/reset-password`)
      alert(res.data.message)
      fetchAdmins(pagination.page)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resend invite')
    }
  }

  const handleDeactivate = async (e) => {
    e.preventDefault()
    if (!deactivateReason.trim()) {
      setDeactivateError('Reason is required')
      return
    }
    setDeactivateLoading(true)
    setDeactivateError('')
    try {
      const muniId = deactivatingAdmin.municipality?._id || deactivatingAdmin.municipality
      await api.delete(`/api/superadmin/municipalities/${muniId}/admins/${deactivatingAdmin._id}`, {
        data: { reason: deactivateReason.trim() },
      })
      setDeactivatingAdmin(null)
      setDeactivateReason('')
      fetchAdmins(pagination.page)
    } catch (err) {
      setDeactivateError(err.response?.data?.message || 'Failed to deactivate admin')
    } finally {
      setDeactivateLoading(false)
    }
  }

  return (
    <SuperAdminLayout title="City Administrators">
      {/* ── Toolbar ──────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          id="admin-city-filter"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="input-nivaran w-auto flex-1 min-w-48"
        >
          <option value="">All Cities</option>
          {cities.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name} ({c.state})
            </option>
          ))}
        </select>

        <select
          id="admin-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-nivaran w-auto"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending Invite</option>
          <option value="inactive">Deactivated</option>
        </select>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}

      {/* ── Admins Table ─────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Loading administrators…</div>
      ) : admins.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No administrators found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100 font-medium">
                <tr>
                  <th className="px-5 py-3">Administrator</th>
                  <th className="px-5 py-3">City</th>
                  <th className="px-5 py-3">Designation</th>
                  <th className="px-5 py-3">Primary</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admins.map((admin) => (
                  <tr key={admin._id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-gray-900">{admin.name}</div>
                      <div className="text-xs text-gray-400">{admin.email} {admin.phone ? `· ${admin.phone}` : ''}</div>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">
                      {admin.municipality?.name ? (
                        <Link to={`/superadmin/municipalities/${admin.municipality._id}`} className="hover:underline text-sovereign-indigo">
                          {admin.municipality.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
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
                          {admin.isVerified ? 'Active' : 'Pending'}
                        </span>
                        {!admin.isActive && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                            Deactivated
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
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
                          onClick={() => handleResendInvite(admin)}
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

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
              <span>
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchAdmins(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => fetchAdmins(pagination.page + 1)}
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

      {/* ── Edit Admin Modal ── */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-display font-bold text-xl text-gray-900 mb-1">Edit Administrator</h3>
            <p className="text-xs text-gray-400 mb-4">{editingAdmin.email}</p>
            {editError && <div className="alert-error mb-3 text-sm">{editError}</div>}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="label-nivaran text-xs" htmlFor="ea-name-all">Full Name *</label>
                <input id="ea-name-all" required className="input-nivaran" value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label-nivaran text-xs" htmlFor="ea-phone-all">Phone</label>
                <input id="ea-phone-all" className="input-nivaran" value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+919876543210" />
              </div>
              <div>
                <label className="label-nivaran text-xs" htmlFor="ea-desig-all">Designation</label>
                <input id="ea-desig-all" className="input-nivaran" value={editForm.designation}
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
            <form onSubmit={handleDeactivate} className="space-y-4">
              <div>
                <label className="label-nivaran text-xs" htmlFor="da-reason-all">Reason for deactivation *</label>
                <textarea
                  id="da-reason-all"
                  required
                  rows={3}
                  className="input-nivaran text-sm"
                  placeholder="e.g. Resigned / Transferred"
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

export default SuperAdminAdmins
