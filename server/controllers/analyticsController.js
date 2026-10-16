import Report from '../models/Report.js'
import Department from '../models/Department.js'
import Category from '../models/Category.js'
import User from '../models/User.js'
import Municipality from '../models/Municipality.js'
import { scopeFilter } from '../utils/scope.js'

/**
 * 1. GET /api/analytics/overview (admin only)
 * Scoped to admin's municipality
 */
export const getOverviewAnalytics = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const totalReports = await Report.countDocuments(filter)
    const resolvedReportsCount = await Report.countDocuments({ ...filter, status: 'resolved' })
    const openReportsCount = totalReports - resolvedReportsCount

    // Average resolution time (hours) for resolved reports
    const resolvedReports = await Report.find({ ...filter, status: 'resolved' }).select('createdAt resolvedAt updatedAt')

    let totalResolutionHours = 0
    let validResolvedCount = 0

    for (const r of resolvedReports) {
      const completionTime = r.resolvedAt || r.updatedAt
      if (completionTime && r.createdAt) {
        const diffHours = (new Date(completionTime) - new Date(r.createdAt)) / (1000 * 60 * 60)
        if (diffHours >= 0) {
          totalResolutionHours += diffHours
          validResolvedCount++
        }
      }
    }

    const avgResolutionHours = validResolvedCount > 0
      ? Number((totalResolutionHours / validResolvedCount).toFixed(1))
      : 0

    res.status(200).json({
      totalReports,
      resolvedReports: resolvedReportsCount,
      openReports: openReportsCount,
      avgResolutionHours,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching analytics overview' })
  }
}

/**
 * 2. GET /api/analytics/by-category (admin only)
 * Count of reports grouped by category in this municipality
 */
export const getCategoryAnalytics = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const categories = await Category.find().select('name')
    const reports = await Report.find(filter).select('category status')

    const categoryMap = {}
    categories.forEach((cat) => {
      categoryMap[cat._id.toString()] = {
        name: cat.name,
        total: 0,
        resolved: 0,
        open: 0,
      }
    })

    reports.forEach((r) => {
      if (r.category) {
        const catId = r.category.toString()
        if (!categoryMap[catId]) {
          categoryMap[catId] = { name: 'Other', total: 0, resolved: 0, open: 0 }
        }
        categoryMap[catId].total += 1
        if (r.status === 'resolved') {
          categoryMap[catId].resolved += 1
        } else {
          categoryMap[catId].open += 1
        }
      }
    })

    const result = Object.values(categoryMap).sort((a, b) => b.total - a.total)
    res.status(200).json({ categories: result })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching category analytics' })
  }
}

/**
 * 3. GET /api/analytics/by-department (admin only)
 * Departments in this municipality
 */
export const getDepartmentAnalytics = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const departments = await Department.find(filter).select('name')
    const reports = await Report.find(filter).select('department status createdAt resolvedAt updatedAt rating isDisputed')

    const deptMap = {}
    departments.forEach((d) => {
      deptMap[d._id.toString()] = {
        departmentId: d._id,
        name: d.name,
        total: 0,
        resolved: 0,
        open: 0,
        disputed: 0,
        totalHours: 0,
        resolvedCountForHours: 0,
        totalRatingScore: 0,
        ratedCount: 0,
      }
    })

    reports.forEach((r) => {
      if (r.department) {
        const deptId = r.department.toString()
        if (deptMap[deptId]) {
          deptMap[deptId].total += 1
          if (r.status === 'resolved') {
            deptMap[deptId].resolved += 1
            const completionTime = r.resolvedAt || r.updatedAt
            if (completionTime && r.createdAt) {
              const diffHours = (new Date(completionTime) - new Date(r.createdAt)) / (1000 * 60 * 60)
              if (diffHours >= 0) {
                deptMap[deptId].totalHours += diffHours
                deptMap[deptId].resolvedCountForHours += 1
              }
            }
          } else if (r.status === 'disputed') {
            deptMap[deptId].disputed += 1
          } else {
            deptMap[deptId].open += 1
          }

          if (r.rating && typeof r.rating.score === 'number') {
            deptMap[deptId].totalRatingScore += r.rating.score
            deptMap[deptId].ratedCount += 1
          }
        }
      }
    })

    const result = Object.values(deptMap).map((d) => {
      const avgResolutionHours = d.resolvedCountForHours > 0
        ? Number((d.totalHours / d.resolvedCountForHours).toFixed(1))
        : 0
      const avgRating = d.ratedCount > 0
        ? Number((d.totalRatingScore / d.ratedCount).toFixed(1))
        : null
      const resolutionRate = d.total > 0
        ? Number(((d.resolved / d.total) * 100).toFixed(1))
        : 0
      const disputeRate = d.total > 0
        ? Number(((d.disputed / d.total) * 100).toFixed(1))
        : 0

      return {
        departmentId: d.departmentId,
        name: d.name,
        total: d.total,
        resolved: d.resolved,
        open: d.open,
        disputed: d.disputed,
        resolutionRate,
        disputeRate,
        avgResolutionHours,
        avgRating,
      }
    }).sort((a, b) => b.total - a.total)

    res.status(200).json({ departments: result })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching department analytics' })
  }
}

