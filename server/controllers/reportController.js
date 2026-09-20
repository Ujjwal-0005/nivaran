import Report from '../models/Report.js'
import Category from '../models/Category.js'
import { checkForDuplicate } from '../algorithms/duplicateDetection.js'
import { calculatePriorityScore, calculateDaysOpen } from '../algorithms/priorityScoring.js'
import imagekit from '../config/imagekit.js'
import { toFile } from '@imagekit/nodejs'

// Generate unique ticket ID
const generateTicketId = () => {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 90000) + 10000
  return `CIV-${year}-${random}`
}

// Submit a new report (citizen only)
export const submitReport = async (req, res) => {
  try {
    console.log('Submit report - req.body:', req.body)
    console.log('Submit report - req.file:', req.file)
    
    const { category, description, lat, lng, isAnonymous, forceNew } = req.body
    const userId = req.user.userId

    const isAnonymousBool = isAnonymous === 'true' || isAnonymous === true
    const forceNewBool = forceNew === 'true' || forceNew === true

    // Validate required fields
    if (!category || !description || !lat || !lng) {
      return res.status(400).json({ message: 'Category, description, and location are required' })
    }

    // Look up category to get department
    const categoryDoc = await Category.findById(category).populate('department')
    if (!categoryDoc) {
      return res.status(404).json({ message: 'Category not found' })
    }

    if (!categoryDoc.department) {
      return res.status(400).json({ message: 'Category has no associated department' })
    }

    // Check for duplicate unless forceNew flag is set
    if (!forceNewBool) {
      const duplicateReport = await checkForDuplicate({
        category,
        location: { lat: parseFloat(lat), lng: parseFloat(lng) },
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

    // Create report
    const reportData = {
      ticketId,
      citizen: userId,
      category,
      department: categoryDoc.department._id,
      description,
      location: { lat: parseFloat(lat), lng: parseFloat(lng) },
      isAnonymous: isAnonymousBool,
      reportedBy: [userId],
    }

    // Add photo URL if uploaded
    if (req.file) {
      console.log('Photo uploaded, uploading to ImageKit...')
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
        console.log('ImageKit upload response:', uploadResponse)
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

    // Calculate initial priority score
    const daysOpen = calculateDaysOpen(report.createdAt)
    const severityWeight = categoryDoc.severityWeight || 1
    report.priorityScore = calculatePriorityScore({
      reportCount: report.reportCount,
      severityWeight,
      daysOpen,
      upvotes: report.upvotes.length,
    })
    await report.save()

    console.log('Report created with priority score:', report.priorityScore)

    res.status(201).json({
      message: 'Report submitted successfully',
      ticketId: report.ticketId,
      report: {
        id: report._id,
        ticketId: report.ticketId,
        category: categoryDoc.name,
        department: categoryDoc.department.name,
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
    console.error('Submit report error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ message: 'Server error during report submission' })
  }
}

// Upvote a report (citizen only)
export const upvoteReport = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.userId

    const report = await Report.findById(id).populate('category')
    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    // Check if user already upvoted
    if (report.upvotes.includes(userId)) {
      return res.status(400).json({ message: 'You have already upvoted this report' })
    }

    // Add user to upvotes array
    report.upvotes.push(userId)

    // Recalculate priority score
    const daysOpen = calculateDaysOpen(report.createdAt)
    const severityWeight = report.category.severityWeight || 1
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
    console.error('Upvote report error:', error)
    res.status(500).json({ message: 'Server error upvoting report' })
  }
}

// Join an existing report as a duplicate (citizen only)
export const joinReport = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.userId

    const report = await Report.findById(id).populate('category')
    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    // Check if user already reported this issue
    if (report.reportedBy.includes(userId)) {
      return res.status(400).json({ message: 'You have already reported this issue' })
    }

    // Add user to reportedBy array
    report.reportedBy.push(userId)
    report.reportCount += 1

    // Recalculate priority score
    const daysOpen = calculateDaysOpen(report.createdAt)
    const severityWeight = report.category.severityWeight || 1
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
    console.error('Join report error:', error)
    res.status(500).json({ message: 'Server error joining report' })
  }
}

// Get citizen's own reports
export const getMyReports = async (req, res) => {
  try {
    const userId = req.user.userId

    const reports = await Report.find({
      $or: [
        { citizen: userId },
        { reportedBy: userId },
      ],
    })
      .populate('category')
      .populate('department')
      .populate('citizen', 'name email')
      .sort({ createdAt: -1 })

    // Recalculate priority scores for all reports
    const reportsWithPriority = reports.map(report => {
      const daysOpen = calculateDaysOpen(report.createdAt)
      const severityWeight = report.category?.severityWeight || 1
      const priorityScore = calculatePriorityScore({
        reportCount: report.reportCount,
        severityWeight,
        daysOpen,
        upvotes: report.upvotes.length,
      })

      // Update the report object with calculated priority
      const reportObj = report.toObject()
      reportObj.priorityScore = priorityScore
      return reportObj
    })

    res.status(200).json({ reports: reportsWithPriority })
  } catch (error) {
    console.error('Get my reports error:', error)
    res.status(500).json({ message: 'Server error fetching reports' })
  }
}

// Get single report by ID
export const getReportById = async (req, res) => {
  try {
    const { id } = req.params

    const report = await Report.findById(id)
      .populate('category')
      .populate('department')
      .populate('citizen', 'name email')
      .populate('reportedBy', 'name email')
      .populate('comments.author', 'name role')

    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    // Recalculate priority score
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

    res.status(200).json({ report: reportObj })
  } catch (error) {
    console.error('Get report by ID error:', error)
    res.status(500).json({ message: 'Server error fetching report' })
  }
}

// Add a comment to a report (any logged-in role)
export const addComment = async (req, res) => {
  try {
    const { id } = req.params
    const { text } = req.body
    const userId = req.user.userId
    const userRole = req.user.role

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' })
    }

    const report = await Report.findById(id)
    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    const comment = {
      author: userId,
      authorRole: userRole,
      text: text.trim(),
      createdAt: new Date(),
    }

    report.comments.push(comment)
    await report.save()

    // Re-fetch with populated author for the response
    const updatedReport = await Report.findById(id).populate('comments.author', 'name role')
    const newComment = updatedReport.comments[updatedReport.comments.length - 1]

    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment,
    })
  } catch (error) {
    console.error('Add comment error:', error)
    res.status(500).json({ message: 'Server error adding comment' })
  }
}

// Rate a resolved report (citizen only)
export const rateReport = async (req, res) => {
  try {
    const { id } = req.params
    const { score, feedback } = req.body
    const userId = req.user.userId

    // Validate score
    const scoreNum = parseInt(score, 10)
    if (!scoreNum || scoreNum < 1 || scoreNum > 5) {
      return res.status(400).json({ message: 'Score must be a number between 1 and 5' })
    }

    const report = await Report.findById(id)
    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    // Only the original citizen can rate
    if (report.citizen.toString() !== userId) {
      return res.status(403).json({ message: 'Only the report author can rate this report' })
    }

    // Must be resolved
    if (report.status !== 'resolved') {
      return res.status(400).json({ message: 'You can only rate a resolved report' })
    }

    // Block duplicate rating
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
    console.error('Rate report error:', error)
    res.status(500).json({ message: 'Server error submitting rating' })
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

    const report = await Report.findById(id)
    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    // Only the original citizen can dispute
    if (report.citizen.toString() !== userId) {
      return res.status(403).json({ message: 'Only the report author can dispute this report' })
    }

    // Must be resolved to dispute
    if (report.status !== 'resolved') {
      return res.status(400).json({ message: 'You can only dispute a resolved report' })
    }

    // Prevent disputing again
    if (report.isDisputed) {
      return res.status(400).json({ message: 'This report has already been disputed' })
    }

    report.isDisputed = true
    report.disputeReason = reason.trim()
    report.status = 'disputed'
    await report.save()

    res.status(200).json({
      message: 'Dispute submitted. The municipal admin will review this report.',
      status: report.status,
      isDisputed: report.isDisputed,
    })
  } catch (error) {
    console.error('Dispute report error:', error)
    res.status(500).json({ message: 'Server error submitting dispute' })
  }
}

// Get nearby open reports (any logged-in user)
export const getNearbyReports = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query

    if (!lat || !lng) {
      return res.status(400).json({ message: 'lat and lng query parameters are required' })
    }

    const userLat = parseFloat(lat)
    const userLng = parseFloat(lng)
    const radiusMeters = parseFloat(radius) || 2000

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ message: 'Invalid lat/lng values' })
    }

    // Fetch all open reports (not resolved or disputed)
    const openReports = await Report.find({
      status: { $in: ['reported', 'acknowledged', 'in_progress'] },
    })
      .populate('category', 'name severityWeight')
      .select('-citizen -reportedBy -comments -rating -disputeReason')

    // Filter by haversine distance in-memory
    const { haversineDistance } = await import('../algorithms/duplicateDetection.js')

    const nearbyReports = openReports
      .map(report => {
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
    console.error('Get nearby reports error:', error)
    res.status(500).json({ message: 'Server error fetching nearby reports' })
  }
}

// ─────────────────────────────────────────────
// Phase 6 — Staff endpoints
// ─────────────────────────────────────────────

// Get staff's assigned tickets sorted by priority (staff only)
export const getAssignedReports = async (req, res) => {
  try {
    const staffId = req.user.userId

    const reports = await Report.find({ assignedTo: staffId })
      .populate('category', 'name severityWeight')
      .populate('department', 'name')
      .populate('citizen', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ priorityScore: -1 })

    // Recalculate live priority scores before responding
    const reportsWithPriority = reports.map(report => {
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
    console.error('Get assigned reports error:', error)
    res.status(500).json({ message: 'Server error fetching assigned reports' })
  }
}

// Update report status (staff only, must be assigned to this report)
// Supports: acknowledged → in_progress → resolved
// Resolving requires resolutionNote + after-photo (resolutionPhotoUrl)
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status, resolutionNote } = req.body
    const staffId = req.user.userId

    // Valid statuses staff can set
    const ALLOWED_STATUSES = ['acknowledged', 'in_progress', 'resolved']
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Staff can only set: ${ALLOWED_STATUSES.join(', ')}`,
      })
    }

    const report = await Report.findById(id).populate('category', 'severityWeight')
    if (!report) {
      return res.status(404).json({ message: 'Report not found' })
    }

    // Security: only the assigned staff member may update this ticket
    if (!report.assignedTo || report.assignedTo.toString() !== staffId) {
      return res.status(403).json({
        message: 'You are not assigned to this report and cannot update its status',
      })
    }

    // Enforce valid forward-only transitions
    const TRANSITIONS = {
      reported:     ['acknowledged'],
      acknowledged: ['in_progress'],
      in_progress:  ['resolved'],
    }
    const allowedNext = TRANSITIONS[report.status] || []
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from '${report.status}' to '${status}'. Allowed next status: ${allowedNext.join(', ') || 'none'}`,
      })
    }

    // Resolving requires an after-photo and a resolution note
    if (status === 'resolved') {
      if (!resolutionNote || !resolutionNote.trim()) {
        return res.status(400).json({ message: 'A resolution note is required when marking a report as resolved' })
      }

      if (!req.file) {
        return res.status(400).json({ message: 'An after-photo is required when marking a report as resolved' })
      }

      // Upload after-photo to ImageKit
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
    }

    report.status = status

    // Recalculate priority score after status change
    const daysOpen = calculateDaysOpen(report.createdAt)
    const severityWeight = report.category?.severityWeight || 1
    report.priorityScore = calculatePriorityScore({
      reportCount: report.reportCount,
      severityWeight,
      daysOpen,
      upvotes: report.upvotes.length,
    })

    await report.save()

    // TODO: Phase 8 — trigger real-time + email notification to reporters here

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
    console.error('Update status error:', error)
    res.status(500).json({ message: 'Server error updating report status' })
  }
}
