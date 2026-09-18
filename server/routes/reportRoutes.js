import express from 'express'
import { submitReport, getMyReports, getReportById, joinReport, upvoteReport } from '../controllers/reportController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'
import upload from '../middleware/upload.js'

const router = express.Router()

// Submit a new report (citizen only)
router.post(
  '/',
  auth,
  roleCheck('citizen'),
  upload.single('photo'),
  submitReport
)

// Join an existing report as duplicate (citizen only)
router.post(
  '/:id/join',
  auth,
  roleCheck('citizen'),
  joinReport
)

// Upvote a report (citizen only)
router.post(
  '/:id/upvote',
  auth,
  roleCheck('citizen'),
  upvoteReport
)

// Get citizen's own reports (citizen only)
router.get('/mine', auth, roleCheck('citizen'), getMyReports)

// Get single report by ID (any logged-in user)
router.get('/:id', auth, getReportById)

export default router
