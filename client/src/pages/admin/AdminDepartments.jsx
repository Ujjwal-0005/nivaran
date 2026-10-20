import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../utils/api'
import AdminNavbar from '../../components/AdminNavbar'

const SECTORS_LIST = [
  { key: 'ROADS', displayName: 'Roads & Footpaths' },
  { key: 'WATER', displayName: 'Water Supply' },
  { key: 'SEWERAGE', displayName: 'Sewerage & Drainage' },
  { key: 'STREET_LIGHTING', displayName: 'Street Lighting' },
  { key: 'ELECTRICITY', displayName: 'Electricity' },
  { key: 'SOLID_WASTE', displayName: 'Solid Waste & Sanitation' },
  { key: 'PARKS', displayName: 'Parks & Horticulture' },
  { key: 'TRAFFIC_ENFORCEMENT', displayName: 'Traffic Enforcement' },
  { key: 'PUBLIC_HEALTH', displayName: 'Public Health' },
  { key: 'ANIMAL', displayName: 'Animal Control' },
  { key: 'ENFORCEMENT', displayName: 'Municipal Enforcement' },
]

const AGENCY_TYPES = [
  { value: 'municipal', label: 'Municipal Wing' },
  { value: 'state_dept', label: 'State Department' },
  { value: 'utility', label: 'Utility Board' },
  { value: 'police', label: 'Police / Law Enforcement' },
  { value: 'other', label: 'Other External Agency' },
]

