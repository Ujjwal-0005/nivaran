import express from 'express'
import { getPublicTransparency } from '../controllers/analyticsController.js'

const router = express.Router()

// Publicly accessible - NO authentication required
router.get('/transparency', getPublicTransparency)

export default router
