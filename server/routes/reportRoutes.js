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
  getAssignedReports,
  getDepartmentReports,
  updateStatus,
  getAllReports,
  assignReport,
  getDisputedReports,
  resolveDispute,
} from '../controllers/reportController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'
import upload from '../middleware/upload.js'

const router = express.Router()

// ── Ordering note ─────────────────────────────────────────────────────────────
// Static path segments (/nearby, /mine, /assigned, /disputed) MUST come before /:id
// to prevent Express from treating them as MongoDB ObjectId params.
// ─────────────────────────────────────────────────────────────────────────────

// Phase 7: Get all disputed reports (admin only)
router.get('/disputed', auth, roleCheck('admin'), getDisputedReports)

// Phase 7: Get all reports (admin only)
router.get('/', auth, roleCheck('admin'), getAllReports)

// Get nearby open reports (any logged-in user)
router.get('/nearby', auth, getNearbyReports)

// Get citizen's own reports (citizen only)
router.get('/mine', auth, roleCheck('citizen'), getMyReports)

// Phase 6: Get staff's assigned tickets (staff only)
router.get('/assigned', auth, roleCheck('staff'), getAssignedReports)

// Phase 6: Get all reports in staff's department (staff only)
router.get('/department', auth, roleCheck('staff'), getDepartmentReports)

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

// Phase 7: Assign ticket to staff (admin only)
router.patch('/:id/assign', auth, roleCheck('admin'), assignReport)

// Phase 7: Resolve citizen dispute (admin only)
router.patch('/:id/resolve-dispute', auth, roleCheck('admin'), resolveDispute)

// Phase 6: Update report status (staff only, must be assigned)
// Uses upload middleware — for resolved status an after-photo is required
router.patch(
  '/:id/status',
  auth,
  roleCheck('staff'),
  upload.single('resolutionPhoto'),
  updateStatus
)

// Get single report by ID (any logged-in user)
router.get('/:id', auth, getReportById)

export default router
