import express from 'express'
import { getSetupStatus } from '../controllers/setupStatusController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// City admin only
router.get('/', auth, roleCheck('admin'), getSetupStatus)

export default router
