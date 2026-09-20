import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'
import StatusBadge from '../../components/StatusBadge'

function AdminStaff() {
  const navigate = useNavigate()
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [staffTickets, setStaffTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const res = await api.get('/api/staff')
      setStaffList(res.data.staff || [])
    } catch (err) {
      console.error('Error fetching staff list:', err)
    } finally {
      setLoading(false)
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Staff Management & Workloads</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Overview of department staff capacity, live assigned ticket loads, resolution rates, and ratings.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Staff Table (Left 2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-bold text-sm text-gray-800">
                Staff Directory ({staffList.length})
              </span>
              <span className="text-xs text-gray-400">Click a staff member to view full ticket history</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Name & Email</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Open Assigned</th>
                    <th className="py-3 px-4 text-center">Total Resolved</th>
                    <th className="py-3 px-4 text-center">Avg Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-gray-400">
                        Loading staff roster...
                      </td>
                    </tr>
                  ) : staffList.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-10 text-center text-gray-400">
                        No staff accounts found in the database.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((s) => {
                      const isSelected = selectedStaff?._id === s._id
                      return (
                        <tr
                          key={s._id}
                          onClick={() => handleSelectStaff(s)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-orange-50/80 border-l-4 border-orange-500'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <p className="font-bold text-gray-900">{s.name}</p>
                            <p className="text-[11px] text-gray-400">{s.email}</p>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-medium">
                              {s.department?.name || 'General'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span
                              className={`inline-block font-bold text-xs px-2.5 py-0.5 rounded-full ${
                                s.openTicketsCount > 5
                                  ? 'bg-red-100 text-red-700'
                                  : s.openTicketsCount > 2
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {s.openTicketsCount}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-semibold text-gray-800 whitespace-nowrap">
                            {s.totalResolved}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {s.averageRating ? (
                              <span className="font-bold text-amber-600 flex items-center justify-center gap-1">
                                ⭐ {s.averageRating}{' '}
                                <span className="text-[10px] text-gray-400">({s.ratedCount})</span>
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">No ratings</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Staff Ticket History (Right 1 col) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            {selectedStaff ? (
              <>
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
              </>
            ) : (
              <div className="py-16 text-center text-gray-400 text-xs space-y-2">
                <span className="text-3xl block">👤</span>
                <p>Select a staff member on the left to inspect their complete ticket history and workload performance.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminStaff
