import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'
import StatusBadge from '../../components/StatusBadge'

function AdminDisputes() {
  const navigate = useNavigate()
  const [disputes, setDisputes] = useState([])
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)

  // Action modal state
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [actionType, setActionType] = useState('reassign') // 'reassign' | 'mark_resolved' | 'escalate_further'
  const [note, setNote] = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState({ msg: '', error: '' })

  useEffect(() => {
    fetchDisputesAndStaff()
  }, [])

  const fetchDisputesAndStaff = async () => {
    try {
      setLoading(true)
      const [dispRes, staffRes] = await Promise.all([
        api.get('/api/reports/disputed'),
        api.get('/api/staff'),
      ])
      setDisputes(dispRes.data.reports || [])
      setStaffList(staffRes.data.staff || [])
    } catch (err) {
      console.error('Failed to load disputes:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAction = (ticket, type) => {
    setSelectedTicket(ticket)
    setActionType(type)
    setNote('')
    setSelectedStaffId(ticket.assignedTo?._id || '')
    setFeedback({ msg: '', error: '' })
  }

  const handleResolveSubmit = async (e) => {
    e.preventDefault()
    if (!note.trim()) {
      setFeedback({ msg: '', error: 'Please enter an admin note or justification' })
      return
    }

    setSubmitting(true)
    setFeedback({ msg: '', error: '' })

    try {
      const payload = {
        action: actionType,
        note: note.trim(),
        staffId: actionType === 'reassign' ? selectedStaffId : undefined,
      }

      await api.patch(`/api/reports/${selectedTicket._id}/resolve-dispute`, payload)
      setFeedback({ msg: `Dispute action '${actionType}' completed successfully!`, error: '' })

      setTimeout(() => {
        setSelectedTicket(null)
        fetchDisputesAndStaff()
      }, 1200)
    } catch (err) {
      setFeedback({
        msg: '',
        error: err.response?.data?.message || 'Failed to submit dispute resolution',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Citizen Dispute Review Queue
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Grievances filed by citizens challenging municipal staff resolution claims. Admin review provides unbiased oversight.
          </p>
        </div>

        {feedback.msg && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl font-bold">
            {feedback.msg}
          </div>
        )}

        {/* Dispute Cards / List */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Loading disputed reports...
          </div>
        ) : disputes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <span className="text-4xl block mb-2">🎉</span>
            <h3 className="text-base font-bold text-gray-800">Dispute Queue Clear</h3>
            <p className="text-xs text-gray-500 mt-1">
              There are currently no disputed ticket resolutions awaiting administrative action.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {disputes.map((ticket) => (
              <div
                key={ticket._id}
                className="bg-white rounded-2xl border border-orange-200/90 shadow-sm p-5 sm:p-6 space-y-4 hover:shadow-md transition"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200">
                      {ticket.ticketId}
                    </span>
                    <h3 className="font-bold text-gray-900 text-base">{ticket.category?.name}</h3>
                    <StatusBadge status={ticket.status} size="sm" />
                  </div>
                  <div className="text-xs text-gray-500">
                    Dept: <span className="font-semibold text-gray-800">{ticket.department?.name}</span>
                  </div>
                </div>

                {/* Citizen Dispute Reason Callout */}
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-1">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚠️ Citizen's Dispute Reason</span>
                    <span className="text-[11px] font-normal text-amber-700">
                      (Reported by {ticket.citizen?.name || 'Citizen'})
                    </span>
                  </p>
                  <p className="text-sm font-semibold text-amber-950">
                    "{ticket.disputeReason}"
                  </p>
                </div>

                {/* Before / After comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Original Issue Photo
                    </p>
                    {ticket.photoUrl ? (
                      <img
                        src={ticket.photoUrl}
                        alt="Before"
                        className="w-full h-36 object-cover rounded-xl border border-gray-200"
                      />
                    ) : (
                      <div className="w-full h-36 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                        No original photo
                      </div>
                    )}
                    <p className="text-gray-600 mt-1 line-clamp-2">{ticket.description}</p>
                  </div>

                  <div>
                    <p className="font-semibold text-green-700 uppercase tracking-wide mb-1">
                      Staff Resolution Proof
                    </p>
                    {ticket.resolutionPhotoUrl ? (
                      <img
                        src={ticket.resolutionPhotoUrl}
                        alt="Resolution proof"
                        className="w-full h-36 object-cover rounded-xl border border-green-200"
                      />
                    ) : (
                      <div className="w-full h-36 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                        No resolution photo
                      </div>
                    )}
                    <p className="text-green-900 mt-1 font-medium line-clamp-2">
                      {ticket.resolutionNote || 'No resolution note recorded'}
                    </p>
                  </div>
                </div>

                {/* Assigned Staff & Details */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                  <div>
                    <span>Assigned Staff: </span>
                    <span className="font-bold text-gray-900">
                      {ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned'}
                    </span>
                  </div>

                  {/* 3 Dispute Resolution Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Action 1: Reopen / Reassign */}
                    <button
                      onClick={() => handleOpenAction(ticket, 'reassign')}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition"
                    >
                      ↺ Reopen Work
                    </button>

                    {/* Action 2: Mark Resolved Anyway */}
                    <button
                      onClick={() => handleOpenAction(ticket, 'mark_resolved')}
                      className="bg-green-700 hover:bg-green-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition"
                    >
                      ✓ Mark Resolved Anyway
                    </button>

                    {/* Action 3: Escalate Further */}
                    <button
                      onClick={() => handleOpenAction(ticket, 'escalate_further')}
                      className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition"
                    >
                      🚨 Escalate Further
                    </button>

                    <button
                      onClick={() => navigate(`/admin/tickets/${ticket._id}`)}
                      className="text-gray-500 hover:text-gray-900 font-semibold text-xs px-2 py-1.5"
                    >
                      Full Details →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Dispute Action Modal ── */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                  Dispute Adjudication
                </span>
                <h3 className="font-bold text-gray-900 text-base">
                  {actionType === 'reassign' && 'Reopen & Reassign Ticket'}
                  {actionType === 'mark_resolved' && 'Override & Mark Resolved Anyway'}
                  {actionType === 'escalate_further' && 'Escalate Further for Senior Review'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl">
              <p>
                <strong>Ticket:</strong> {selectedTicket.ticketId} ({selectedTicket.category?.name})
              </p>
              <p className="mt-1">
                <strong>Citizen Dispute:</strong> "{selectedTicket.disputeReason}"
              </p>
            </div>

            {feedback.error && (
              <p className="text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-200">
                {feedback.error}
              </p>
            )}

            <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
              {/* Optional staff reassignment when reopening */}
              {actionType === 'reassign' && (
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    Assign To Staff (Keep Current or Reassign):
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">-- Keep Current Assignee --</option>
                    {staffList
                      .filter(
                        (s) =>
                          (s.department?._id || s.department) ===
                          (selectedTicket.department?._id || selectedTicket.department)
                      )
                      .map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({s.openTicketsCount} open tickets)
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Note / Justification */}
              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Admin Resolution Note / Justification <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    actionType === 'reassign'
                      ? 'e.g. Field inspection confirmed pothole was only partially filled. Reassigned for proper asphalt paving.'
                      : actionType === 'mark_resolved'
                      ? 'e.g. Reviewed before and after photos; work meets municipal sanitation code standards. Citizen dispute dismissed.'
                      : 'e.g. Structural issue requires executive engineering appraisal. Flagging for senior superintendent.'
                  }
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 text-white font-bold py-2.5 rounded-xl transition shadow ${
                    actionType === 'reassign'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : actionType === 'mark_resolved'
                      ? 'bg-green-700 hover:bg-green-800'
                      : 'bg-purple-700 hover:bg-purple-800'
                  }`}
                >
                  {submitting ? 'Processing...' : 'Confirm Action'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDisputes
