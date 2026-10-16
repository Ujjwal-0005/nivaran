import Report from '../models/Report.js'
import Category from '../models/Category.js'
import Department from '../models/Department.js'
import User from '../models/User.js'
import { checkForDuplicate } from '../algorithms/duplicateDetection.js'
import { calculatePriorityScore, calculateDaysOpen } from '../algorithms/priorityScoring.js'
import imagekit from '../config/imagekit.js'
import { toFile } from '@imagekit/nodejs'
import { scopeFilter, findInScope } from '../utils/scope.js'

// Generate unique ticket ID
const generateTicketId = () => {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 90000) + 10000
  return `CIV-${year}-${random}`
}

// Submit a new report (citizen only)
export const submitReport = async (req, res) => {
  try {
    const { category, description, lat, lng, isAnonymous, forceNew } = req.body
    const userId = req.user.userId
    const userMunicipality = req.user.municipality

    if (!userMunicipality) {
      return res.status(403).json({ message: 'User does not belong to any municipality' })
    }

    const isAnonymousBool = isAnonymous === 'true' || isAnonymous === true
    const forceNewBool = forceNew === 'true' || forceNew === true

    if (!category || !description || !lat || !lng) {
      return res.status(400).json({ message: 'Category, description, and location are required' })
    }

    // Look up category
    const categoryDoc = await Category.findById(category)
    if (!categoryDoc) {
      return res.status(404).json({ message: 'Category not found' })
    }

    // Route to department in user's municipality by category.departmentKey
    let targetDept = null
    let departmentUnresolved = false

    if (categoryDoc.departmentKey) {
      targetDept = await Department.findOne({
        municipality: userMunicipality,
        key: categoryDoc.departmentKey,
      })
    }

    if (!targetDept) {
      departmentUnresolved = true
    }

    // Check for duplicate in user's municipality
    if (!forceNewBool) {
      const duplicateReport = await checkForDuplicate({
        category,
        location: { lat: parseFloat(lat), lng: parseFloat(lng) },
        municipality: userMunicipality,
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

    // Auto-assign to staff member in target department within same municipality
    let assignedStaffId = null
    if (targetDept) {
      const departmentStaff = await User.find({
        role: 'staff',
        department: targetDept._id,
        municipality: userMunicipality,
        isVerified: true,
      })

      if (departmentStaff.length > 0) {
        const staffWithCounts = await Promise.all(
          departmentStaff.map(async (staff) => {
            const count = await Report.countDocuments({
              municipality: userMunicipality,
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

    const slaHours = categoryDoc.slaHours || 48
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000)

    const reportData = {
      ticketId,
      municipality: userMunicipality,
      citizen: userId,
      category: categoryDoc._id,
      department: targetDept ? targetDept._id : null,
      departmentUnresolved,
      description,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
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
    const severityWeight = categoryDoc.severityWeight || 1
    report.priorityScore = calculatePriorityScore({
      reportCount: report.reportCount,
      severityWeight,
      daysOpen,
      upvotes: report.upvotes.length,
    })
    await report.save()

    res.status(201).json({
      message: 'Report submitted successfully',
      ticketId: report.ticketId,
      report: {
        id: report._id,
        ticketId: report.ticketId,
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
    const userId = req.user.userId

    const report = await findInScope(Report, req, id, 'category')

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
    const filter = scopeFilter(req)

    const reports = await Report.find({
      ...filter,
      $or: [
        { citizen: userId },
        { reportedBy: userId },
      ],
    })
      .populate('category')
      .populate('department')
      .populate('citizen', 'name email')
      .sort({ createdAt: -1 })

    const reportsWithPriority = reports.map((report) => {
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
      return reportObj
    })

    res.status(200).json({ reports: reportsWithPriority })
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

    const report = await findInScope(Report, req, id, [
      { path: 'category' },
      { path: 'department' },
      { path: 'citizen', select: 'name email' },
      { path: 'reportedBy', select: 'name email' },
      { path: 'assignedTo', select: 'name email department' },
      { path: 'comments.author', select: 'name role' },
    ])

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

    const report = await findInScope(Report, req, id)

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

    const report = await findInScope(Report, req, id)

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

    const report = await findInScope(Report, req, id)

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

    const openReports = await Report.find({
      ...filter,
      status: { $in: ['reported', 'acknowledged', 'in_progress'] },
    })
      .populate('category', 'name severityWeight')
      .select('-citizen -reportedBy -comments -rating -disputeReason')

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
      .map(({ report, distance }) => {
        const daysOpen = calculateDaysOpen(report.createdAt)
        const severityWeight = report.category?.severityWeight || 1
        const priorityScore = calculatePriorityScore({
          reportCount: report.reportCount,
          severityWeight,
          daysOpen,
          upvotes: report.upvotes.length,
        })

        return {
          id: report._id,
          ticketId: report.ticketId,
          category: report.category?.name,
          description: report.description,
          photoUrl: report.photoUrl,
          location: report.location,
          status: report.status,
          upvoteCount: report.upvotes.length,
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

// Get staff's assigned tickets (staff only, in staff's municipality)
export const getAssignedReports = async (req, res) => {
  try {
    const staffId = req.user.userId
    const filter = scopeFilter(req)

    const reports = await Report.find({
      ...filter,
      assignedTo: staffId,
    })
      .populate('category', 'name severityWeight')
      .populate('department', 'name')
      .populate('citizen', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ priorityScore: -1 })

    const reportsWithPriority = reports.map((report) => {
      const daysOpen = calculateDaysOpen(report.createdAt)
      const severityWeight = report.category?.severityWeight || 1
      const priorityScore = calculatePriorityScore({
        reportCount: report.reportCount,
        severityWeight,
        daysOpen,
        upvotes: report.upvotes.length,
      })
      const obj = report.toObject()
      obj.priorityScore = priorityScore
      return obj
    })

    res.status(200).json({ reports: reportsWithPriority })
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

    const reports = await Report.find({
      ...filter,
      department: staff.department,
    })
      .populate('category', 'name severityWeight')
      .populate('department', 'name')
      .populate('citizen', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ priorityScore: -1 })

    const reportsWithPriority = reports.map((report) => {
      const daysOpen = calculateDaysOpen(report.createdAt)
      const severityWeight = report.category?.severityWeight || 1
      const priorityScore = calculatePriorityScore({
        reportCount: report.reportCount,
        severityWeight,
        daysOpen,
        upvotes: report.upvotes.length,
      })
      const obj = report.toObject()
      obj.priorityScore = priorityScore
      return obj
    })

    res.status(200).json({ reports: reportsWithPriority })
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
    const { status, department, category, escalated } = req.query
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

    // Sort unresolved departments to the top, then by priority score and createdAt
    const reports = await Report.find(filter)
      .populate('category', 'name severityWeight slaHours departmentKey')
      .populate('department', 'name key')
      .populate('citizen', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ departmentUnresolved: -1, priorityScore: -1, createdAt: -1 })

    const enrichedReports = reports.map((r) => {
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
      return {
        ...r.toObject(),
        priorityScore: calculatedPriority,
        daysOpen,
      }
    })

    res.status(200).json({ reports: enrichedReports })
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

    let targetStaff = null

    if (staffId) {
      targetStaff = await findInScope(User, req, staffId)
      if (targetStaff.role !== 'staff' || !targetStaff.isVerified) {
        return res.status(400).json({ message: 'Selected staff member is not valid or not verified' })
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
      })

      if (!deptStaff || deptStaff.length === 0) {
        return res.status(400).json({
          message: 'No verified staff members found in this department for auto-assignment in your municipality',
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
    const disputedReports = await Report.find({ ...filter, status: 'disputed' })
      .populate('category', 'name severityWeight slaHours')
      .populate('department', 'name')
      .populate('citizen', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ updatedAt: -1 })

    res.status(200).json({ reports: disputedReports })
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
