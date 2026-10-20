import express from 'express'
import { createCityRequest } from '../controllers/cityRequestController.js'
import { authLimiter } from '../middleware/rateLimiters.js'

const router = express.Router()

// POST /api/city-requests (public, rate limited like sensitive public routes)
router.post('/', authLimiter, createCityRequest)

export default router