/**
 * 4. GET /api/analytics/trends (admin only)
 * Reports in municipality created vs resolved per day over the last 30 days
 */
export const getTrendAnalytics = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const days = 30
    const now = new Date()
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    startDate.setHours(0, 0, 0, 0)

    const trendMap = {}
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().split('T')[0]
      trendMap[key] = {
        date: key,
        created: 0,
        resolved: 0,
      }
    }

    const reports = await Report.find({
      ...filter,
      $or: [
        { createdAt: { $gte: startDate } },
        { resolvedAt: { $gte: startDate } },
        { status: 'resolved', updatedAt: { $gte: startDate } },
      ],
    }).select('createdAt resolvedAt updatedAt status')

    reports.forEach((r) => {
      if (r.createdAt && r.createdAt >= startDate) {
        const createKey = new Date(r.createdAt).toISOString().split('T')[0]
        if (trendMap[createKey]) {
          trendMap[createKey].created += 1
        }
      }

      if (r.status === 'resolved') {
        const resolveTime = r.resolvedAt || r.updatedAt
        if (resolveTime && new Date(resolveTime) >= startDate) {
          const resolveKey = new Date(resolveTime).toISOString().split('T')[0]
          if (trendMap[resolveKey]) {
            trendMap[resolveKey].resolved += 1
          }
        }
      }
    })

    const trends = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date))
    res.status(200).json({ trends })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching trend analytics' })
  }
}

/**
 * 5. GET /api/analytics/staff-leaderboard (admin only)
 * Staff within admin's municipality ranked
 */
export const getStaffLeaderboard = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const staffMembers = await User.find({ role: 'staff', municipality: filter.municipality })
      .populate('department', 'name')
      .select('name email department')

    const leaderboard = await Promise.all(
      staffMembers.map(async (staff) => {
        const resolvedReports = await Report.find({
          municipality: filter.municipality,
          assignedTo: staff._id,
          status: 'resolved',
        }).select('rating')

        const totalResolved = resolvedReports.length
        const ratedReports = resolvedReports.filter((r) => r.rating && typeof r.rating.score === 'number')
        const avgRating = ratedReports.length > 0
          ? Number((ratedReports.reduce((acc, curr) => acc + curr.rating.score, 0) / ratedReports.length).toFixed(1))
          : null

        const openAssigned = await Report.countDocuments({
          municipality: filter.municipality,
          assignedTo: staff._id,
          status: { $ne: 'resolved' },
        })

        return {
          staffId: staff._id,
          name: staff.name,
          department: staff.department?.name || 'General',
          totalResolved,
          avgRating,
          openAssigned,
        }
      })
    )

    leaderboard.sort((a, b) => b.totalResolved - a.totalResolved || (b.avgRating || 0) - (a.avgRating || 0))
    res.status(200).json({ leaderboard })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching staff leaderboard' })
  }
}

/**
 * 6. GET /api/analytics/zones (admin only)
 * Group reports in municipality by lat/lng bucket
 */
