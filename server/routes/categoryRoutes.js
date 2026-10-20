import express from 'express'
import { getCategories, createCategory, updateCategory } from '../controllers/categoryController.js'
import { auth, optionalAuth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// Get all categories (public/authenticated with optionalAuth)
router.get('/', optionalAuth, getCategories)

// Admin CRUD (National shared taxonomy - Super Admin only)
router.post('/', auth, roleCheck('superadmin'), createCategory)
router.patch('/:id', auth, roleCheck('superadmin'), updateCategory)

export default router
