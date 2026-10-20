import Department from '../models/Department.js'
import User from '../models/User.js'
import Report from '../models/Report.js'
import AuditLog from '../models/AuditLog.js'
import { scopeFilter, findInScope } from '../utils/scope.js'
import { SECTORS, isValidSector } from '../constants/sectors.js'

const VALID_AGENCY_TYPES = ['municipal', 'state_dept', 'utility', 'police', 'other']
const AGENCY_CODE_REGEX = /^[A-Z0-9-]+$/

/**
 * Helper to generate a unique key for a department within a municipality.
 */
async function generateUniqueKey(name, municipalityId) {
  let baseKey = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!baseKey) baseKey = 'dept'

  let candidateKey = baseKey
  let counter = 1
  while (true) {
    const existing = await Department.findOne({
      municipality: municipalityId,
      key: candidateKey,
    })
    if (!existing) return candidateKey
    counter++
    candidateKey = `${baseKey}_${counter}`
  }
}

/**
 * GET /api/admin/departments
 * List departments for the caller's city with filters and counts.
 */
export const listAdminDepartments = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const { sector, isExternal, isActive, search } = req.query

    const query = { municipality: filter.municipality }

    if (sector) {
      query.sector = sector
    }
    if (isExternal !== undefined && isExternal !== '') {
      query.isExternal = isExternal === 'true'
    }
    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true'
    }
    if (search && search.trim()) {
      const term = search.trim()
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { agencyCode: { $regex: term, $options: 'i' } },
      ]
    }

    let page = parseInt(req.query.page, 10) || 1
    let limit = parseInt(req.query.limit, 10) || 50
    if (page < 1) page = 1
    if (limit < 1) limit = 50
    if (limit > 100) limit = 100

    const total = await Department.countDocuments(query)
    const departments = await Department.find(query)
      .sort({ isPrimary: -1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)

    // Aggregate counts for returned departments
    const deptIds = departments.map((d) => d._id)

    // Approved staff count per department
    const approvedStaffCounts = await User.aggregate([
      {
        $match: {
          municipality: filter.municipality,
          department: { $in: deptIds },
          role: 'staff',
          applicationStatus: 'approved',
          isActive: true,
        },
      },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ])

    // Pending staff count per department
    const pendingStaffCounts = await User.aggregate([
      {
        $match: {
          municipality: filter.municipality,
          department: { $in: deptIds },
          role: 'staff',
          applicationStatus: 'pending',
        },
      },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ])

    // Open report count per department (status != resolved)
    const openReportCounts = await Report.aggregate([
      {
        $match: {
          municipality: filter.municipality,
          department: { $in: deptIds },
          status: { $ne: 'resolved' },
        },
      },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ])

    const approvedMap = new Map(approvedStaffCounts.map((x) => [x._id.toString(), x.count]))
    const pendingMap = new Map(pendingStaffCounts.map((x) => [x._id.toString(), x.count]))
    const openMap = new Map(openReportCounts.map((x) => [x._id.toString(), x.count]))

    const items = departments.map((d) => {
      const idStr = d._id.toString()
      const sectorObj = d.sector ? SECTORS[d.sector] : null
      return {
        _id: d._id,
        name: d.name,
        key: d.key,
        municipality: d.municipality,
        description: d.description,
        sector: d.sector,
        sectorDisplayName: sectorObj ? sectorObj.displayName : (d.sector || null),
        agencyType: d.agencyType,
        agencyCode: d.agencyCode,
        isExternal: d.isExternal,
        isPrimary: d.isPrimary,
        isActive: d.isActive,
        verified: d.verified,
        verifiedBy: d.verifiedBy,
        verifiedAt: d.verifiedAt,
        notes: d.notes,
        contact: d.contact,
        staffCount: approvedMap.get(idStr) || 0,
        pendingStaffCount: pendingMap.get(idStr) || 0,
        openReportCount: openMap.get(idStr) || 0,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }
    })

    res.status(200).json({
      items,
      page,
      limit,
      total,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error listing departments' })
  }
}

/**
 * GET /api/admin/departments/:id
 * One department with counts, contact, and notes.
 */
export const getAdminDepartmentById = async (req, res) => {
  try {
    const { id } = req.params
    const dept = await findInScope(Department, req, id)
    const filter = scopeFilter(req)

    const [staffCount, pendingStaffCount, openReportCount] = await Promise.all([
      User.countDocuments({
        municipality: filter.municipality,
        department: dept._id,
        role: 'staff',
        applicationStatus: 'approved',
        isActive: true,
      }),
      User.countDocuments({
        municipality: filter.municipality,
        department: dept._id,
        role: 'staff',
        applicationStatus: 'pending',
      }),
      Report.countDocuments({
        municipality: filter.municipality,
        department: dept._id,
        status: { $ne: 'resolved' },
      }),
    ])

    const sectorObj = dept.sector ? SECTORS[dept.sector] : null

    res.status(200).json({
      department: {
        _id: dept._id,
        name: dept.name,
        key: dept.key,
        municipality: dept.municipality,
        description: dept.description,
        sector: dept.sector,
        sectorDisplayName: sectorObj ? sectorObj.displayName : (dept.sector || null),
        agencyType: dept.agencyType,
        agencyCode: dept.agencyCode,
        isExternal: dept.isExternal,
        isPrimary: dept.isPrimary,
        isActive: dept.isActive,
        verified: dept.verified,
        verifiedBy: dept.verifiedBy,
        verifiedAt: dept.verifiedAt,
        notes: dept.notes,
        contact: dept.contact,
        staffCount,
        pendingStaffCount,
        openReportCount,
        createdAt: dept.createdAt,
        updatedAt: dept.updatedAt,
      },
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching department' })
  }
}

/**
 * POST /api/admin/departments
 * Create a department for the caller's city.
 */
export const createAdminDepartment = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const { name, sector, agencyType, agencyCode, contact, notes, description } = req.body

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
      return res.status(400).json({ message: 'Department name is required and must be between 2 and 80 characters' })
    }

    if (!sector || !isValidSector(sector)) {
      return res.status(400).json({ message: 'A valid sector is required' })
    }

    if (!agencyType || !VALID_AGENCY_TYPES.includes(agencyType)) {
      return res.status(400).json({
        message: `agencyType is required and must be one of: ${VALID_AGENCY_TYPES.join(', ')}`,
      })
    }

    let cleanAgencyCode = null
    if (agencyCode !== undefined && agencyCode !== null && agencyCode.trim() !== '') {
      cleanAgencyCode = agencyCode.trim().toUpperCase()
      if (cleanAgencyCode.length > 40 || !AGENCY_CODE_REGEX.test(cleanAgencyCode)) {
        return res.status(400).json({
          message: 'agencyCode may only contain uppercase letters, numbers, and hyphens (max 40 chars)',
        })
      }
    }

    if (notes !== undefined && notes !== null && typeof notes === 'string' && notes.length > 500) {
      return res.status(400).json({ message: 'notes cannot exceed 500 characters' })
    }

    // 2. Uniqueness checks in the same city
    const existingName = await Department.findOne({
      municipality: filter.municipality,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    })
    if (existingName) {
      return res.status(409).json({ message: 'A department with this name already exists in this municipality' })
    }

    if (cleanAgencyCode) {
      const existingCode = await Department.findOne({
        municipality: filter.municipality,
        agencyCode: cleanAgencyCode,
      })
      if (existingCode) {
        return res.status(409).json({ message: `Agency code "${cleanAgencyCode}" is already in use in this city` })
      }
    }

    // 3. Derived fields
    const isExternal = agencyType !== 'municipal'
    const key = await generateUniqueKey(name.trim(), filter.municipality)

    // 4. Create document
    const deptData = {
      name: name.trim(),
      key,
      municipality: filter.municipality,
      sector,
      agencyType,
      agencyCode: cleanAgencyCode,
      isExternal,
      isPrimary: false,
      isActive: true,
      verified: false,
      notes: notes ? notes.trim() : '',
      description: description ? description.trim() : '',
      contact: contact || {},
    }

    const department = await Department.create(deptData)

    // Audit log
    await AuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      action: 'department.create',
      targetMunicipality: filter.municipality,
      meta: {
        departmentId: department._id,
        name: department.name,
        sector: department.sector,
        agencyType: department.agencyType,
        agencyCode: department.agencyCode,
        isExternal: department.isExternal,
      },
      ip: req.ip,
    })

    res.status(201).json({
      message: 'Department created successfully',
      department,
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message })
    }
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error creating department' })
  }
}

/**
 * PATCH /api/admin/departments/:id
 * Update name, contact, notes, sector, agencyType, agencyCode.
 */
export const updateAdminDepartment = async (req, res) => {
  try {
    const { id } = req.params
    const filter = scopeFilter(req)
    const department = await findInScope(Department, req, id)

    const { name, contact, notes, sector, agencyType, agencyCode, description } = req.body

    const changes = {}
    let primaryClearedMessage = null

    // Name update
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
        return res.status(400).json({ message: 'Department name must be between 2 and 80 characters' })
      }
      const trimmedName = name.trim()
      const duplicate = await Department.findOne({
        _id: { $ne: department._id },
        municipality: filter.municipality,
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      })
      if (duplicate) {
        return res.status(409).json({ message: 'Another department with this name already exists in this city' })
      }
      changes.name = { from: department.name, to: trimmedName }
      department.name = trimmedName
    }

    // Notes update
    if (notes !== undefined) {
      if (notes !== null && typeof notes === 'string' && notes.length > 500) {
        return res.status(400).json({ message: 'notes cannot exceed 500 characters' })
      }
      changes.notes = { from: department.notes, to: notes ? notes.trim() : '' }
      department.notes = notes ? notes.trim() : ''
    }

    // Description update
    if (description !== undefined) {
      department.description = description ? description.trim() : ''
    }

    // Contact update
    if (contact !== undefined) {
      department.contact = {
        ...department.contact.toObject(),
        ...contact,
      }
      changes.contact = 'updated'
    }

    // Agency Code update
    if (agencyCode !== undefined) {
      if (agencyCode === null || agencyCode.trim() === '') {
        changes.agencyCode = { from: department.agencyCode, to: null }
        department.agencyCode = null
      } else {
        const cleanCode = agencyCode.trim().toUpperCase()
        if (cleanCode.length > 40 || !AGENCY_CODE_REGEX.test(cleanCode)) {
          return res.status(400).json({
            message: 'agencyCode may only contain uppercase letters, numbers, and hyphens (max 40 chars)',
          })
        }
        const duplicateCode = await Department.findOne({
          _id: { $ne: department._id },
          municipality: filter.municipality,
          agencyCode: cleanCode,
        })
        if (duplicateCode) {
          return res.status(409).json({ message: `Agency code "${cleanCode}" is already in use in this city` })
        }
        changes.agencyCode = { from: department.agencyCode, to: cleanCode }
        department.agencyCode = cleanCode
      }
    }

    // Agency Type update -> re-derive isExternal
    if (agencyType !== undefined) {
      if (!VALID_AGENCY_TYPES.includes(agencyType)) {
        return res.status(400).json({
          message: `agencyType must be one of: ${VALID_AGENCY_TYPES.join(', ')}`,
        })
      }
      const newIsExternal = agencyType !== 'municipal'
      if (newIsExternal) {
        // Guard: If changing to external, check if department has approved or pending staff
        const staffCount = await User.countDocuments({
          municipality: filter.municipality,
          department: department._id,
          role: 'staff',
          applicationStatus: { $in: ['approved', 'pending'] },
        })
        if (staffCount > 0) {
          return res.status(409).json({
            message: `Cannot convert department to external agency: it has ${staffCount} approved or pending staff member(s). Reassign them first.`,
          })
        }
      }
      changes.agencyType = { from: department.agencyType, to: agencyType }
      changes.isExternal = { from: department.isExternal, to: newIsExternal }
      department.agencyType = agencyType
      department.isExternal = newIsExternal
    }

    // Sector update
    if (sector !== undefined) {
      if (sector !== null && !isValidSector(sector)) {
        return res.status(400).json({ message: 'Invalid sector' })
      }
      if (department.sector !== sector) {
        changes.sector = { from: department.sector, to: sector }
        department.sector = sector

        // If sector changed and department was primary, clear isPrimary
        if (department.isPrimary) {
          department.isPrimary = false
          changes.isPrimary = { from: true, to: false }
          primaryClearedMessage = 'Primary status was cleared because the department sector was changed.'
        }
      }
    }

    await department.save()

    // Audit log
    await AuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      action: 'department.update',
      targetMunicipality: filter.municipality,
      meta: {
        departmentId: department._id,
        changes,
      },
      ip: req.ip,
    })

    res.status(200).json({
      message: 'Department updated successfully',
      notice: primaryClearedMessage,
      department,
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message })
    }
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error updating department' })
  }
}

