import express from 'express'
import { getCategories } from '../controllers/categoryController.js'

const router = express.Router()

// Get all categories (public endpoint)
router.get('/', getCategories)

export default router
