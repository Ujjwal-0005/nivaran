import Department from '../models/Department.js'
import Category from '../models/Category.js'
import CategoryConfig from '../models/CategoryConfig.js'
import User from '../models/User.js'
import { scopeFilter } from '../utils/scope.js'
import { SECTORS, SECTOR_KEYS } from '../constants/sectors.js'
import { resolveDepartment } from '../services/resolveDepartment.js'

/**
 * GET /api/admin/setup-status
 * City admin only, read-only, tenant-scoped checklist for city setup.
 */
export const getSetupStatus = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const municipalityId = filter.municipality

    // 1. Fetch all active categories & active departments for this municipality
    const [allCategories, activeDepartments, categoryConfigs] = await Promise.all([
      Category.find({ isActive: true }).lean(),
      Department.find({ municipality: municipalityId, isActive: true }).lean(),
      CategoryConfig.find({ municipality: municipalityId }).lean(),
    ])

    // Find which sectors have categories
    const sectorsWithCategories = new Set(
      allCategories.map((c) => c.sector).filter(Boolean)
    )

    // Find which sectors have active primary departments in this city
    const sectorsWithPrimary = new Set(
      activeDepartments.filter((d) => d.isPrimary && d.sector).map((d) => d.sector)
    )

    // sectorsWithoutPrimary: sectors that have categories but no active primary dept in this city
    const sectorsWithoutPrimary = []
    for (const secKey of sectorsWithCategories) {
      if (!sectorsWithPrimary.has(secKey)) {
        const sectorMeta = SECTORS[secKey]
        sectorsWithoutPrimary.push({
          key: secKey,
          name: sectorMeta ? sectorMeta.displayName : secKey,
        })
      }
    }

    // 2. unroutableCategories: categories that resolveDepartment would leave unresolved for this city
    const unroutableCategories = []
    for (const cat of allCategories) {
      const resolution = await resolveDepartment({
        municipalityId,
        categoryId: cat._id,
      })
      if (resolution.unresolved) {
        unroutableCategories.push({
          _id: cat._id,
          name: cat.name,
          sector: cat.sector,
        })
      }
    }

    // 3. unverifiedAgencies: active external departments with verified: false
    const unverifiedAgencyDocs = activeDepartments.filter(
      (d) => d.isExternal && !d.verified
    )
    const unverifiedAgencies = {
      count: unverifiedAgencyDocs.length,
      names: unverifiedAgencyDocs.map((d) => d.name),
    }

    // 4. municipalDepartmentsWithoutStaff: active municipal departments with zero approved staff
    const activeMunicipalDeptIds = activeDepartments
      .filter((d) => !d.isExternal)
      .map((d) => d._id)

    const approvedStaffPerDept = await User.aggregate([
      {
        $match: {
          municipality: municipalityId,
          department: { $in: activeMunicipalDeptIds },
          role: 'staff',
          applicationStatus: 'approved',
          isActive: true,
        },
      },
      { $group: { _id: '$department', count: { $sum: 1 } } },
    ])
    const approvedStaffSet = new Set(
      approvedStaffPerDept.filter((x) => x.count > 0).map((x) => x._id.toString())
    )

    const municipalDepartmentsWithoutStaff = activeDepartments
      .filter((d) => !d.isExternal && !approvedStaffSet.has(d._id.toString()))
      .map((d) => ({
        _id: d._id,
        name: d.name,
        sector: d.sector,
      }))

    // 5. pendingStaffApplications: count
    const pendingStaffApplications = await User.countDocuments({
      municipality: municipalityId,
      role: 'staff',
      applicationStatus: 'pending',
    })

    // 6. disabledCategories: count of categories disabled by CategoryConfig
    const disabledCategories = categoryConfigs.filter((c) => c.isEnabled === false).length

    // 7. Completion score: equal weights over the first four checks (25% each)
    // - Check 1: sectorsWithoutPrimary is 0 -> 25 points
    // - Check 2: unroutableCategories is 0 -> 25 points
    // - Check 3: unverifiedAgencies.count is 0 -> 25 points
    // - Check 4: municipalDepartmentsWithoutStaff is 0 -> 25 points
    let completion = 0
    if (sectorsWithoutPrimary.length === 0) completion += 25
    if (unroutableCategories.length === 0) completion += 25
    if (unverifiedAgencies.count === 0) completion += 25
    if (municipalDepartmentsWithoutStaff.length === 0) completion += 25

    const ready = completion === 100

    res.status(200).json({
      sectorsWithoutPrimary,
      unroutableCategories,
      unverifiedAgencies,
      municipalDepartmentsWithoutStaff,
      pendingStaffApplications,
      disabledCategories,
      completion,
      ready,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error computing setup status' })
  }
}
