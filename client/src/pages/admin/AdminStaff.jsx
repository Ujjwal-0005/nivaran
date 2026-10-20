import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'
import StatusBadge from '../../components/StatusBadge'

function AdminStaff() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('pending')
  const [applications, setApplications] = useState([])
  const [approvedStaff, setApprovedStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [staffTickets, setStaffTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [revokeReason, setRevokeReason] = useState('')
  const [actionStaffId, setActionStaffId] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (activeTab === 'approved') {
      fetchApprovedStaff()
    } else {
      fetchApplications()
    }
  }, [activeTab, page, searchTerm])

  const fetchApplications = async () => {
    try {
      setLoading(true)
      const status = activeTab === 'pending' ? 'pending' : 'rejected'
      const res = await api.get('/api/staff/applications', {
        params: { status, search: searchTerm, page, limit: 20 },
      })
      setApplications(res.data.items || [])
      setTotal(res.data.total || 0)
      
      // Fetch pending count for badge
      const pendingRes = await api.get('/api/staff/applications', {
        params: { status: 'pending', limit: 1 },
      })
      setPendingCount(pendingRes.data.total || 0)
    } catch (err) {
      console.error('Error fetching applications:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchApprovedStaff = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/staff/applications', {
        params: { status: 'approved', search: searchTerm, page, limit: 20 },
      })
      setApprovedStaff(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      console.error('Error fetching approved staff:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id, newDepartmentId) => {
    try {
      const body = newDepartmentId ? { department: newDepartmentId } : {}
      await api.post(`/api/staff/applications/${id}/approve`, body)
      fetchApplications()
      if (activeTab === 'pending') {
        setPendingCount(Math.max(0, pendingCount - 1))
      }
    } catch (err) {
      console.error('Error approving application:', err)
      alert('Failed to approve application')
    }
  }

  const handleReject = async () => {
    if (!rejectReason || rejectReason.trim().length < 10) {
      alert('Rejection reason must be at least 10 characters')
      return
    }
    try {
      await api.post(`/api/staff/applications/${actionStaffId}/reject`, { reason: rejectReason })
      setShowRejectDialog(false)
      setRejectReason('')
      setActionStaffId(null)
      fetchApplications()
      setPendingCount(Math.max(0, pendingCount - 1))
    } catch (err) {
      console.error('Error rejecting application:', err)
      alert('Failed to reject application')
    }
  }

  const handleRevoke = async () => {
    if (!revokeReason || !revokeReason.trim()) {
      alert('Revocation reason is required')
      return
    }
    try {
      const res = await api.post(`/api/staff/${actionStaffId}/revoke`, { reason: revokeReason })
      setShowRevokeDialog(false)
      setRevokeReason('')
      setActionStaffId(null)
      fetchApprovedStaff()
      alert(`Staff revoked. ${res.data.releasedTickets} tickets released.`)
    } catch (err) {
      console.error('Error revoking staff:', err)
      alert('Failed to revoke staff')
    }
  }

  const handleReconsider = async (id) => {
    try {
      await api.post(`/api/staff/applications/${id}/reconsider`)
      fetchApplications()
    } catch (err) {
      console.error('Error reconsidering application:', err)
      alert('Failed to reconsider application')
    }
  }

  const handleSelectStaff = async (staff) => {
    setSelectedStaff(staff)
    try {
      setLoadingTickets(true)
      const res = await api.get(`/api/staff/${staff._id}/tickets`)
      setStaffTickets(res.data.tickets || [])
    } catch (err) {
      console.error('Error fetching staff tickets:', err)
    } finally {
      setLoadingTickets(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Staff Applications</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Review and manage government staff applications for your municipality.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg">
          <button
            onClick={() => { setActiveTab('pending'); setPage(1); }}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'pending'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending {pendingCount > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('approved'); setPage(1); }}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'approved'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => { setActiveTab('rejected'); setPage(1); }}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === 'rejected'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Rejected
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search by name, email, employee ID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Applications List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-10 text-center text-gray-400">Loading...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Name & Email</th>
                      <th className="py-3 px-4">Employee ID</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Designation</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Applied Date</th>
                      {activeTab !== 'pending' && <th className="py-3 px-4">Reviewed Date</th>}
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(activeTab === 'approved' ? approvedStaff : applications).length === 0 ? (
                      <tr>
                        <td colSpan="8" className="py-10 text-center text-gray-400">
                          No {activeTab} applications found.
                        </td>
                      </tr>
                    ) : (
                      (activeTab === 'approved' ? approvedStaff : applications).map((app) => (
                        <tr key={app._id} className="hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <p className="font-bold text-gray-900">{app.name}</p>
                            <p className="text-[11px] text-gray-400">{app.email}</p>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">{app.employeeId || 'N/A'}</td>
                          <td className="py-3 px-4">
                            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-medium">
                              {app.department?.name || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs">{app.designation || 'N/A'}</td>
                          <td className="py-3 px-4 text-xs">{app.phone || 'N/A'}</td>
                          <td className="py-3 px-4 text-xs">{formatDate(app.appliedAt)}</td>
                          {activeTab !== 'pending' && (
                            <td className="py-3 px-4 text-xs">{formatDate(app.reviewedAt)}</td>
                          )}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              {activeTab === 'pending' && (
                                <>
                                  <button
                                    onClick={() => handleApprove(app._id)}
                                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => { setActionStaffId(app._id); setShowRejectDialog(true); }}
                                    className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {activeTab === 'approved' && (
                                <>
                                  <button
                                    onClick={() => handleSelectStaff(app)}
                                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition"
                                  >
                                    View Tickets
                                  </button>
                                  <button
                                    onClick={() => { setActionStaffId(app._id); setShowRevokeDialog(true); }}
                                    className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition"
                                  >
                                    Revoke
                                  </button>
                                </>
                              )}
                              {activeTab === 'rejected' && (
                                <button
                                  onClick={() => handleReconsider(app._id)}
                                  className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition"
                                >
                                  Reconsider
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > 20 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {Math.ceil(total / 20)}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(Math.ceil(total / 20), page + 1))}
                    disabled={page >= Math.ceil(total / 20)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Staff Ticket History Panel (Approved tab only) */}
        {activeTab === 'approved' && selectedStaff && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-base">{selectedStaff.name}</h3>
                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-semibold">
                  {selectedStaff.department?.name || 'Department'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{selectedStaff.email}</p>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">
                Assigned Tickets ({staffTickets.length})
              </h4>
            </div>

            {loadingTickets ? (
              <p className="text-xs text-gray-400 py-6 text-center">Loading ticket history...</p>
            ) : staffTickets.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">
                No tickets currently or previously assigned to this staff member.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {staffTickets.map((t) => (
                  <div
                    key={t._id}
                    onClick={() => navigate(`/admin/tickets/${t._id}`)}
                    className="p-3 bg-gray-50 hover:bg-orange-50/50 border border-gray-100 rounded-xl cursor-pointer transition text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-gray-900">{t.ticketId}</span>
                      <StatusBadge status={t.status} size="sm" />
                    </div>
                    <p className="font-medium text-gray-800 truncate">{t.category?.name}</p>
                    <p className="text-gray-500 line-clamp-1 text-[11px]">{t.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Reject Application</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason (min 10 characters)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows="4"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => { setShowRejectDialog(false); setRejectReason(''); setActionStaffId(null); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Dialog */}
      {showRevokeDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Revoke Staff Access</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will immediately log out the staff member and return their open tickets to the unassigned pool.
            </p>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Enter revocation reason"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows="3"
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => { setShowRevokeDialog(false); setRevokeReason(''); setActionStaffId(null); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminStaff
