import { useState, useEffect } from 'react'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'

function AdminDepartments() {
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  // Feedback states
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Modals / forms
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [deptForm, setDeptForm] = useState({ id: null, name: '', description: '' })

  const [showCatModal, setShowCatModal] = useState(false)
  const [catForm, setCatForm] = useState({
    id: null,
    name: '',
    department: '',
    severityWeight: 5,
    slaHours: 48,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [deptRes, catRes] = await Promise.all([
        api.get('/api/departments'),
        api.get('/api/categories'),
      ])
      setDepartments(deptRes.data.departments || [])
      setCategories(catRes.data.categories || [])
    } catch (err) {
      console.error('Failed to load depts and categories:', err)
      setError('Failed to fetch departments and categories')
    } finally {
      setLoading(false)
    }
  }

  // Department Save
  const handleSaveDept = async (e) => {
    e.preventDefault()
    setError('')
    setMsg('')
    try {
      if (deptForm.id) {
        await api.patch(`/api/departments/${deptForm.id}`, {
          name: deptForm.name,
          description: deptForm.description,
        })
        setMsg('Department updated successfully!')
      } else {
        await api.post('/api/departments', {
          name: deptForm.name,
          description: deptForm.description,
        })
        setMsg('Department created successfully!')
      }
      setShowDeptModal(false)
      setDeptForm({ id: null, name: '', description: '' })
      fetchData()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save department')
    }
  }

  // Category Save
  const handleSaveCat = async (e) => {
    e.preventDefault()
    setError('')
    setMsg('')
    try {
      if (catForm.id) {
        await api.patch(`/api/categories/${catForm.id}`, {
          name: catForm.name,
          department: catForm.department,
          severityWeight: Number(catForm.severityWeight),
          slaHours: Number(catForm.slaHours),
        })
        setMsg('Category updated successfully!')
      } else {
        await api.post('/api/categories', {
          name: catForm.name,
          department: catForm.department,
          severityWeight: Number(catForm.severityWeight),
          slaHours: Number(catForm.slaHours),
        })
        setMsg('Category created successfully!')
      }
      setShowCatModal(false)
      setCatForm({ id: null, name: '', department: '', severityWeight: 5, slaHours: 48 })
      fetchData()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save category')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Departments & Categories Configuration
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Manage municipal jurisdictions, category routing, algorithm severity weights, and SLA target deadlines.
          </p>
        </div>

        {msg && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl font-semibold">
            {msg}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        {/* ── Section 1: Categories ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Issue Categories ({categories.length})</h2>
              <p className="text-xs text-gray-400">
                Determines ticket routing, severity weight (1-10) for prioritization, and SLA target hours.
              </p>
            </div>
            <button
              onClick={() => {
                setCatForm({
                  id: null,
                  name: '',
                  department: departments[0]?._id || '',
                  severityWeight: 5,
                  slaHours: 48,
                })
                setShowCatModal(true)
              }}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
            >
              + Add New Category
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Assigned Department</th>
                  <th className="py-3 px-4 text-center">Severity Weight</th>
                  <th className="py-3 px-4 text-center">SLA Target</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-gray-400">
                      Loading categories...
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c._id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3 px-4 font-bold text-gray-900">{c.name}</td>
                      <td className="py-3 px-4">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded font-semibold">
                          {c.department?.name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-gray-800">{c.severityWeight || 1} / 10</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-orange-50 text-orange-800 border border-orange-200 font-bold text-xs px-2 py-0.5 rounded">
                          {c.slaHours || 48} Hours
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setCatForm({
                              id: c._id,
                              name: c.name,
                              department: c.department?._id || c.department,
                              severityWeight: c.severityWeight || 5,
                              slaHours: c.slaHours || 48,
                            })
                            setShowCatModal(true)
                          }}
                          className="text-orange-600 font-bold text-xs hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Section 2: Departments ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Municipal Departments ({departments.length})</h2>
              <p className="text-xs text-gray-400">
                Administrative divisions managing specific field operations and staff members.
              </p>
            </div>
            <button
              onClick={() => {
                setDeptForm({ id: null, name: '', description: '' })
                setShowDeptModal(true)
              }}
              className="bg-gray-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition"
            >
              + Add Department
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-gray-400">
                      Loading departments...
                    </td>
                  </tr>
                ) : (
                  departments.map((d) => (
                    <tr key={d._id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3 px-4 font-bold text-gray-900">{d.name}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{d.description || '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setDeptForm({ id: d._id, name: d.name, description: d.description || '' })
                            setShowDeptModal(true)
                          }}
                          className="text-gray-700 font-bold text-xs hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Category Modal ── */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">
                {catForm.id ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                onClick={() => setShowCatModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCat} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  placeholder="e.g. Water Pipeline Leak"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Assigned Department</label>
                <select
                  required
                  value={catForm.department}
                  onChange={(e) => setCatForm({ ...catForm, department: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">-- Choose Department --</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    Severity Weight (1 - 10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={catForm.severityWeight}
                    onChange={(e) => setCatForm({ ...catForm, severityWeight: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-[10px] text-gray-400">Higher = more urgent</span>
                </div>

                <div>
                  <label className="font-semibold text-gray-700 block mb-1">
                    SLA Hours (Resolution)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={catForm.slaHours}
                    onChange={(e) => setCatForm({ ...catForm, slaHours: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-[10px] text-gray-400">Target hours to resolve</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl transition shadow"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Department Modal ── */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base">
                {deptForm.id ? 'Edit Department' : 'Create Department'}
              </h3>
              <button
                onClick={() => setShowDeptModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g. Sanitation & Waste"
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Description</label>
                <textarea
                  rows="3"
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Brief description of municipal duties..."
                  className="w-full border border-gray-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gray-900 hover:bg-black text-white font-bold py-2.5 rounded-xl transition shadow"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDepartments
