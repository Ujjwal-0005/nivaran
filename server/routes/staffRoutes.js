import express from 'express'
import {
  getAllStaff,
  getStaffTickets,
  getStaffApplications,
  approveStaffApplication,
  rejectStaffApplication,
  revokeStaff,
  reconsiderStaffApplication,
} from '../controllers/staffController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// All routes are admin-only
// Step 3: Staff application management routes (admin only) - must come before parameterized routes
router.get('/applications', auth, roleCheck('admin'), getStaffApplications)
router.post('/applications/:id/approve', auth, roleCheck('admin'), approveStaffApplication)
router.post('/applications/:id/reject', auth, roleCheck('admin'), rejectStaffApplication)
router.post('/applications/:id/reconsider', auth, roleCheck('admin'), reconsiderStaffApplication)

router.get('/', auth, roleCheck('admin'), getAllStaff)
router.get('/:id/tickets', auth, roleCheck('admin'), getStaffTickets)
router.post('/:id/revoke', auth, roleCheck('admin'), revokeStaff)

export default router
