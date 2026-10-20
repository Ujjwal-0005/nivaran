import express from 'express'
import {
  listAdminDepartments,
  getAdminDepartmentById,
  createAdminDepartment,
  updateAdminDepartment,
  setPrimaryDepartment,
  deactivateDepartment,
  activateDepartment,
  verifyDepartment,
} from '../controllers/adminDepartmentController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// All routes city admin only
router.use(auth)
router.use(roleCheck('admin'))

router.get('/', listAdminDepartments)
router.get('/:id', getAdminDepartmentById)
router.post('/', createAdminDepartment)
router.patch('/:id', updateAdminDepartment)
router.post('/:id/set-primary', setPrimaryDepartment)
router.post('/:id/deactivate', deactivateDepartment)
router.post('/:id/activate', activateDepartment)
router.post('/:id/verify', verifyDepartment)

export default router
