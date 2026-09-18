import Report from '../models/Report.js'
import Category from '../models/Category.js'
import { checkForDuplicate } from '../algorithms/duplicateDetection.js'
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
    
    const { category, description, lat, lng, isAnonymous } = req.body
    const userId = req.user.userId

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

    // Check for duplicate (placeholder for Phase 4)
    const duplicateReport = await checkForDuplicate({
      category,
      location: { lat, lng },
    })

    if (duplicateReport) {
      return res.status(409).json({
        message: 'A similar report already exists',
        duplicateTicketId: duplicateReport.ticketId,
      })
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
      isAnonymous: isAnonymous || false,
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
      },
    })
  } catch (error) {
    console.error('Submit report error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ message: 'Server error during report submission' })
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

    res.status(200).json({ reports })
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

    res.status(200).json({ report })
  } catch (error) {
    console.error('Get report by ID error:', error)
    res.status(500).json({ message: 'Server error fetching report' })
  }
}