/**
 * POST /api/admin/departments/:id/set-primary
 * Make this department the primary for its sector in this city.
 * Clears the previous primary in a safe transaction or ordering.
 */
export const setPrimaryDepartment = async (req, res) => {
  try {
    const { id } = req.params
    const filter = scopeFilter(req)
    const department = await findInScope(Department, req, id)

    if (!department.isActive) {
      return res.status(400).json({ message: 'Cannot set an inactive department as primary' })
    }
    if (!department.sector) {
      return res.status(400).json({ message: 'Cannot set a department without a sector as primary' })
    }

    if (department.isPrimary) {
      return res.status(200).json({
        message: 'Department is already primary for this sector',
        department,
      })
    }

    // Find previous primary in same municipality and sector
    const previousPrimary = await Department.findOne({
      _id: { $ne: department._id },
      municipality: filter.municipality,
      sector: department.sector,
      isPrimary: true,
      isActive: true,
    })

    // To prevent any unique index collision, clear the previous primary first, then set the new one
    if (previousPrimary) {
      previousPrimary.isPrimary = false
      await previousPrimary.save()
    }

    try {
      department.isPrimary = true
      await department.save()
    } catch (saveErr) {
      // Rollback: restore previous primary if new primary save fails
      if (previousPrimary) {
        previousPrimary.isPrimary = true
        await previousPrimary.save().catch(() => {})
      }
      throw saveErr
    }

    // Audit log
    await AuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      action: 'department.set_primary',
      targetMunicipality: filter.municipality,
      meta: {
        departmentId: department._id,
        sector: department.sector,
        previousPrimaryId: previousPrimary ? previousPrimary._id : null,
      },
      ip: req.ip,
    })

    res.status(200).json({
      message: `Department "${department.name}" is now the primary department for sector ${department.sector}`,
      department,
      previousPrimary: previousPrimary ? previousPrimary._id : null,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error setting primary department' })
  }
}

