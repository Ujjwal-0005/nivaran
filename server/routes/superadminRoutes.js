import express from 'express'
import { auth } from '../middleware/auth.js'
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js'
import { superadminWriteLimiter } from '../middleware/rateLimiters.js'
import {
  listMunicipalities,
  getMunicipality,
  createMunicipality,
  updateMunicipality,
  deactivateMunicipality,
  activateMunicipality,
  listCityAdmins,
  inviteCityAdmin,
  revokeCityAdmin,
  resetCityAdminPassword,
  listAuditLog,
  getOverview,
  listAllAdmins,
  updateAdmin,
  makePrimaryAdmin,
  reactivateAdmin,
  listCityRequests,
  updateCityRequest,
} from '../controllers/superadminController.js'

const router = express.Router()

// All superadmin routes require authentication + superadmin role
router.use(auth, requireSuperAdmin)

// ── Overview (counts only) ──────────────────────────────────────────────────
router.get('/overview', getOverview)

// ── Municipalities ──────────────────────────────────────────────────────────
router.get('/municipalities', listMunicipalities)
router.post('/municipalities', superadminWriteLimiter, createMunicipality)
router.get('/municipalities/:id', getMunicipality)
router.put('/municipalities/:id', superadminWriteLimiter, updateMunicipality)
router.patch('/municipalities/:id/deactivate', superadminWriteLimiter, deactivateMunicipality)
router.patch('/municipalities/:id/activate', superadminWriteLimiter, activateMunicipality)

// ── City Admins (Per-municipality) ──────────────────────────────────────────
router.get('/municipalities/:id/admins', listCityAdmins)
router.post('/municipalities/:id/admins', superadminWriteLimiter, inviteCityAdmin)
router.delete('/municipalities/:id/admins/:uid', superadminWriteLimiter, revokeCityAdmin)
router.post('/municipalities/:id/admins/:uid/reset-password', superadminWriteLimiter, resetCityAdminPassword)

// ── Admins (Platform-wide & Specific admin actions) ─────────────────────────
router.get('/admins', listAllAdmins)
router.patch('/admins/:id', superadminWriteLimiter, updateAdmin)
router.post('/admins/:id/make-primary', superadminWriteLimiter, makePrimaryAdmin)
router.post('/admins/:id/reactivate', superadminWriteLimiter, reactivateAdmin)

// ── Audit Log ───────────────────────────────────────────────────────────────
router.get('/audit-log', listAuditLog)

// ── City Requests (Waitlist) ───────────────────────────────────────────────────
router.get('/city-requests', listCityRequests)
router.patch('/city-requests/:id', superadminWriteLimiter, updateCityRequest)

export default router
