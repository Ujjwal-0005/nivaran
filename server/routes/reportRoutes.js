import express from 'express'
import {
  submitReport,
  getMyReports,
  getReportById,
  joinReport,
  upvoteReport,
  addComment,
  rateReport,
  disputeReport,
  getNearbyReports,
} from '../controllers/reportController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'
import upload from '../middleware/upload.js'

const router = express.Router()

// IMPORTANT: /nearby must come before /:id to prevent Express treating "nearby" as an ID
// Get nearby open reports (any logged-in user)
router.get('/nearby', auth, getNearbyReports)

// Get citizen's own reports (citizen only)
router.get('/mine', auth, roleCheck('citizen'), getMyReports)

// Submit a new report (citizen only)
router.post(
  '/',
  auth,
  roleCheck('citizen'),
  upload.single('photo'),
  submitReport
)

// Join an existing report as duplicate (citizen only)
router.post('/:id/join', auth, roleCheck('citizen'), joinReport)

// Upvote a report (citizen only)
router.post('/:id/upvote', auth, roleCheck('citizen'), upvoteReport)

// Add a comment (any logged-in role)
router.post('/:id/comments', auth, addComment)

// Rate a resolved report (citizen only)
router.post('/:id/rate', auth, roleCheck('citizen'), rateReport)

// Dispute a resolved report (citizen only)
router.post('/:id/dispute', auth, roleCheck('citizen'), disputeReport)

// Get single report by ID (any logged-in user)
router.get('/:id', auth, getReportById)

export default router
