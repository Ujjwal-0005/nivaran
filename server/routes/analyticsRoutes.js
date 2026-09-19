import express from 'express'
import {
  getOverviewAnalytics,
  getCategoryAnalytics,
  getDepartmentAnalytics,
  getTrendAnalytics,
  getStaffLeaderboard,
  getZoneAnalytics,
} from '../controllers/analyticsController.js'
import { auth } from '../middleware/auth.js'
import { roleCheck } from '../middleware/roleCheck.js'

const router = express.Router()

// All analytics routes require admin privileges
router.use(auth, roleCheck('admin'))

router.get('/overview', getOverviewAnalytics)
router.get('/by-category', getCategoryAnalytics)
router.get('/by-department', getDepartmentAnalytics)
router.get('/trends', getTrendAnalytics)
router.get('/staff-leaderboard', getStaffLeaderboard)
router.get('/zones', getZoneAnalytics)

export default router
