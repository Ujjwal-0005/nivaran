import express from 'express'
import {
  getAdminCategorySettings,
  updateAdminCategorySettings,
  deleteAdminCategorySettings,
} from '../controllers/categoryConfigController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// City Admin only: manage per-city category configurations
router.use(auth, roleCheck('admin'))

// Must belong to a municipality (reject Super Admin)
router.use((req, res, next) => {
  if (!req.user.municipality) {
    return res.status(403).json({ message: 'Only city admins can access category settings' })
  }
  next()
})

router.get('/', getAdminCategorySettings)
router.put('/:categoryId', updateAdminCategorySettings)
router.delete('/:categoryId', deleteAdminCategorySettings)

export default router