function AdminDepartments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'departments') // 'departments' | 'categories'

  const [departments, setDepartments] = useState([])
  const [activeDepartmentsList, setActiveDepartmentsList] = useState([])
  const [categorySettings, setCategorySettings] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCats, setLoadingCats] = useState(false)
  const [total, setTotal] = useState(0)

  // Filters for Departments
  const [sectorFilter, setSectorFilter] = useState(searchParams.get('sector') || '')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
  const [activeFilter, setActiveFilter] = useState(searchParams.get('active') || '')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [page, setPage] = useState(1)
  const limit = 50

  // Category search filter
  const [categorySearch, setCategorySearch] = useState('')

  // Feedback notifications
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Modals & Forms for Department
  const [showFormModal, setShowFormModal] = useState(false)
  const [editingDept, setEditingDept] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [formData, setFormData] = useState({
    name: '',
    sector: 'ROADS',
    agencyType: 'municipal',
    agencyCode: '',
    description: '',
    notes: '',
    helplinePhone: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    officeHours: '',
  })

  // Modals & Forms for Category Settings
  const [showCatSettingsModal, setShowCatSettingsModal] = useState(false)
  const [selectedCatSetting, setSelectedCatSetting] = useState(null)
  const [catFormErrors, setCatFormErrors] = useState({})
  const [catFormData, setCatFormData] = useState({
    isEnabled: true,
    severityOverride: '',
    slaHoursOverride: '',
    routeToDepartment: '',
  })
  const [catSaving, setCatSaving] = useState(false)

  // Confirmation Modals
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    actionType: '',
    deptId: null,
    deptName: '',
    categoryId: null,
  })

  useEffect(() => {
    fetchDepartments()
    fetchActiveDepartmentsForSelect()
  }, [sectorFilter, typeFilter, activeFilter, searchQuery, page])

  useEffect(() => {
    fetchCategorySettings()
  }, [])

  const fetchActiveDepartmentsForSelect = async () => {
    try {
      const res = await api.get('/api/admin/departments', { params: { isActive: true, limit: 100 } })
      setActiveDepartmentsList(res.data.items || [])
    } catch (err) {
      console.error('Error fetching active departments for select:', err)
    }
  }

  const fetchCategorySettings = async () => {
    try {
      setLoadingCats(true)
      const res = await api.get('/api/admin/category-settings')
      setCategorySettings(res.data.settings || [])
    } catch (err) {
      console.error('Error fetching category settings:', err)
    } finally {
      setLoadingCats(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      setLoading(true)
      setError('')
      const params = { page, limit }
      if (sectorFilter) params.sector = sectorFilter
      if (typeFilter === 'external') params.isExternal = true
      if (typeFilter === 'municipal') params.isExternal = false
      if (activeFilter !== '') params.isActive = activeFilter === 'true'
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await api.get('/api/admin/departments', { params })
      setDepartments(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch (err) {
      console.error('Error fetching departments:', err)
      setError(err.response?.data?.message || 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingDept(null)
    setFormData({
      name: '',
      sector: 'ROADS',
      agencyType: 'municipal',
      agencyCode: '',
      description: '',
      notes: '',
      helplinePhone: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      officeHours: '',
    })
    setFormErrors({})
    setShowFormModal(true)
  }

  const openEditModal = (dept) => {
    setEditingDept(dept)
    setFormData({
      name: dept.name || '',
      sector: dept.sector || 'ROADS',
      agencyType: dept.agencyType || 'municipal',
      agencyCode: dept.agencyCode || '',
      description: dept.description || '',
      notes: dept.notes || '',
      helplinePhone: dept.contact?.helplinePhone || '',
      phone: dept.contact?.phone || '',
      email: dept.contact?.email || '',
      website: dept.contact?.website || '',
      address: dept.contact?.address || '',
      officeHours: dept.contact?.officeHours || '',
    })
    setFormErrors({})
    setShowFormModal(true)
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.name.trim() || formData.name.trim().length < 2 || formData.name.trim().length > 80) {
      errors.name = 'Name must be between 2 and 80 characters'
    }
    if (!formData.sector) {
      errors.sector = 'Sector is required'
    }
    if (formData.agencyCode && !/^[A-Z0-9-]+$/.test(formData.agencyCode.trim().toUpperCase())) {
      errors.agencyCode = 'Agency Code may only contain uppercase letters, numbers, and hyphens'
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Invalid email address format'
    }
    if (formData.notes && formData.notes.length > 500) {
      errors.notes = 'Notes cannot exceed 500 characters'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveDepartment = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setMsg('')
    setError('')

    const payload = {
      name: formData.name.trim(),
      sector: formData.sector,
      agencyType: formData.agencyType,
      agencyCode: formData.agencyCode.trim() ? formData.agencyCode.trim().toUpperCase() : null,
      description: formData.description.trim(),
      notes: formData.notes.trim(),
      contact: {
        helplinePhone: formData.helplinePhone.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        website: formData.website.trim(),
        address: formData.address.trim(),
        officeHours: formData.officeHours.trim(),
      },
    }

    try {
      if (editingDept) {
        const res = await api.patch(`/api/admin/departments/${editingDept._id}`, payload)
        setMsg(res.data.notice ? `Department updated. ${res.data.notice}` : 'Department updated successfully!')
      } else {
        await api.post('/api/admin/departments', payload)
        setMsg('Department created successfully!')
      }
      setShowFormModal(false)
      fetchDepartments()
      fetchActiveDepartmentsForSelect()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save department')
    }
  }

  // Set as Primary Action
  const promptSetPrimary = (dept) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Set as Primary Department',
      message: `Set "${dept.name}" as the primary department for sector "${dept.sectorDisplayName || dept.sector}"? Any existing primary for this sector will be replaced.`,
      actionType: 'set-primary',
      deptId: dept._id,
      deptName: dept.name,
    })
  }

  const promptDeactivate = (dept) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Deactivate Department',
      message: `Are you sure you want to deactivate "${dept.name}"? If this department has open reports or assigned staff, deactivation will be blocked.`,
      actionType: 'deactivate',
      deptId: dept._id,
      deptName: dept.name,
    })
  }

  const handleConfirmAction = async () => {
    const { actionType, deptId, categoryId } = confirmDialog
    setConfirmDialog({ isOpen: false, title: '', message: '', actionType: '', deptId: null, deptName: '', categoryId: null })
    setMsg('')
    setError('')

    try {
      if (actionType === 'set-primary') {
        const res = await api.post(`/api/admin/departments/${deptId}/set-primary`)
        setMsg(res.data.message || 'Primary department set successfully!')
        fetchDepartments()
      } else if (actionType === 'deactivate') {
        const res = await api.post(`/api/admin/departments/${deptId}/deactivate`)
        setMsg(res.data.message || 'Department deactivated successfully!')
        fetchDepartments()
        fetchActiveDepartmentsForSelect()
      } else if (actionType === 'activate') {
        const res = await api.post(`/api/admin/departments/${deptId}/activate`)
        setMsg(res.data.message || 'Department activated successfully!')
        fetchDepartments()
        fetchActiveDepartmentsForSelect()
      } else if (actionType === 'reset-category') {
        const res = await api.delete(`/api/admin/category-settings/${categoryId}`)
        setMsg(res.data.message || 'Category settings reset to defaults')
        fetchCategorySettings()
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed')
    }
  }

  const handleToggleVerify = async (dept) => {
    setMsg('')
    setError('')
    try {
      const res = await api.post(`/api/admin/departments/${dept._id}/verify`, {
        verified: !dept.verified,
      })
      setMsg(res.data.message || 'Verification status updated')
      fetchDepartments()
    } catch (err) {
      setError(err.response?.data?.message || 'Verification update failed')
    }
  }

  // ── Category Settings Handlers ──
  const openEditCategoryModal = (cat) => {
    setSelectedCatSetting(cat)
    setCatFormData({
      isEnabled: cat.isEnabled !== false,
      severityOverride: cat.severityOverride !== null ? String(cat.severityOverride) : '',
      slaHoursOverride: cat.slaHoursOverride !== null ? String(cat.slaHoursOverride) : '',
      routeToDepartment: cat.routeToDepartment?._id || '',
    })
    setCatFormErrors({})
    setShowCatSettingsModal(true)
  }

  const handleSaveCategorySettings = async (e) => {
    e.preventDefault()
    if (!selectedCatSetting) return

    const errors = {}
    if (catFormData.severityOverride !== '') {
      const s = Number(catFormData.severityOverride)
      if (!Number.isInteger(s) || s < 1 || s > 10) {
        errors.severityOverride = 'Severity override must be an integer between 1 and 10'
      }
    }
    if (catFormData.slaHoursOverride !== '') {
      const h = Number(catFormData.slaHoursOverride)
      if (!Number.isInteger(h) || h < 1 || h > 720) {
        errors.slaHoursOverride = 'SLA hours override must be a positive integer up to 720'
      }
    }
    if (Object.keys(errors).length > 0) {
      setCatFormErrors(errors)
      return
    }

    // Check if disabling -> confirm warning
    if (selectedCatSetting.isEnabled && !catFormData.isEnabled) {
      const confirmed = window.confirm(
        'Citizens in your city will no longer be able to report this category. Existing reports are not affected. Proceed?'
      )
      if (!confirmed) return
    }

    setCatSaving(true)
    setCatFormErrors({})

    const payload = {
      isEnabled: catFormData.isEnabled,
      severityOverride: catFormData.severityOverride !== '' ? Number(catFormData.severityOverride) : null,
      slaHoursOverride: catFormData.slaHoursOverride !== '' ? Number(catFormData.slaHoursOverride) : null,
      routeToDepartment: catFormData.routeToDepartment ? catFormData.routeToDepartment : null,
    }

    try {
      await api.put(`/api/admin/category-settings/${selectedCatSetting.categoryId}`, payload)
      setMsg(`Settings for "${selectedCatSetting.name}" updated successfully!`)
      setShowCatSettingsModal(false)
      fetchCategorySettings()
    } catch (err) {
      setCatFormErrors({
        server: err.response?.data?.message || 'Failed to update category settings',
      })
    } finally {
      setCatSaving(false)
    }
  }

  const promptResetCategory = (cat) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Category Settings',
      message: `Reset all custom settings for "${cat.name}" back to national defaults? Any overrides will be deleted.`,
      actionType: 'reset-category',
      categoryId: cat.categoryId,
      deptName: cat.name,
    })
  }

  const filteredCategories = categorySettings.filter((c) => {
    if (!categorySearch.trim()) return true
    const q = categorySearch.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.sector && c.sector.toLowerCase().includes(q))
    )
  })

  return (
    <div className="page-shell flex flex-col">
      <AdminNavbar />

      <main className="flex-1 page-content-wide space-y-6">
        {/* Header Title & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-sovereign-indigo tracking-tight">
              City Operations Configuration
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure municipal wings, state agencies, primary routing, and city category tuning.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {activeTab === 'departments' && (
              <button
                onClick={openCreateModal}
                className="btn-kesariya text-xs sm:text-sm flex items-center justify-center gap-1.5"
              >
                <span>+</span> Add Department / Agency
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('departments')}
            className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'departments'
                ? 'border-kesariya text-kesariya bg-kesariya/5 rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>🏛️ Departments & Agencies</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
              {departments.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'categories'
                ? 'border-kesariya text-kesariya bg-kesariya/5 rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>🏷️ Category Settings (City Tuning)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
              {categorySettings.length}
            </span>
          </button>
        </div>

        {/* Alerts */}
        {msg && (
          <div className="p-3 bg-jan-kalyan-green/10 border border-jan-kalyan-green/30 text-jan-kalyan-green text-xs rounded-xl font-semibold flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        )}
        {error && (
          <div className="p-3 bg-terracotta-alert/10 border border-terracotta-alert/30 text-terracotta-alert text-xs rounded-xl font-semibold flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        )}

        {/* ── TAB 1: Departments & Agencies ── */}
        {activeTab === 'departments' && (
          <div className="card-nivaran p-6 space-y-6">
            {/* Filters Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-nivaran text-xs py-1.5 px-3 w-44 sm:w-56"
                />

                {/* Sector Filter */}
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="input-nivaran text-xs py-1.5 px-2 bg-white cursor-pointer"
                >
                  <option value="">All Sectors</option>
                  {SECTORS_LIST.map((s) => (
                    <option key={s.key} value={s.key}>{s.displayName}</option>
                  ))}
                </select>

                {/* Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="input-nivaran text-xs py-1.5 px-2 bg-white cursor-pointer"
                >
                  <option value="">All Types</option>
                  <option value="municipal">Municipal Wings</option>
                  <option value="external">External Agencies</option>
                </select>

                {/* Active Filter */}
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className="input-nivaran text-xs py-1.5 px-2 bg-white cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="true">Active Only</option>
                  <option value="false">Inactive Only</option>
                </select>

                {(sectorFilter || typeFilter || activeFilter !== '' || searchQuery) && (
                  <button
                    onClick={() => {
                      setSectorFilter('')
                      setTypeFilter('')
                      setActiveFilter('')
                      setSearchQuery('')
                      setPage(1)
                    }}
                    className="text-xs text-gray-500 hover:text-gray-800 underline px-1"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="text-xs text-gray-500">
                Showing <span className="font-bold text-gray-700">{departments.length}</span> of <span className="font-bold text-gray-700">{total}</span> departments
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-gray-500 font-bold uppercase tracking-wider text-[11px] text-left">
                    <th className="py-3 px-4">Department / Agency</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-center">Primary</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Approved Staff</th>
                    <th className="py-3 px-4 text-center">Open Tickets</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-gray-400">
                        Loading departments & agencies...
                      </td>
                    </tr>
                  ) : departments.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-gray-400">
                        No departments or agencies found matching filters.
                      </td>
                    </tr>
                  ) : (
                    departments.map((d) => (
                      <tr key={d._id} className="hover:bg-gray-50/70 transition">
                        {/* Name & Details */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{d.name}</span>
                            {d.agencyCode && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                                {d.agencyCode}
                              </span>
                            )}
                          </div>
                          {d.isExternal && (
                            <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                              External agency: tickets are forwarded or tracked, not assigned to city staff.
                            </p>
                          )}
                          {d.contact?.phone && (
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              📞 {d.contact.phone} {d.contact.email ? `· ✉️ ${d.contact.email}` : ''}
                            </p>
                          )}
                        </td>

                        {/* Sector */}
                        <td className="py-3 px-4">
                          <span className="text-xs font-semibold text-gray-700">
                            {d.sectorDisplayName || d.sector || 'Unassigned'}
                          </span>
                        </td>

                        {/* Type Badge */}
                        <td className="py-3 px-4">
                          {d.isExternal ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              🏢 External
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              🏛️ Municipal
                            </span>
                          )}
                        </td>

                        {/* Primary Star */}
                        <td className="py-3 px-4 text-center">
                          {d.isPrimary ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Primary routing receiver for this sector">
                              ⭐ Primary
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>

                        {/* Active & Verified Badges */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {d.isActive ? (
                              <span className="text-[11px] font-bold text-jan-kalyan-green bg-jan-kalyan-green/10 px-2 py-0.5 rounded">
                                Active
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                Inactive
                              </span>
                            )}

                            {d.isExternal && (
                              d.verified ? (
                                <span className="text-[10px] font-semibold text-jan-kalyan-green bg-jan-kalyan-green/15 px-1.5 py-0.2 rounded border border-jan-kalyan-green/30">
                                  ✓ Verified
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  ⚠ Unverified
                                </span>
                              )
                            )}
                          </div>
                        </td>

                        {/* Staff Count */}
                        <td className="py-3 px-4 text-center">
                          {d.isExternal ? (
                            <span className="text-gray-400 text-xs" title="External agencies do not have city staff">N/A</span>
                          ) : (
                            <span className="font-bold text-gray-800">{d.staffCount}</span>
                          )}
                        </td>

                        {/* Open Tickets */}
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${d.openReportCount > 0 ? 'text-kesariya' : 'text-gray-400'}`}>
                            {d.openReportCount}
                          </span>
                        </td>

                        {/* Row Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(d)}
                              className="px-2 py-1 text-xs font-semibold text-sovereign-indigo hover:bg-gray-100 rounded transition"
                            >
                              Edit
                            </button>

                            {d.isActive && !d.isPrimary && d.sector && (
                              <button
                                onClick={() => promptSetPrimary(d)}
                                className="px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded transition"
                                title="Set as primary department for its sector"
                              >
                                ⭐ Set Primary
                              </button>
                            )}

                            {d.isExternal && (
                              <button
                                onClick={() => handleToggleVerify(d)}
                                className="px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded transition"
                              >
                                {d.verified ? 'Unverify' : 'Verify'}
                              </button>
                            )}

                            {d.isActive ? (
                              <button
                                onClick={() => promptDeactivate(d)}
                                className="px-2 py-1 text-xs font-semibold text-terracotta-alert hover:bg-red-50 rounded transition"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Activate Department',
                                    message: `Re-activate "${d.name}"? It will become available for assignment and category routing.`,
                                    actionType: 'activate',
                                    deptId: d._id,
                                    deptName: d.name,
                                  })
                                }}
                                className="px-2 py-1 text-xs font-semibold text-jan-kalyan-green hover:bg-green-50 rounded transition"
                              >
                                Activate
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
          </div>
        )}

        {/* ── TAB 2: Categories & City Tuning ── */}
        {activeTab === 'categories' && (
          <div className="card-nivaran p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-sovereign-indigo">
                  City Category Tuning ({filteredCategories.length})
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tune national categories for your city: disable categories, override severity weight or SLA deadlines, or force routing to a specific department.
                </p>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Filter category or sector..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="input-nivaran text-xs py-1.5 px-3 w-full"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-gray-500 font-bold uppercase tracking-wider text-[11px] text-left">
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-center">National Defaults</th>
                    <th className="py-3 px-4 text-center">City Effective Settings</th>
                    <th className="py-3 px-4 text-center">Status / Badge</th>
                    <th className="py-3 px-4">Routed Department</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {loadingCats ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400">
                        Loading category settings...
                      </td>
                    </tr>
                  ) : filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400">
                        No categories found.
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat) => {
                      const isCustomised =
                        cat.severityOverride !== null ||
                        cat.slaHoursOverride !== null ||
                        cat.routeToDepartment !== null ||
                        cat.isEnabled === false

                      return (
                        <tr key={cat.categoryId} className="hover:bg-gray-50/70 transition">
                          {/* Name */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-gray-900">{cat.name}</span>
                          </td>

                          {/* Sector */}
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-xs font-semibold text-gray-700">
                              {cat.sector || 'Unassigned'}
                            </span>
                          </td>

                          {/* National Defaults */}
                          <td className="py-3 px-4 text-center text-gray-500">
                            <div>Severity: <span className="font-bold text-gray-700">{cat.defaultSeverity}/10</span></div>
                            <div>SLA: <span className="font-bold text-gray-700">{cat.defaultSlaHours}h</span></div>
                          </td>

                          {/* Effective Settings */}
                          <td className="py-3 px-4 text-center">
                            <div>
                              Severity:{' '}
                              <span className={`font-bold ${cat.severityOverride ? 'text-kesariya' : 'text-gray-900'}`}>
                                {cat.effectiveSeverity}/10
                              </span>
                              {cat.severityOverride && <span className="text-[10px] text-gray-400 block">(overridden)</span>}
                            </div>
                            <div>
                              SLA:{' '}
                              <span className={`font-bold ${cat.slaHoursOverride ? 'text-kesariya' : 'text-gray-900'}`}>
                                {cat.effectiveSlaHours}h
                              </span>
                              {cat.slaHoursOverride && <span className="text-[10px] text-gray-400 block">(overridden)</span>}
                            </div>
                          </td>

                          {/* Status Badges */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {!cat.isEnabled ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-terracotta-alert/15 text-terracotta-alert border border-terracotta-alert/30">
                                  🚫 Disabled in your city
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-jan-kalyan-green bg-jan-kalyan-green/10 px-2 py-0.5 rounded">
                                  Active
                                </span>
                              )}

                              {isCustomised && cat.isEnabled && (
                                <span className="text-[10px] font-semibold text-sovereign-indigo bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                  ✦ Customised
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Forced Department / Auto */}
                          <td className="py-3 px-4">
                            {cat.routeToDepartment ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-800 text-xs">
                                  {cat.routeToDepartment.name}
                                </span>
                                {cat.routeToDepartment.isExternal && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 font-semibold">
                                    External
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs italic">
                                Automatic (Sector Primary)
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => openEditCategoryModal(cat)}
                                className="px-2.5 py-1 text-xs font-semibold text-kesariya hover:bg-kesariya/10 rounded transition"
                              >
                                Edit Settings
                              </button>
                              {isCustomised && (
                                <button
                                  onClick={() => promptResetCategory(cat)}
                                  className="px-2 py-1 text-xs font-semibold text-gray-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                                  title="Reset to national defaults"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── Modal: Category Settings Tuning ── */}
      {showCatSettingsModal && selectedCatSetting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-sovereign-indigo">
                  Tune "{selectedCatSetting.name}"
                </h3>
                <p className="text-xs text-gray-500">
                  National Sector: <span className="font-semibold text-gray-700">{selectedCatSetting.sector}</span>
                </p>
              </div>
              <button
                onClick={() => setShowCatSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            {catFormErrors.server && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {catFormErrors.server}
              </div>
            )}

            <form onSubmit={handleSaveCategorySettings} className="space-y-4">
              {/* Enable / Disable Switch */}
              <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-800 block">
                    Citizen Reporting for this Category
                  </span>
                  <span className="text-[11px] text-gray-500">
                    If disabled, citizens in your city cannot submit new reports under this category.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catFormData.isEnabled}
                    onChange={(e) => setCatFormData({ ...catFormData, isEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kesariya"></div>
                </label>
              </div>

              {/* Severity Override */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-700">
                    Severity Weight Override (1 – 10)
                  </label>
                  <span className="text-[11px] text-gray-400">
                    National default: {selectedCatSetting.defaultSeverity}/10
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={catFormData.severityOverride}
                  onChange={(e) => setCatFormData({ ...catFormData, severityOverride: e.target.value })}
                  placeholder={`Default: ${selectedCatSetting.defaultSeverity}`}
                  className="input-nivaran w-full text-xs"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Applies to new reports only.</p>
                {catFormErrors.severityOverride && (
                  <p className="text-[11px] text-terracotta-alert mt-0.5">{catFormErrors.severityOverride}</p>
                )}
              </div>

              {/* SLA Hours Override */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-700">
                    SLA Target Hours Override (1 – 720)
                  </label>
                  <span className="text-[11px] text-gray-400">
                    National default: {selectedCatSetting.defaultSlaHours} hours
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={catFormData.slaHoursOverride}
                  onChange={(e) => setCatFormData({ ...catFormData, slaHoursOverride: e.target.value })}
                  placeholder={`Default: ${selectedCatSetting.defaultSlaHours} hours`}
                  className="input-nivaran w-full text-xs"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Applies to new reports only.</p>
                {catFormErrors.slaHoursOverride && (
                  <p className="text-[11px] text-terracotta-alert mt-0.5">{catFormErrors.slaHoursOverride}</p>
                )}
              </div>

              {/* Route to Department Override */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Route to Specific Department (Optional Override)
                </label>
                <select
                  value={catFormData.routeToDepartment}
                  onChange={(e) => setCatFormData({ ...catFormData, routeToDepartment: e.target.value })}
                  className="input-nivaran w-full text-xs bg-white"
                >
                  <option value="">Use automatic routing (Sector Primary)</option>
                  {activeDepartmentsList.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} {d.isExternal ? '(External Agency)' : '(Municipal)'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Overrules sector primary: sends all new reports in this category to this chosen department.
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => promptResetCategory(selectedCatSetting)}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold"
                >
                  Reset to Defaults
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCatSettingsModal(false)}
                    className="btn-ghost text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={catSaving}
                    className="btn-kesariya text-xs font-semibold px-4 py-2"
                  >
                    {catSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create / Edit Department Modal ── */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-display text-lg font-bold text-sovereign-indigo">
                {editingDept ? `Edit ${editingDept.name}` : 'Add New Department or Agency'}
              </h3>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Department / Agency Name <span className="text-terracotta-alert">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Roads & Bridges Wing, PSPCL Division 1"
                  className="input-nivaran w-full text-xs"
                />
                {formErrors.name && <p className="text-[11px] text-terracotta-alert mt-0.5">{formErrors.name}</p>}
              </div>

              {/* Sector & Agency Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Sector <span className="text-terracotta-alert">*</span>
                  </label>
                  <select
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="input-nivaran w-full text-xs bg-white"
                  >
                    {SECTORS_LIST.map((s) => (
                      <option key={s.key} value={s.key}>{s.displayName}</option>
                    ))}
                  </select>
                  {formErrors.sector && <p className="text-[11px] text-terracotta-alert mt-0.5">{formErrors.sector}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Agency Type <span className="text-terracotta-alert">*</span>
                  </label>
                  <select
                    value={formData.agencyType}
                    onChange={(e) => setFormData({ ...formData, agencyType: e.target.value })}
                    className="input-nivaran w-full text-xs bg-white"
                  >
                    {AGENCY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Agency Code */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Agency Code (Optional, uppercase letters, digits, hyphen)
                </label>
                <input
                  type="text"
                  value={formData.agencyCode}
                  onChange={(e) => setFormData({ ...formData, agencyCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. PSPCL-JAL-01"
                  className="input-nivaran w-full text-xs font-mono"
                />
                {formErrors.agencyCode && <p className="text-[11px] text-terracotta-alert mt-0.5">{formErrors.agencyCode}</p>}
              </div>

              {/* Description & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short description of department scope"
                    className="input-nivaran w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Internal Notes</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Escalation protocol, office location..."
                    className="input-nivaran w-full text-xs"
                  />
                  {formErrors.notes && <p className="text-[11px] text-terracotta-alert mt-0.5">{formErrors.notes}</p>}
                </div>
              </div>

              {/* Contact Information Sub-section */}
              <div className="border-t border-gray-100 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Helpline Phone</label>
                    <input
                      type="text"
                      value={formData.helplinePhone}
                      onChange={(e) => setFormData({ ...formData, helplinePhone: e.target.value })}
                      placeholder="e.g. 1912"
                      className="input-nivaran w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Direct Office Phone</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 0181-2223344"
                      className="input-nivaran w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Contact Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="dept@example.gov.in"
                      className="input-nivaran w-full text-xs"
                    />
                    {formErrors.email && <p className="text-[11px] text-terracotta-alert mt-0.5">{formErrors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">Portal / Website</label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://..."
                      className="input-nivaran w-full text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-kesariya text-xs font-semibold px-4 py-2"
                >
                  {editingDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm Dialog Modal ── */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-sovereign-indigo">
              {confirmDialog.title}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`text-xs font-bold px-4 py-2 rounded-xl text-white shadow ${
                  confirmDialog.actionType === 'deactivate' || confirmDialog.actionType === 'reset-category'
                    ? 'bg-terracotta-alert hover:bg-red-700'
                    : 'bg-kesariya hover:bg-orange-600'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDepartments
