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
