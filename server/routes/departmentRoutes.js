import express from 'express'
import { getDepartments } from '../controllers/departmentController.js'
import {
  createAdminDepartment,
  updateAdminDepartment,
} from '../controllers/adminDepartmentController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// Get all active departments for caller municipality (minimal public fields)
router.get('/', auth, getDepartments)

// Backward-compatible routes for city admin that delegate strictly to guarded handlers
router.post('/', auth, roleCheck('admin'), createAdminDepartment)
router.patch('/:id', auth, roleCheck('admin'), updateAdminDepartment)

export default router
