import Report from '../models/Report.js'
import Category from '../models/Category.js'
import Department from '../models/Department.js'
import User from '../models/User.js'
import { checkForDuplicate } from '../algorithms/duplicateDetection.js'
import { calculatePriorityScore, calculateDaysOpen } from '../algorithms/priorityScoring.js'
import imagekit from '../config/imagekit.js'
import { toFile } from '@imagekit/nodejs'
import { scopeFilter, findInScope } from '../utils/scope.js'

import Municipality from '../models/Municipality.js'
import CategoryConfig from '../models/CategoryConfig.js'
import { resolveDepartment } from '../services/resolveDepartment.js'
import { getCityStatus } from '../utils/cityStatus.js'
import { resolveCityFromPoint } from '../utils/resolveCityFromPoint.js'

// Generate unique ticket ID
const generateTicketId = () => {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 90000) + 10000
  return `CIV-${year}-${random}`
}

// Submit a new report (citizen only)
export const submitReport = async (req, res) => {
  try {
    const { category, categoryId, description, lat, lng, isAnonymous, forceNew } = req.body
    const targetCategoryInput = category || categoryId
    const userId = req.user.userId
    const userMunicipality = req.user.municipality

    if (!userMunicipality) {
      return res.status(403).json({ message: 'User does not belong to any municipality' })
    }

    if (!targetCategoryInput || !description || lat === undefined || lng === undefined) {
      return res.status(400).json({ message: 'Category, description, and location are required' })
    }

    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ message: 'Valid geographic latitude and longitude coordinates are required' })
    }

    // Derive target municipality from the pin coordinates (server authoritative)
    const resolvedCity = await resolveCityFromPoint({
      lat: latNum,
      lng: lngNum,
      homeMunicipalityId: userMunicipality,
    })

    if (!resolvedCity || (!resolvedCity.municipality && !resolvedCity.nearestNotLive)) {
      return res.status(400).json({
        message: 'The selected pin location does not fall within any supported municipality boundary.',
      })
    }

    if (!resolvedCity.isLive || !resolvedCity.municipality) {
      const cityName = resolvedCity.nearestNotLive?.name || 'This city'
      return res.status(403).json({
        message: `${cityName} is not live on Nivaran yet`,
      })
    }

    const targetMunicipalityDoc = resolvedCity.municipality
    const targetMunicipalityId = targetMunicipalityDoc._id

    // Check cross-city daily submission limit (anti-abuse)
    const isCrossCity = targetMunicipalityId.toString() !== userMunicipality.toString()
    if (isCrossCity) {
      const { getCrossCityDailyLimit } = await import('../utils/resolveCityFromPoint.js')
      const dailyLimit = getCrossCityDailyLimit()
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      const crossCityCountLast24h = await Report.countDocuments({
        citizen: userId,
        municipality: { $ne: userMunicipality },
        createdAt: { $gte: oneDayAgo },
      })

      if (crossCityCountLast24h >= dailyLimit) {
        return res.status(429).json({
          message: `Daily cross-city report limit reached (${dailyLimit} reports per 24 hours). You can still report in your home municipality.`,
        })
      }
    }

    const isAnonymousBool = isAnonymous === 'true' || isAnonymous === true
    const forceNewBool = forceNew === 'true' || forceNew === true

    // Look up category
    const categoryDoc = await Category.findById(targetCategoryInput)
    if (!categoryDoc) {
      return res.status(404).json({ message: 'Category not found' })
    }

    // Resolve department and check city-level category configuration in target municipality
    const resolution = await resolveDepartment({
      municipalityId: targetMunicipalityId,
      categoryId: categoryDoc._id,
    })

    if (resolution.disabled) {
      return res.status(400).json({
        message: 'This category is currently not accepted in this municipality.',
      })
    }

    let targetDept = resolution.department || null
    let routedBy = resolution.routedBy || 'none'
    let departmentUnresolved = Boolean(resolution.unresolved)
    const routingHistory = []

    if (targetDept) {
      routingHistory.push({
        at: new Date(),
        action: 'auto',
        fromDepartment: null,
        toDepartment: targetDept._id,
        byUser: null,
        reason: `Auto-routed via ${routedBy}`,
      })
    }

    // Check for duplicate in target municipality
    if (!forceNewBool) {
      const duplicateReport = await checkForDuplicate({
        category,
        location: { lat: latNum, lng: lngNum },
        municipality: targetMunicipalityId,
      })

      if (duplicateReport) {
        return res.status(200).json({
          possibleDuplicate: true,
          existingReport: {
            id: duplicateReport._id,
            ticketId: duplicateReport.ticketId,
            category: categoryDoc.name,
            description: duplicateReport.description,
            photoUrl: duplicateReport.photoUrl,
            location: duplicateReport.location,
            status: duplicateReport.status,
            createdAt: duplicateReport.createdAt,
            reportCount: duplicateReport.reportCount,
          },
        })
      }
    }

    // Generate ticket ID
    let ticketId
    let isUnique = false
    let attempts = 0

    while (!isUnique && attempts < 10) {
      ticketId = generateTicketId()
      const existing = await Report.findOne({ ticketId })
      if (!existing) {
        isUnique = true
      }
      attempts++
    }

    if (!isUnique) {
      return res.status(500).json({ message: 'Failed to generate unique ticket ID' })
    }

    // Auto-assign to staff member: ONLY if resolved department is municipal (isExternal: false) in target municipality
    let assignedStaffId = null
    if (targetDept && !targetDept.isExternal) {
      const departmentStaff = await User.find({
        role: 'staff',
        department: targetDept._id,
        municipality: targetMunicipalityId,
        isVerified: true,
        applicationStatus: 'approved', // Only approved staff
      })

      if (departmentStaff.length > 0) {
        const staffWithCounts = await Promise.all(
          departmentStaff.map(async (staff) => {
            const count = await Report.countDocuments({
              municipality: targetMunicipalityId,
              assignedTo: staff._id,
              status: { $ne: 'resolved' },
            })
            return { staff, count }
          })
        )
        staffWithCounts.sort((a, b) => a.count - b.count)
        assignedStaffId = staffWithCounts[0].staff._id
      }
    }

    // Check CategoryConfig for severity and SLA overrides in target municipality
    const catConfig = await CategoryConfig.findOne({
      municipality: targetMunicipalityId,
      category: categoryDoc._id,
    })

    const effectiveSeverity = (catConfig && typeof catConfig.severityOverride === 'number')
      ? catConfig.severityOverride
      : (categoryDoc.severityWeight || 1)

    const effectiveSlaHours = (catConfig && typeof catConfig.slaHoursOverride === 'number')
      ? catConfig.slaHoursOverride
      : (categoryDoc.slaHours || 48)

    const slaDeadline = new Date(Date.now() + effectiveSlaHours * 60 * 60 * 1000)

    const reportData = {
      ticketId,
      municipality: targetMunicipalityId,
      citizen: userId,
      category: categoryDoc._id,
      department: targetDept ? targetDept._id : null,
      departmentUnresolved,
      routedBy,
      routingHistory,
      description,
      location: { lat: latNum, lng: lngNum },
      // GeoJSON Point for 2dsphere duplicate prefilter (GeoJSON order: [lng, lat])
      geoPoint: { type: 'Point', coordinates: [lngNum, latNum] },
      isAnonymous: isAnonymousBool,
      reportedBy: [userId],
      assignedTo: assignedStaffId,
      slaDeadline,
    }

    if (req.file) {
      try {
        const file = await toFile(req.file.buffer, req.file.originalname, {
          type: req.file.mimetype,
        })
        const uploadResponse = await imagekit.files.upload({
          file,
          fileName: `report-${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
          useUniqueFileName: true,
          folder: '/nivaran/reports',
        })
        if (uploadResponse && uploadResponse.url) {
          reportData.photoUrl = uploadResponse.url
        } else {
          throw new Error('Invalid response from ImageKit')
        }
      } catch (uploadError) {
        console.error('ImageKit upload error:', uploadError)
        throw new Error('Failed to upload image to ImageKit')
      }
    }

    const report = await Report.create(reportData)

    const daysOpen = calculateDaysOpen(report.createdAt)
    report.priorityScore = calculatePriorityScore({
      reportCount: report.reportCount,
      severityWeight: effectiveSeverity,
      daysOpen,
      upvotes: report.upvotes.length,
    })
    await report.save()

    // Notify admins of target municipality in real-time
    try {
      const { notifyAdmins } = await import('../utils/notify.js')
      notifyAdmins(targetMunicipalityId, 'new_report', {
        ticketId: report.ticketId,
        category: categoryDoc.name,
        department: targetDept ? targetDept.name : 'Unresolved Department',
        location: report.location,
        createdAt: report.createdAt,
      })
    } catch (notifErr) {
      // Non-blocking notification
    }

    res.status(201).json({
      message: 'Report submitted successfully',
      ticketId: report.ticketId,
      report: {
        id: report._id,
        ticketId: report.ticketId,
        municipality: targetMunicipalityId,
        city: targetMunicipalityDoc.name,
        category: categoryDoc.name,
        department: targetDept ? targetDept.name : 'Unresolved Department',
        departmentUnresolved: report.departmentUnresolved,
        description: report.description,
        photoUrl: report.photoUrl,
        location: report.location,
        status: report.status,
        isAnonymous: report.isAnonymous,
        createdAt: report.createdAt,
        priorityScore: report.priorityScore,
      },
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error during report submission' })
  }
}

// Upvote a report (citizen only)
export const upvoteReport = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.userId

    const report = await findInScope(Report, req, id, 'category')

    if (report.upvotes.map(String).includes(userId.toString())) {
      return res.status(400).json({ message: 'You have already upvoted this report' })
    }

    report.upvotes.push(userId)

    const daysOpen = calculateDaysOpen(report.createdAt)
    const severityWeight = report.category?.severityWeight || 1
    report.priorityScore = calculatePriorityScore({
      reportCount: report.reportCount,
      severityWeight,
      daysOpen,
      upvotes: report.upvotes.length,
    })

    await report.save()

    res.status(200).json({
      message: 'Successfully upvoted report',
      report: {
        id: report._id,
        upvotes: report.upvotes.length,
        priorityScore: report.priorityScore,
      },
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error upvoting report' })
  }
}

// Join an existing report as a duplicate (citizen only)
export const joinReport = async (req, res) => {
  try {
    const { id } = req.params
    const { lat, lng } = req.body
    const userId = req.user.userId

    // When joining from duplicate confirmation or map, require pin
    let report = await Report.findById(id).populate('category')
    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    if (lat !== undefined && lng !== undefined) {
      const latNum = parseFloat(lat)
      const lngNum = parseFloat(lng)
      if (isNaN(latNum) || isNaN(lngNum)) {
        return res.status(400).json({ message: 'Valid lat and lng required' })
      }

      // 1. Resolve city of the joiner's pin
      const { resolveCityFromPoint } = await import('../utils/resolveCityFromPoint.js')
      const pinCity = await resolveCityFromPoint({
        lat: latNum,
        lng: lngNum,
        homeMunicipalityId: req.user.municipality,
      })

      if (!pinCity || !pinCity.municipality || pinCity.municipality._id.toString() !== report.municipality.toString()) {
        return res.status(400).json({ message: 'Join location must be in the same city as the report' })
      }

      // 2. Proximity check (within 50 meters)
      const { haversineDistance } = await import('../algorithms/duplicateDetection.js')
      const distMeters = haversineDistance(latNum, lngNum, report.location.lat, report.location.lng)
      if (distMeters > 50) {
        return res.status(400).json({
          message: `Join location is too far (${Math.round(distMeters)}m). Must be within 50 meters of the reported issue.`,
        })
      }
    } else {
      // If no coordinates provided in body, fallback to scoped check
      if (report.municipality.toString() !== req.user.municipality.toString()) {
        const isOwnerOrReporter = (report.citizen && report.citizen.toString() === userId.toString()) ||
          (report.reportedBy && report.reportedBy.some((r) => r.toString() === userId.toString()))
        if (!isOwnerOrReporter) {
          return res.status(404).json({ message: 'Report not found' })
        }
      }
    }

    if (report.reportedBy.map(String).includes(userId.toString())) {
      return res.status(400).json({ message: 'You have already reported this issue' })
    }

    report.reportedBy.push(userId)
    report.reportCount += 1

    const daysOpen = calculateDaysOpen(report.createdAt)
    const severityWeight = report.category?.severityWeight || 1
    report.priorityScore = calculatePriorityScore({
      reportCount: report.reportCount,
      severityWeight,
      daysOpen,
      upvotes: report.upvotes.length,
    })

    await report.save()

    res.status(200).json({
      message: 'Successfully joined report',
      report: {
        id: report._id,
        ticketId: report.ticketId,
        reportCount: report.reportCount,
        priorityScore: report.priorityScore,
      },
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error joining report' })
  }
}

// Get citizen's own reports
export const getMyReports = async (req, res) => {
  try {
    const userId = req.user.userId
    let queryFilter
    if (req.user.role === 'citizen') {
      queryFilter = {
        $or: [
          { citizen: userId },
          { reportedBy: userId },
        ],
      }
    } else {
      const filter = scopeFilter(req)
      queryFilter = {
        ...filter,
        $or: [
          { citizen: userId },
          { reportedBy: userId },
        ],
      }
    }

    const { parsePagination, buildPagination } = await import('../utils/pagination.js')
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 })

    const [rawReports, total] = await Promise.all([
      Report.find(queryFilter)
        .populate('category', 'name severityWeight slaHours')
        .populate('department', 'name key')
        .populate('municipality', 'name state')
        .populate('citizen', 'name email')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(queryFilter),
    ])

    const reportsWithPriority = rawReports.map((r) => {
      const daysOpen = calculateDaysOpen(r.createdAt)
      const severityWeight = r.category?.severityWeight || 1
      r.priorityScore = calculatePriorityScore({
        reportCount: r.reportCount,
        severityWeight,
        daysOpen,
        upvotes: r.upvotes?.length || 0,
      })
      return r
    })

    res.status(200).json({
      reports: reportsWithPriority,
      pagination: buildPagination({ page, limit, total }),
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching reports' })
  }
}

// Get single report by ID (scoped: callers can only read reports in their municipality)
// Citizens can see another citizen's report details without reporter identity if anonymous
export const getReportById = async (req, res) => {
  try {
    const { id } = req.params
    let report
    if (req.user.role === 'citizen') {
      // First check within citizen's scope
      report = await Report.findOne({
        _id: id,
        $or: [
          { municipality: req.user.municipality },
          { citizen: req.user.userId },
          { reportedBy: req.user.userId },
        ],
      }).populate([
        { path: 'category' },
        { path: 'department' },
        { path: 'municipality', select: 'name state' },
        { path: 'citizen', select: 'name email' },
        { path: 'reportedBy', select: 'name email' },
        { path: 'assignedTo', select: 'name email department' },
        { path: 'comments.author', select: 'name role' },
      ])

      if (!report) {
        return res.status(404).json({ message: 'Report not found' })
      }
    } else {
      report = await findInScope(Report, req, id, [
        { path: 'category' },
        { path: 'department' },
        { path: 'municipality', select: 'name state' },
        { path: 'citizen', select: 'name email' },
        { path: 'reportedBy', select: 'name email' },
        { path: 'assignedTo', select: 'name email department' },
        { path: 'comments.author', select: 'name role' },
      ])
    }

    // Staff guard: staff can only read tickets assigned to them or tickets in their own department
    // Specifically, staff cannot read external tickets or tickets assigned to others outside their department
    if (req.user.role === 'staff') {
      const isAssigned = report.assignedTo && report.assignedTo._id.toString() === req.user.userId.toString()
      const staffUser = await findInScope(User, req, req.user.userId)
      const isSameDept = staffUser?.department && report.department && staffUser.department.toString() === report.department._id.toString()
      if (!isAssigned && !isSameDept) {
        return res.status(403).json({ message: 'Access denied: staff cannot access tickets outside their assignment/department' })
      }
    }

    const daysOpen = calculateDaysOpen(report.createdAt)
    const severityWeight = report.category?.severityWeight || 1
    const priorityScore = calculatePriorityScore({
      reportCount: report.reportCount,
      severityWeight,
      daysOpen,
      upvotes: report.upvotes.length,
    })

    const reportObj = report.toObject()
    reportObj.priorityScore = priorityScore

    // Part 8: Same-city report responses include handledBy: { name, agencyType, agencyCode, isExternal }
    // and, if forwarded, agencyReference.
    if (report.department) {
      reportObj.handledBy = {
        name: report.department.name || '',
        agencyType: report.department.agencyType || 'municipal',
        agencyCode: report.department.agencyCode || null,
        isExternal: !!report.department.isExternal,
      }
    } else {
      reportObj.handledBy = null
    }

    if (report.forwarding && report.forwarding.agencyReference) {
      reportObj.agencyReference = report.forwarding.agencyReference
    }
    if (report.forwarding && report.forwarding.forwardedAt) {
      reportObj.forwardedAt = report.forwarding.forwardedAt
    }

    // Admins additionally get routedBy and routingHistory.
    // Citizens and staff never get routedBy, routingHistory, locationMatch, reporterHomeMunicipality, notes or staff private data.
    if (req.user.role !== 'admin') {
      delete reportObj.routedBy
      delete reportObj.routingHistory
      delete reportObj.locationMatch
      delete reportObj.reporterHomeMunicipality
      if (req.user.role === 'citizen') {
        if (reportObj.assignedTo) {
          reportObj.assignedTo = {
            _id: reportObj.assignedTo._id,
            name: reportObj.assignedTo.name,
          }
        }
        // Expose only forwardedAt and agencyReference on root; never expose forwarding.note or forwarding.forwardedBy
        delete reportObj.forwarding
      }
    }

    // If caller is another citizen and report is anonymous or not the reporter, sanitize reporter identity
    const isOwner = req.user.role === 'citizen' && (
      (report.citizen && report.citizen._id.toString() === req.user.userId.toString()) ||
      report.reportedBy?.some((u) => u._id.toString() === req.user.userId.toString())
    )

    if (req.user.role === 'citizen' && !isOwner) {
      if (reportObj.isAnonymous) {
        reportObj.citizen = null
        reportObj.reportedBy = []
      }
    }

    res.status(200).json({ report: reportObj })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching report' })
  }
}

// Add a comment to a report (any logged-in role in same municipality)
export const addComment = async (req, res) => {
  try {
    const { id } = req.params
    const { text } = req.body
    const userId = req.user.userId
    const userRole = req.user.role

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' })
    }

    let report
    if (userRole === 'citizen') {
      report = await Report.findOne({
        _id: id,
        $or: [
          { municipality: req.user.municipality },
          { citizen: userId },
          { reportedBy: userId },
        ],
      })
      if (!report) {
        return res.status(404).json({ message: 'Report not found' })
      }
    } else {
      report = await findInScope(Report, req, id)
    }

    const comment = {
      author: userId,
      authorRole: userRole,
      text: text.trim(),
      createdAt: new Date(),
    }

    report.comments.push(comment)
    await report.save()

    const updatedReport = await Report.findById(id)
      .populate('category', 'name')
      .populate('comments.author', 'name role')
    const newComment = updatedReport.comments[updatedReport.comments.length - 1]

    const { notifyUser, notifyAdmins } = await import('../utils/notify.js')
    const commentPayload = {
      reportId: report._id,
      ticketId: report.ticketId,
      category: updatedReport.category?.name || 'Civic Issue',
      comment: newComment,
      authorRole: userRole,
      authorName: req.user.name || 'User',
      message: `New comment on ${report.ticketId} by ${req.user.name || userRole}: "${text.trim().substring(0, 60)}${text.trim().length > 60 ? '...' : ''}"`,
    }

    if (userRole === 'citizen') {
      if (report.assignedTo) {
        notifyUser(report.assignedTo, 'new_comment', commentPayload)
      }
      notifyAdmins(report.municipality, 'new_comment', commentPayload)
    } else {
      const reporterIds = (report.reportedBy || []).map((u) => u.toString())
      if (report.citizen && !reporterIds.includes(report.citizen.toString())) {
        reporterIds.push(report.citizen.toString())
      }
      for (const repId of reporterIds) {
        if (repId !== userId.toString()) {
          notifyUser(repId, 'new_comment', commentPayload)
        }
      }
    }

    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error adding comment' })
  }
}

// Rate a resolved report (citizen only)
export const rateReport = async (req, res) => {
  try {
    const { id } = req.params
    const { score, feedback } = req.body
    const userId = req.user.userId

    const scoreNum = parseInt(score, 10)
    if (!scoreNum || scoreNum < 1 || scoreNum > 5) {
      return res.status(400).json({ message: 'Score must be a number between 1 and 5' })
    }

    let report = await Report.findOne({
      _id: id,
      $or: [
        { municipality: req.user.municipality },
        { citizen: userId },
      ],
    })
    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    if (report.citizen.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the report author can rate this report' })
    }

    if (report.status !== 'resolved') {
      return res.status(400).json({ message: 'You can only rate a resolved report' })
    }

    if (report.rating && report.rating.score) {
      return res.status(400).json({ message: 'You have already rated this report' })
    }

    report.rating = { score: scoreNum, feedback: feedback || '' }
    await report.save()

    res.status(200).json({
      message: 'Rating submitted successfully',
      rating: report.rating,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error submitting rating' })
  }
}

// Dispute a resolved report (citizen only)
export const disputeReport = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const userId = req.user.userId

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Dispute reason is required' })
    }

    let report = await Report.findOne({
      _id: id,
      $or: [
        { municipality: req.user.municipality },
        { citizen: userId },
      ],
    })
    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    if (report.citizen.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Only the report author can dispute this report' })
    }

    if (report.status !== 'resolved') {
      return res.status(400).json({ message: 'You can only dispute a resolved report' })
    }

    if (report.isDisputed) {
      return res.status(400).json({ message: 'This report has already been disputed' })
    }

    report.isDisputed = true
    report.disputeReason = reason.trim()
    report.status = 'disputed'
    await report.save()

    const { notifyAdmins } = await import('../utils/notify.js')
    const disputePayload = {
      reportId: report._id,
      ticketId: report.ticketId,
      category: (await Category.findById(report.category))?.name || 'Civic Issue',
      citizen: report.citizen,
      disputeReason: reason.trim(),
      message: `Citizen disputed resolution for ${report.ticketId}: "${reason.trim().substring(0, 60)}${reason.trim().length > 60 ? '...' : ''}"`,
    }
    notifyAdmins(report.municipality, 'dispute_created', disputePayload)

    res.status(200).json({
      message: 'Dispute submitted. The municipal admin will review this report.',
      status: report.status,
      isDisputed: report.isDisputed,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error submitting dispute' })
  }
}

// Get nearby open reports in the same municipality (any logged-in user)
export const getNearbyReports = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query
    const filter = scopeFilter(req)

    if (!lat || !lng) {
      return res.status(400).json({ message: 'lat and lng query parameters are required' })
    }

    const userLat = parseFloat(lat)
    const userLng = parseFloat(lng)
    const radiusMeters = parseFloat(radius) || 2000

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ message: 'Invalid lat/lng values' })
    }

    // Cap nearby results at 200 to prevent unbounded loads
    const NEARBY_CAP = 200

    const openReports = await Report.find({
      ...filter,
      status: { $in: ['reported', 'acknowledged', 'in_progress'] },
    })
      .populate('category', 'name severityWeight')
      .select('-citizen -reportedBy -comments -rating -disputeReason')
      .lean()

    const { haversineDistance } = await import('../algorithms/duplicateDetection.js')

    const nearbyReports = openReports
      .map((report) => {
        const distance = haversineDistance(
          userLat,
          userLng,
          report.location.lat,
          report.location.lng
        )
        return { report, distance }
      })
      .filter(({ distance }) => distance <= radiusMeters)
      .sort((a, b) => b.report.priorityScore - a.report.priorityScore)
      .slice(0, NEARBY_CAP)
      .map(({ report, distance }) => {
        const daysOpen = calculateDaysOpen(report.createdAt)
        const severityWeight = report.category?.severityWeight || 1
        const priorityScore = calculatePriorityScore({
          reportCount: report.reportCount,
          severityWeight,
          daysOpen,
          upvotes: report.upvotes?.length || 0,
        })

        return {
          id: report._id,
          ticketId: report.ticketId,
          category: report.category?.name,
          description: report.description,
          photoUrl: report.photoUrl,
          location: report.location,
          status: report.status,
          upvoteCount: report.upvotes?.length || 0,
          reportCount: report.reportCount,
          priorityScore,
          distanceMeters: Math.round(distance),
          createdAt: report.createdAt,
        }
      })

    res.status(200).json({
      count: nearbyReports.length,
      reports: nearbyReports,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching nearby reports' })
  }
}

// GET /api/reports/map (admin or authenticated staff, scoped to municipality)
// Returns bounded map points with optional bounding box and hard cap (default 300, max 500)
export const getMapReports = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const { minLat, minLng, maxLat, maxLng, status, department, category, limit } = req.query

    const query = { ...filter }

    // Bounding box filter if supplied
    if (minLat && minLng && maxLat && maxLng) {
      const parsedMinLat = parseFloat(minLat)
      const parsedMinLng = parseFloat(minLng)
      const parsedMaxLat = parseFloat(maxLat)
      const parsedMaxLng = parseFloat(maxLng)

      if (![parsedMinLat, parsedMinLng, parsedMaxLat, parsedMaxLng].some(isNaN)) {
        query['location.lat'] = { $gte: parsedMinLat, $lte: parsedMaxLat }
        query['location.lng'] = { $gte: parsedMinLng, $lte: parsedMaxLng }
      }
    }

    if (status && status !== 'all') {
      if (status === 'open') {
        query.status = { $ne: 'resolved' }
      } else {
        query.status = status
      }
    }

    if (department) query.department = department
    if (category) query.category = category

    const cap = Math.min(Math.max(parseInt(limit, 10) || 300, 1), 500)

    const reports = await Report.find(query)
      .select('ticketId category department handledBy status isEscalated priorityScore location createdAt updatedAt')
      .populate('category', 'name severityWeight')
      .populate('department', 'name key agencyType isExternal')
      .sort({ priorityScore: -1, createdAt: -1 })
      .limit(cap)
      .lean()

    res.status(200).json({
      count: reports.length,
      cap,
      reports,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching map reports' })
  }
}

// Get staff's assigned tickets (staff only, in staff's municipality)
export const getAssignedReports = async (req, res) => {
  try {
    const staffId = req.user.userId
    const filter = scopeFilter(req)

    const { parsePagination, buildPagination } = await import('../utils/pagination.js')
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 })

    const queryFilter = { ...filter, assignedTo: staffId }
    const [rawReports, total] = await Promise.all([
      Report.find(queryFilter)
        .populate('category', 'name severityWeight')
        .populate('department', 'name')
        .populate('citizen', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ priorityScore: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(queryFilter),
    ])

    const reportsWithPriority = rawReports.map((r) => {
      const daysOpen = calculateDaysOpen(r.createdAt)
      const severityWeight = r.category?.severityWeight || 1
      r.priorityScore = calculatePriorityScore({
        reportCount: r.reportCount,
        severityWeight,
        daysOpen,
        upvotes: r.upvotes?.length || 0,
      })
      return r
    })

    res.status(200).json({
      reports: reportsWithPriority,
      pagination: buildPagination({ page, limit, total }),
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching assigned reports' })
  }
}

// Get all reports in staff's department (staff only, in same municipality)
export const getDepartmentReports = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const staff = await findInScope(User, req, req.user.userId)

    if (!staff || !staff.department) {
      return res.status(400).json({ message: 'Staff must be assigned to a department' })
    }

    const { parsePagination, buildPagination } = await import('../utils/pagination.js')
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 })

    const queryFilter = { ...filter, department: staff.department }
    const [rawReports, total] = await Promise.all([
      Report.find(queryFilter)
        .populate('category', 'name severityWeight')
        .populate('department', 'name')
        .populate('citizen', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ priorityScore: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(queryFilter),
    ])

    const reportsWithPriority = rawReports.map((r) => {
      const daysOpen = calculateDaysOpen(r.createdAt)
      const severityWeight = r.category?.severityWeight || 1
      r.priorityScore = calculatePriorityScore({
        reportCount: r.reportCount,
        severityWeight,
        daysOpen,
        upvotes: r.upvotes?.length || 0,
      })
      return r
    })

    res.status(200).json({
      reports: reportsWithPriority,
      pagination: buildPagination({ page, limit, total }),
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching department reports' })
  }
}

// Update report status (staff only, must be assigned to this report and in same municipality)
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, resolutionNote } = req.body
    const staffId = req.user.userId

    const ALLOWED_STATUSES = ['acknowledged', 'in_progress', 'resolved']
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Staff can only set: ${ALLOWED_STATUSES.join(', ')}`,
      })
    }

    const report = await findInScope(Report, req, id, { path: 'category', select: 'severityWeight' })

    const staff = await findInScope(User, req, staffId)
    if (!staff || !staff.department || !report.department || staff.department.toString() !== report.department.toString()) {
      return res.status(403).json({
        message: 'You are not in the same department as this report and cannot update its status',
      })
    }

    const TRANSITIONS = {
      reported: ['acknowledged'],
      acknowledged: ['in_progress'],
      in_progress: ['resolved'],
    }
    const allowedNext = TRANSITIONS[report.status] || []
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from '${report.status}' to '${status}'. Allowed next status: ${allowedNext.join(', ') || 'none'}`,
      })
    }

    if (status === 'resolved') {
      if (!resolutionNote || !resolutionNote.trim()) {
        return res.status(400).json({ message: 'A resolution note is required when marking a report as resolved' })
      }

      if (!req.file) {
        return res.status(400).json({ message: 'An after-photo is required when marking a report as resolved' })
      }

      try {
        const file = await toFile(req.file.buffer, req.file.originalname, {
          type: req.file.mimetype,
        })
        const uploadResponse = await imagekit.files.upload({
          file,
          fileName: `resolution-${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
          useUniqueFileName: true,
          folder: '/nivaran/resolutions',
        })
        if (!uploadResponse || !uploadResponse.url) {
          throw new Error('ImageKit upload did not return a URL')
        }
        report.resolutionPhotoUrl = uploadResponse.url
      } catch (uploadError) {
        console.error('Resolution photo upload error:', uploadError)
        return res.status(500).json({ message: 'Failed to upload resolution photo' })
      }

      report.resolutionNote = resolutionNote.trim()
      report.resolvedAt = new Date()
    } else {
      report.resolvedAt = null
    }

    report.status = status

    const daysOpen = calculateDaysOpen(report.createdAt)
    const severityWeight = report.category?.severityWeight || 1
    report.priorityScore = calculatePriorityScore({
      reportCount: report.reportCount,
      severityWeight,
      daysOpen,
      upvotes: report.upvotes.length,
    })

    await report.save()

    const { notifyUser } = await import('../utils/notify.js')
    const { sendStatusUpdateEmail, sendResolvedEmail } = await import('../utils/sendEmail.js')

    const reporterUserIds = (report.reportedBy || []).map((u) => u.toString())
    if (report.citizen && !reporterUserIds.includes(report.citizen.toString())) {
      reporterUserIds.push(report.citizen.toString())
    }

    const populatedReport = await Report.findById(id).populate('category', 'name')
    const categoryName = populatedReport.category?.name || 'Civic Issue'

    const statusPayload = {
      reportId: report._id,
      ticketId: report.ticketId,
      status: report.status,
      category: categoryName,
      resolutionNote: report.resolutionNote || null,
      resolutionPhotoUrl: report.resolutionPhotoUrl || null,
      message: `Status update: Report ${report.ticketId} is now ${status.toUpperCase().replace('_', ' ')}`,
    }

    const reporterDocs = await User.find({ _id: { $in: reporterUserIds } }).select('email name')

    for (const reporter of reporterDocs) {
      notifyUser(reporter._id, 'status_update', statusPayload)

      if (reporter.email) {
        if (status === 'resolved') {
          sendResolvedEmail(reporter.email, {
            ticketId: report.ticketId,
            category: categoryName,
            resolutionNote: report.resolutionNote,
            reportId: report._id,
          }).catch((err) => console.error('Error sending resolve email:', err.message))
        } else {
          sendStatusUpdateEmail(reporter.email, {
            ticketId: report.ticketId,
            status: report.status,
            category: categoryName,
            resolutionNote: report.resolutionNote,
          }).catch((err) => console.error('Error sending status email:', err.message))
        }
      }
    }

    res.status(200).json({
      message: `Report status updated to '${status}'`,
      report: {
        id: report._id,
        ticketId: report.ticketId,
        status: report.status,
        resolutionPhotoUrl: report.resolutionPhotoUrl,
        resolutionNote: report.resolutionNote,
        priorityScore: report.priorityScore,
      },
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error updating report status' })
  }
}