/**
 * POST /api/admin/departments/:id/deactivate
 * Blocked with 409 if department has open reports or staff.
 * If was primary, clears isPrimary.
 */
export const deactivateDepartment = async (req, res) => {
  try {
    const { id } = req.params
    const filter = scopeFilter(req)
    const department = await findInScope(Department, req, id)

    if (!department.isActive) {
      return res.status(200).json({
        message: 'Department is already inactive',
        department,
      })
    }

    // Guard: Check open reports
    const openReportsCount = await Report.countDocuments({
      municipality: filter.municipality,
      department: department._id,
      status: { $ne: 'resolved' },
    })
    if (openReportsCount > 0) {
      return res.status(409).json({
        message: `Cannot deactivate department: it has ${openReportsCount} open report(s). Reassign them first.`,
      })
    }

    // Guard: Check staff (approved or pending)
    const staffCount = await User.countDocuments({
      municipality: filter.municipality,
      department: department._id,
      role: 'staff',
      applicationStatus: { $in: ['approved', 'pending'] },
    })
    if (staffCount > 0) {
      return res.status(409).json({
        message: `Cannot deactivate department: it has ${staffCount} approved or pending staff member(s). Reassign them first.`,
      })
    }

    const wasPrimary = department.isPrimary
    department.isActive = false
    department.isPrimary = false
    await department.save()

    // Audit log
    await AuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      action: 'department.deactivate',
      targetMunicipality: filter.municipality,
      meta: {
        departmentId: department._id,
        wasPrimary,
      },
      ip: req.ip,
    })

    res.status(200).json({
      message: 'Department deactivated successfully',
      clearedPrimary: wasPrimary,
      department,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error deactivating department' })
  }
}

/**
 * POST /api/admin/departments/:id/activate
 * Re-activates an inactive department. Starts with isPrimary: false.
 */
export const activateDepartment = async (req, res) => {
  try {
    const { id } = req.params
    const filter = scopeFilter(req)
    const department = await findInScope(Department, req, id)

    if (department.isActive) {
      return res.status(200).json({
        message: 'Department is already active',
        department,
      })
    }

    department.isActive = true
    await department.save()

    // Audit log
    await AuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      action: 'department.activate',
      targetMunicipality: filter.municipality,
      meta: {
        departmentId: department._id,
      },
      ip: req.ip,
    })

    res.status(200).json({
      message: 'Department activated successfully',
      department,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error activating department' })
  }
}

/**
 * POST /api/admin/departments/:id/verify
 * Body: { verified: true|false }
 */
export const verifyDepartment = async (req, res) => {
  try {
    const { id } = req.params
    const filter = scopeFilter(req)
    const department = await findInScope(Department, req, id)

    const { verified } = req.body
    if (typeof verified !== 'boolean') {
      return res.status(400).json({ message: 'verified must be a boolean (true or false)' })
    }

    department.verified = verified
    if (verified) {
      department.verifiedBy = req.user._id
      department.verifiedAt = new Date()
    } else {
      department.verifiedBy = null
      department.verifiedAt = null
    }

    await department.save()

    // Audit log
    await AuditLog.create({
      actor: req.user._id,
      actorEmail: req.user.email,
      action: 'department.verify',
      targetMunicipality: filter.municipality,
      meta: {
        departmentId: department._id,
        verified,
      },
      ip: req.ip,
    })

    res.status(200).json({
      message: `Department ${verified ? 'marked as verified' : 'unverified'} successfully`,
      department,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error verifying department' })
  }
}
