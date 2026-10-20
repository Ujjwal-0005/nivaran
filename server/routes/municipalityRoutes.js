import express from 'express'
import {
  getActiveMunicipalities,
  getMunicipalityDepartments,
  resolveMunicipality,
} from '../controllers/municipalityController.js'

const router = express.Router()

// Public endpoints
router.get('/', getActiveMunicipalities)
router.get('/resolve', resolveMunicipality)
router.get('/:id/departments', getMunicipalityDepartments)

export default router