// GET /api/reports (admin only, scoped to admin's municipality)
// If departmentUnresolved is present, surfaces those first
export const getAllReports = async (req, res) => {
  try {
    const { status, department, category, escalated, unresolved } = req.query
    const filter = scopeFilter(req)

    if (status) {
      filter.status = status
    }
    if (department) {
      filter.department = department
    }
    if (category) {
      filter.category = category
    }
    if (escalated === 'true') {
      filter.isEscalated = true
    } else if (escalated === 'false') {
      filter.isEscalated = false
    }
    if (unresolved === 'true') {
      filter.departmentUnresolved = true
    } else if (unresolved === 'false') {
      filter.departmentUnresolved = false
    }

    const { parsePagination, buildPagination } = await import('../utils/pagination.js')
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 })

    const [rawReports, total] = await Promise.all([
      Report.find(filter)
        .populate('category', 'name severityWeight slaHours departmentKey')
        .populate('department', 'name key agencyType agencyCode isExternal')
        .populate('citizen', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ departmentUnresolved: -1, priorityScore: -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(filter),
    ])

    const enrichedReports = rawReports.map((r) => {
      const daysOpen = calculateDaysOpen(r.createdAt)
      const severityWeight = r.category?.severityWeight || 1
      let calculatedPriority = calculatePriorityScore({
        reportCount: r.reportCount,
        severityWeight,
        daysOpen,
        upvotes: r.upvotes?.length || 0,
      })
      if (r.isEscalated) {
        calculatedPriority += 50
      }
      r.priorityScore = calculatedPriority
      r.daysOpen = daysOpen
      if (r.department) {
        r.handledBy = {
          name: r.department.name || '',
          agencyType: r.department.agencyType || 'municipal',
          agencyCode: r.department.agencyCode || null,
          isExternal: !!r.department.isExternal,
        }
      } else {
        r.handledBy = null
      }
      return r
    })

    res.status(200).json({
      reports: enrichedReports,
      pagination: buildPagination({ page, limit, total }),
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching reports' })
  }
}


// PATCH /api/reports/:id/assign (admin only, scoped to municipality)
export const assignReport = async (req, res) => {
  try {
    const { id } = req.params
    const { staffId } = req.body
    const filter = scopeFilter(req)

    const report = await findInScope(Report, req, id, 'category department')

    if (report.department && report.department.isExternal) {
      const agencyName = report.department.name || report.department.agencyCode || 'external agency'
      return res.status(409).json({
        message: `Handled by ${agencyName}; cannot be assigned to city staff`,
      })
    }

    let targetStaff = null

    if (staffId) {
      targetStaff = await findInScope(User, req, staffId)
      if (targetStaff.role !== 'staff' || !targetStaff.isVerified) {
        return res.status(400).json({ message: 'Selected staff member is not valid or not verified' })
      }
      // Step 4: Check application status
      if (targetStaff.applicationStatus !== 'approved') {
        return res.status(400).json({ message: 'Selected staff member is not approved' })
      }
    } else {
      const deptId = report.department?._id || report.department
      if (!deptId) {
        return res.status(400).json({
          message: 'Cannot auto-assign: Ticket has unresolved department. Please assign manually or resolve department.',
        })
      }

      const deptStaff = await User.find({
        role: 'staff',
        department: deptId,
        municipality: filter.municipality,
        isVerified: true,
        applicationStatus: 'approved', // Step 4: Only approved staff
      })

      if (!deptStaff || deptStaff.length === 0) {
        return res.status(400).json({
          message: 'No verified and approved staff members found in this department for auto-assignment in your municipality',
        })
      }

      const staffWorkloads = await Promise.all(
        deptStaff.map(async (staff) => {
          const openCount = await Report.countDocuments({
            municipality: filter.municipality,
            assignedTo: staff._id,
            status: { $ne: 'resolved' },
          })
          return { staff, count: openCount }
        })
      )

      staffWorkloads.sort((a, b) => a.count - b.count)
      targetStaff = staffWorkloads[0].staff
    }

    report.assignedTo = targetStaff._id
    if (report.status === 'reported') {
      report.status = 'acknowledged'
    }

    await report.save()

    const populated = await Report.findById(id)
      .populate('category', 'name severityWeight slaHours')
      .populate('department', 'name')
      .populate('assignedTo', 'name email')

    const { notifyUser } = await import('../utils/notify.js')
    notifyUser(targetStaff._id, 'new_assignment', {
      reportId: populated._id,
      ticketId: populated.ticketId,
      category: populated.category?.name || 'Civic Issue',
      department: populated.department?.name || 'Department',
      priorityScore: populated.priorityScore,
      slaDeadline: populated.slaDeadline,
      status: populated.status,
      message: `📋 New ticket assigned to you: ${populated.ticketId} (${populated.category?.name || 'Issue'})`,
    })

    res.status(200).json({
      message: `Ticket successfully assigned to ${targetStaff.name}`,
      report: populated,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error assigning report' })
  }
}

// GET /api/reports/disputed (admin only, scoped to municipality)
export const getDisputedReports = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const { parsePagination, buildPagination } = await import('../utils/pagination.js')
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 })

    const queryFilter = { ...filter, status: 'disputed' }
    const [disputedReports, total] = await Promise.all([
      Report.find(queryFilter)
        .populate('category', 'name severityWeight slaHours')
        .populate('department', 'name')
        .populate('citizen', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(queryFilter),
    ])

    res.status(200).json({
      reports: disputedReports,
      pagination: buildPagination({ page, limit, total }),
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching disputed reports' })
  }
}

// PATCH /api/reports/:id/resolve-dispute (admin only, scoped to municipality)
export const resolveDispute = async (req, res) => {
  try {
    const { id } = req.params
    const { action, note, staffId } = req.body
    const adminUser = req.user

    if (!action || !['reassign', 'mark_resolved', 'escalate_further'].includes(action)) {
      return res.status(400).json({
        message: "Invalid action. Must be 'reassign', 'mark_resolved', or 'escalate_further'",
      })
    }

    const report = await findInScope(Report, req, id, 'category department')

    if (report.status !== 'disputed' && !report.isDisputed) {
      return res.status(400).json({ message: 'Report is not currently marked as disputed' })
    }

    if (action === 'reassign') {
      report.status = 'in_progress'
      report.isDisputed = false
      report.resolvedAt = null

      if (staffId) {
        const staffExists = await findInScope(User, req, staffId)
        if (staffExists) {
          report.assignedTo = staffId
        }
      }

      report.comments.push({
        author: adminUser.userId,
        authorRole: 'admin',
        text: `[Admin Dispute Resolution: Reopened] ${note || 'Issue reopened for further work.'}`,
        createdAt: new Date(),
      })
    } else if (action === 'mark_resolved') {
      report.status = 'resolved'
      report.isDisputed = false
      if (!report.resolvedAt) {
        report.resolvedAt = new Date()
      }

      report.comments.push({
        author: adminUser.userId,
        authorRole: 'admin',
        text: `[Admin Dispute Resolution: Confirmed Resolved] ${note || 'Admin reviewed dispute and confirmed resolution.'}`,
        createdAt: new Date(),
      })
    } else if (action === 'escalate_further') {
      report.isEscalated = true
      report.escalatedAt = new Date()

      report.comments.push({
        author: adminUser.userId,
        authorRole: 'admin',
        text: `[Admin Dispute Resolution: Escalated Further] Flagged for executive/higher review. ${note || ''}`.trim(),
        createdAt: new Date(),
      })
    }

    await report.save()

    const { notifyUser } = await import('../utils/notify.js')
    const resolutionPayload = {
      reportId: report._id,
      ticketId: report.ticketId,
      category: report.category?.name || 'Civic Issue',
      action,
      note: (note || '').trim(),
      message: `Admin ${action === 'reassign' ? 'reopened' : action === 'mark_resolved' ? 'confirmed resolution' : 'escalated'} your dispute for ${report.ticketId}`,
    }
    notifyUser(report.citizen, 'dispute_resolved', resolutionPayload)

    const updated = await Report.findById(id)
      .populate('category', 'name severityWeight slaHours')
      .populate('department', 'name')
      .populate('citizen', 'name email')
      .populate('assignedTo', 'name email')
      .populate('comments.author', 'name role')

    res.status(200).json({
      message: `Dispute action '${action}' processed successfully`,
      report: updated,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error processing dispute resolution' })
  }
}

// PATCH /api/reports/:id/reassign-department (city admin only, tenant-scoped)
export const reassignDepartment = async (req, res) => {
  try {
    const { id } = req.params
    // Accept both targetDepartmentId (sent by the UI) and departmentId (legacy / test compatibility)
    const { targetDepartmentId, departmentId: legacyDepartmentId, reason } = req.body
    const departmentId = targetDepartmentId || legacyDepartmentId
    const adminUser = req.user

    if (!departmentId) {
      return res.status(400).json({ message: 'Target departmentId is required' })
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({ message: 'A valid reason with at least 5 characters is required' })
    }

    const report = await findInScope(Report, req, id, 'department')

    if (report.status === 'resolved' || report.status === 'closed') {
      return res.status(409).json({ message: `Cannot reassign a report with status '${report.status}'` })
    }

    const targetDept = await Department.findOne({
      _id: departmentId,
      municipality: adminUser.municipality,
    })

    if (!targetDept) {
      return res.status(404).json({ message: 'Target department not found in your municipality' })
    }

    if (targetDept.isExternal) {
      return res.status(400).json({ message: 'Cannot reassign to an external agency department. Use forward instead.' })
    }

    if (!targetDept.isActive) {
      return res.status(400).json({ message: 'Target department must be active' })
    }

    const oldDeptId = report.department?._id || report.department

    // Clear previous assignee and forwarding
    report.assignedTo = null
    report.forwarding = null
    report.department = targetDept._id
    report.departmentUnresolved = false

    // Auto-assign to staff member in target department
    const deptStaff = await User.find({
      role: 'staff',
      department: targetDept._id,
      municipality: adminUser.municipality,
      isVerified: true,
      applicationStatus: 'approved',
    })

    if (deptStaff.length > 0) {
      const staffWorkloads = await Promise.all(
        deptStaff.map(async (staff) => {
          const openCount = await Report.countDocuments({
            municipality: adminUser.municipality,
            assignedTo: staff._id,
            status: { $ne: 'resolved' },
          })
          return { staff, count: openCount }
        })
      )
      staffWorkloads.sort((a, b) => a.count - b.count)
      report.assignedTo = staffWorkloads[0].staff._id
    }

    // Append routing history
    report.routingHistory.push({
      at: new Date(),
      action: 'reassign',
      fromDepartment: oldDeptId,
      toDepartment: targetDept._id,
      byUser: adminUser.userId,
      reason: reason.trim(),
    })

    await report.save()

    // Audit log
    const AuditLog = (await import('../models/AuditLog.js')).default
    await AuditLog.create({
      actor: adminUser.userId,
      actorEmail: adminUser.email,
      action: 'report.reassign_department',
      targetMunicipality: adminUser.municipality,
      targetUser: report.citizen,
      meta: {
        reportId: report._id,
        ticketId: report.ticketId,
        fromDepartment: oldDeptId,
        toDepartment: targetDept._id,
        toDepartmentName: targetDept.name,
        assignedTo: report.assignedTo,
        reason: reason.trim(),
      },
    })

    // Notify citizen
    const { notifyUser } = await import('../utils/notify.js')
    notifyUser(report.citizen, 'report_reassigned', {
      reportId: report._id,
      ticketId: report.ticketId,
      message: `Your report has been reassigned to ${targetDept.name}`,
    })

    res.status(200).json({
      message: 'Report successfully reassigned to new department',
      report,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error reassigning department' })
  }
}

// POST /api/reports/:id/forward (city admin only, tenant-scoped)
export const forwardReport = async (req, res) => {
  try {
    const { id } = req.params
    const { departmentId, agencyReference, note } = req.body
    const adminUser = req.user

    if (!departmentId) {
      return res.status(400).json({ message: 'Target agency departmentId is required' })
    }

    if (!note || typeof note !== 'string' || note.trim().length < 5) {
      return res.status(400).json({ message: 'A forwarding note with at least 5 characters is required' })
    }

    if (agencyReference && typeof agencyReference === 'string' && agencyReference.length > 100) {
      return res.status(400).json({ message: 'Agency reference cannot exceed 100 characters' })
    }

    const report = await findInScope(Report, req, id, 'department')

    if (report.status === 'resolved' || report.status === 'closed') {
      return res.status(409).json({ message: `Cannot forward a report with status '${report.status}'` })
    }

    const targetAgency = await Department.findOne({
      _id: departmentId,
      municipality: adminUser.municipality,
    })

    if (!targetAgency) {
      return res.status(404).json({ message: 'Target agency not found in your municipality' })
    }

    if (!targetAgency.isExternal) {
      return res.status(400).json({ message: 'Cannot forward to a municipal department. Target must be an external agency.' })
    }

    if (!targetAgency.isActive) {
      return res.status(400).json({ message: 'Target agency department must be active' })
    }

    const oldDeptId = report.department?._id || report.department

    report.department = targetAgency._id
    report.departmentUnresolved = false
    report.assignedTo = null

    report.forwarding = {
      forwardedAt: new Date(),
      forwardedBy: adminUser.userId,
      agencyReference: agencyReference ? agencyReference.trim() : '',
      note: note.trim(),
    }

    report.routingHistory.push({
      at: new Date(),
      action: 'forward',
      fromDepartment: oldDeptId,
      toDepartment: targetAgency._id,
      byUser: adminUser.userId,
      reason: note.trim(),
    })

    await report.save()

    // Audit log
    const AuditLog = (await import('../models/AuditLog.js')).default
    await AuditLog.create({
      actor: adminUser.userId,
      actorEmail: adminUser.email,
      action: 'report.forward_external',
      targetMunicipality: adminUser.municipality,
      targetUser: report.citizen,
      meta: {
        reportId: report._id,
        ticketId: report.ticketId,
        agencyId: targetAgency._id,
        agencyName: targetAgency.name,
        agencyCode: targetAgency.agencyCode,
        agencyReference: report.forwarding.agencyReference,
        note: note.trim(),
      },
    })

    // Notify citizen
    const { notifyUser } = await import('../utils/notify.js')
    notifyUser(report.citizen, 'report_forwarded', {
      reportId: report._id,
      ticketId: report.ticketId,
      agencyName: targetAgency.name,
      agencyReference: report.forwarding.agencyReference,
      message: `Your report has been forwarded to external agency: ${targetAgency.name}`,
    })

    res.status(200).json({
      message: 'Report successfully forwarded to external agency',
      report,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error forwarding report' })
  }
}

// PATCH /api/reports/:id/external-status (city admin only, tenant-scoped)
export const updateExternalStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, note } = req.body
    const adminUser = req.user

    const ALLOWED_STATUSES = ['acknowledged', 'in_progress', 'resolved']
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}`,
      })
    }

    if (!note || typeof note !== 'string' || note.trim().length < 10) {
      return res.status(400).json({ message: 'A note of at least 10 characters is required' })
    }

    const report = await findInScope(Report, req, id, 'department')

    if (report.status === 'resolved' || report.status === 'closed') {
      return res.status(409).json({ message: `Cannot update external status for report with status '${report.status}'` })
    }

    if (!report.department || !report.department.isExternal) {
      return res.status(409).json({ message: 'This action is only allowed on reports handled by an external agency' })
    }

    report.status = status
    if (status === 'resolved') {
      report.resolvedAt = new Date()
    }

    report.comments.push({
      author: adminUser.userId,
      authorRole: 'admin',
      text: `[External Agency Status Update: ${status}] ${note.trim()}`,
      createdAt: new Date(),
    })

    await report.save()

    // Audit log
    const AuditLog = (await import('../models/AuditLog.js')).default
    await AuditLog.create({
      actor: adminUser.userId,
      actorEmail: adminUser.email,
      action: 'report.external_status_update',
      targetMunicipality: adminUser.municipality,
      targetUser: report.citizen,
      meta: {
        reportId: report._id,
        ticketId: report.ticketId,
        newStatus: status,
        agencyName: report.department.name,
        note: note.trim(),
      },
    })

    // Notify citizen
    const { notifyUser } = await import('../utils/notify.js')
    notifyUser(report.citizen, 'status_updated', {
      reportId: report._id,
      ticketId: report.ticketId,
      status,
      message: `Status updated to ${status} for report handled by ${report.department.name}`,
    })

    res.status(200).json({
      message: `External ticket status updated to '${status}' successfully`,
      report,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error updating external report status' })
  }
}