export const getZoneAnalytics = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const openReports = await Report.find({ ...filter, status: { $ne: 'resolved' } })
      .populate('department', 'name')
      .select('location status ticketId')

    const zoneMap = {}

    openReports.forEach((r) => {
      if (r.location?.lat && r.location?.lng) {
        const latBucket = r.location.lat.toFixed(2)
        const lngBucket = r.location.lng.toFixed(2)
        const zoneKey = `Sector ${latBucket}, ${lngBucket}`

        if (!zoneMap[zoneKey]) {
          zoneMap[zoneKey] = {
            zone: zoneKey,
            lat: Number(latBucket),
            lng: Number(lngBucket),
            openCount: 0,
            departments: {},
          }
        }
        zoneMap[zoneKey].openCount += 1
        const deptName = r.department?.name || 'General'
        zoneMap[zoneKey].departments[deptName] = (zoneMap[zoneKey].departments[deptName] || 0) + 1
      }
    })

    const zones = Object.values(zoneMap).sort((a, b) => b.openCount - a.openCount)
    res.status(200).json({ zones })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching zone analytics' })
  }
}

/**
 * 7. GET /api/public/transparency (NO AUTH REQUIRED)
 * Public transparency. Optional ?municipality=... query parameter, defaults to first active municipality or all.
 */
export const getPublicTransparency = async (req, res) => {
  try {
    let muniFilter = {}
    if (req.query.municipality) {
      muniFilter.municipality = req.query.municipality
    } else {
      const defaultMuni = await Municipality.findOne({ isActive: true }).sort({ name: 1 })
      if (defaultMuni) {
        muniFilter.municipality = defaultMuni._id
      }
    }

    const departments = await Department.find(muniFilter).select('name description')
    const reports = await Report.find(muniFilter).select('department status createdAt resolvedAt updatedAt')

    const deptMap = {}
    departments.forEach((d) => {
      deptMap[d._id.toString()] = {
        name: d.name,
        description: d.description || '',
        totalReported: 0,
        totalResolved: 0,
        openIssues: 0,
        totalResolutionHours: 0,
        resolvedWithTimeCount: 0,
      }
    })

    let overallTotal = 0
    let overallResolved = 0

    reports.forEach((r) => {
      overallTotal += 1
      if (r.status === 'resolved') overallResolved += 1

      if (r.department) {
        const deptId = r.department.toString()
        if (deptMap[deptId]) {
          deptMap[deptId].totalReported += 1
          if (r.status === 'resolved') {
            deptMap[deptId].totalResolved += 1
            const completionTime = r.resolvedAt || r.updatedAt
            if (completionTime && r.createdAt) {
              const diffHours = (new Date(completionTime) - new Date(r.createdAt)) / (1000 * 60 * 60)
              if (diffHours >= 0) {
                deptMap[deptId].totalResolutionHours += diffHours
                deptMap[deptId].resolvedWithTimeCount += 1
              }
            }
          } else {
            deptMap[deptId].openIssues += 1
          }
        }
      }
    })

    const departmentStats = Object.values(deptMap).map((d) => {
      const resolutionRate = d.totalReported > 0
        ? Number(((d.totalResolved / d.totalReported) * 100).toFixed(1))
        : 0
      const avgResolutionHours = d.resolvedWithTimeCount > 0
        ? Number((d.totalResolutionHours / d.resolvedWithTimeCount).toFixed(1))
        : 0

      return {
        department: d.name,
        description: d.description,
        totalReported: d.totalReported,
        totalResolved: d.totalResolved,
        openIssues: d.openIssues,
        resolutionRate,
        avgResolutionHours,
      }
    }).sort((a, b) => b.totalReported - a.totalReported)

    const overallResolutionRate = overallTotal > 0
      ? Number(((overallResolved / overallTotal) * 100).toFixed(1))
      : 0

    res.status(200).json({
      summary: {
        totalReported: overallTotal,
        totalResolved: overallResolved,
        overallResolutionRate,
      },
      departments: departmentStats,
      lastUpdated: new Date(),
    })
  } catch (error) {
    console.error('Error fetching public transparency data:', error)
    res.status(500).json({ message: 'Server error fetching transparency data' })
  }
}
