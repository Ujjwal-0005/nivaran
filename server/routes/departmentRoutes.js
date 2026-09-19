import express from 'express'
import {
  getDepartments,
  createDepartment,
  updateDepartment,
} from '../controllers/departmentController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// Get all departments
router.get('/', auth, getDepartments)

// Admin CRUD
router.post('/', auth, roleCheck('admin'), createDepartment)
router.patch('/:id', auth, roleCheck('admin'), updateDepartment)

export default router
