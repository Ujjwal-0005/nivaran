import express from 'express'
import { getAllStaff, getStaffTickets } from '../controllers/staffController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// All routes are admin-only
router.get('/', auth, roleCheck('admin'), getAllStaff)
router.get('/:id/tickets', auth, roleCheck('admin'), getStaffTickets)

export default router
