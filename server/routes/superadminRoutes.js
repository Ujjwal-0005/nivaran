import express from 'express'
import { auth } from '../middleware/auth.js'
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js'
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
} from '../controllers/superadminController.js'

const router = express.Router()

// All superadmin routes require authentication + superadmin role
router.use(auth, requireSuperAdmin)

// ── Municipalities ──────────────────────────────────────────────────────────
router.get('/municipalities', listMunicipalities)
router.post('/municipalities', createMunicipality)
router.get('/municipalities/:id', getMunicipality)
router.put('/municipalities/:id', updateMunicipality)
router.patch('/municipalities/:id/deactivate', deactivateMunicipality)
router.patch('/municipalities/:id/activate', activateMunicipality)

// ── City Admins ─────────────────────────────────────────────────────────────
router.get('/municipalities/:id/admins', listCityAdmins)
router.post('/municipalities/:id/admins', inviteCityAdmin)
router.delete('/municipalities/:id/admins/:uid', revokeCityAdmin)
router.post('/municipalities/:id/admins/:uid/reset-password', resetCityAdminPassword)

// ── Audit Log ───────────────────────────────────────────────────────────────
router.get('/audit-log', listAuditLog)

export default router
