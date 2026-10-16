import express from 'express'
import { getActiveMunicipalities } from '../controllers/municipalityController.js'

const router = express.Router()

// Public endpoint
router.get('/', getActiveMunicipalities)

export default router
