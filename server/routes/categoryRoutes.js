import express from 'express'
import { getCategories, createCategory, updateCategory } from '../controllers/categoryController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// Get all categories (public/authenticated)
router.get('/', getCategories)

// Admin CRUD
router.post('/', auth, roleCheck('admin'), createCategory)
router.patch('/:id', auth, roleCheck('admin'), updateCategory)

export default router
