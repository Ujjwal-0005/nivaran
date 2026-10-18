/**
 * superadminController.js
 *
 * All actions require the `superadmin` role (enforced by requireSuperAdmin middleware).
 * Every mutating action writes an AuditLog entry.
 *
 * Endpoints implemented:
 *   Municipality CRUD
 *     GET    /api/superadmin/municipalities         – list (paginated)
 *     POST   /api/superadmin/municipalities         – create + seed departments
 *     GET    /api/superadmin/municipalities/:id     – detail
 *     PUT    /api/superadmin/municipalities/:id     – update
 *     PATCH  /api/superadmin/municipalities/:id/deactivate
 *     PATCH  /api/superadmin/municipalities/:id/activate
 *
 *   City Admin management
 *     GET    /api/superadmin/municipalities/:id/admins      – list admins for city
 *     POST   /api/superadmin/municipalities/:id/admins      – invite new city admin
 *     DELETE /api/superadmin/municipalities/:id/admins/:uid – revoke (soft-disable)
 *     POST   /api/superadmin/municipalities/:id/admins/:uid/reset-password
 *
 *   Audit log
 *     GET    /api/superadmin/audit-log              – list (paginated, filterable)
 */

import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import Municipality from '../models/Municipality.js'
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'
import { createDefaultDepartments } from '../utils/departments.js'
import {
  sendCityAdminInviteEmail,
  sendPasswordChangedEmail,
} from '../utils/sendEmail.js'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

/** Write an audit log entry. Never throws – logs error on failure. */
const audit = async (actor, action, opts = {}) => {
  try {
    await AuditLog.create({
      actor: actor._id,
      actorEmail: actor.email,
      action,
      targetMunicipality: opts.municipality || null,
      targetUser: opts.user || null,
      meta: opts.meta || {},
      ip: opts.ip || null,
    })
  } catch (err) {
    console.error('[AuditLog] Failed to write audit entry:', err.message)
  }
}

/** Generate a cryptographically secure invite token (hex, 40 bytes → 80 chars) */
const generateInviteToken = () => crypto.randomBytes(40).toString('hex')

/** Sanitize IP from request (handles proxy headers) */
const getIP = (req) =>
  (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()

// ──────────────────────────────────────────────
// Municipality: LIST
// GET /api/superadmin/municipalities?page=1&limit=20&state=Punjab&search=
// ──────────────────────────────────────────────
export const listMunicipalities = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const filter = {}
    if (req.query.state) filter.state = { $regex: req.query.state.trim(), $options: 'i' }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search.trim(), $options: 'i' } },
        { nameLocal: { $regex: req.query.search.trim(), $options: 'i' } },
      ]
    }
    if (req.query.active !== undefined) {
      filter.isActive = req.query.active === 'true'
    }

    const [municipalities, total] = await Promise.all([
      Municipality.find(filter).sort({ state: 1, name: 1 }).skip(skip).limit(limit).lean(),
      Municipality.countDocuments(filter),
    ])

    // Attach city admin count per municipality
    const ids = municipalities.map((m) => m._id)
    const adminCounts = await User.aggregate([
      { $match: { municipality: { $in: ids }, role: 'admin' } },
      { $group: { _id: '$municipality', count: { $sum: 1 } } },
    ])
    const adminCountMap = Object.fromEntries(adminCounts.map((a) => [a._id.toString(), a.count]))
    const enriched = municipalities.map((m) => ({
      ...m,
      adminCount: adminCountMap[m._id.toString()] || 0,
    }))

    res.json({
      data: enriched,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('listMunicipalities error:', err)
    res.status(500).json({ message: 'Server error listing municipalities' })
  }
}

// ──────────────────────────────────────────────
// Municipality: GET SINGLE
// GET /api/superadmin/municipalities/:id
// ──────────────────────────────────────────────
export const getMunicipality = async (req, res) => {
  try {
    const muni = await Municipality.findById(req.params.id).lean()
    if (!muni) return res.status(404).json({ message: 'Municipality not found' })
    res.json({ data: muni })
  } catch (err) {
    console.error('getMunicipality error:', err)
    res.status(500).json({ message: 'Server error' })
  }
}

// ──────────────────────────────────────────────
// Municipality: CREATE
// POST /api/superadmin/municipalities
// Body: name, nameLocal?, state, type, lgdCode?, centroid:{lat,lng}, defaultZoom?, subdivisions?
// ──────────────────────────────────────────────
export const createMunicipality = async (req, res) => {
  try {
    const { name, nameLocal, state, type, lgdCode, centroid, defaultZoom, subdivisions } = req.body

    // Validation
    if (!name || !name.trim()) return res.status(400).json({ message: 'name is required' })
    if (!state || !state.trim()) return res.status(400).json({ message: 'state is required' })
    if (!['corporation', 'council', 'nagar_panchayat'].includes(type)) {
      return res.status(400).json({ message: 'type must be corporation | council | nagar_panchayat' })
    }
    if (!centroid || typeof centroid.lat !== 'number' || typeof centroid.lng !== 'number') {
      return res.status(400).json({ message: 'centroid.lat and centroid.lng (numbers) are required' })
    }

    // Duplicate check
    const exists = await Municipality.findOne({
      state: state.trim(),
      name: name.trim(),
    })
    if (exists) {
      return res.status(409).json({ message: `Municipality "${name.trim()}" already exists in ${state.trim()}` })
    }

    const muni = await Municipality.create({
      name: name.trim(),
      nameLocal: nameLocal?.trim() || '',
      state: state.trim(),
      type,
      lgdCode: lgdCode?.trim() || null,
      centroid: { lat: centroid.lat, lng: centroid.lng },
      defaultZoom: defaultZoom || 13,
      subdivisions: subdivisions || [],
      isActive: true,
      createdBy: req.user._id,
    })

    // Seed 10 default departments
    await createDefaultDepartments(muni._id)

    await audit(req.user, 'municipality.create', {
      municipality: muni._id,
      meta: { name: muni.name, state: muni.state, type: muni.type },
      ip: getIP(req),
    })

    res.status(201).json({ message: 'Municipality created', data: muni })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Municipality with that name/state or lgdCode already exists' })
    }
    console.error('createMunicipality error:', err)
    res.status(500).json({ message: 'Server error creating municipality' })
  }
}

// ──────────────────────────────────────────────
// Municipality: UPDATE
// PUT /api/superadmin/municipalities/:id
// ──────────────────────────────────────────────
export const updateMunicipality = async (req, res) => {
  try {
    const muni = await Municipality.findById(req.params.id)
    if (!muni) return res.status(404).json({ message: 'Municipality not found' })

    const allowed = ['nameLocal', 'lgdCode', 'centroid', 'defaultZoom', 'subdivisions']
    const changes = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) changes[key] = req.body[key]
    }
    // Also allow name and state update (with duplicate re-check)
    if (req.body.name) changes.name = req.body.name.trim()
    if (req.body.state) changes.state = req.body.state.trim()
    if (req.body.type) {
      if (!['corporation', 'council', 'nagar_panchayat'].includes(req.body.type)) {
        return res.status(400).json({ message: 'Invalid type' })
      }
      changes.type = req.body.type
    }

    Object.assign(muni, changes)
    await muni.save()

    await audit(req.user, 'municipality.update', {
      municipality: muni._id,
      meta: { changes: Object.keys(changes) },
      ip: getIP(req),
    })

    res.json({ message: 'Municipality updated', data: muni })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate name/state or lgdCode' })
    }
    console.error('updateMunicipality error:', err)
    res.status(500).json({ message: 'Server error updating municipality' })
  }
}

// ──────────────────────────────────────────────
// Municipality: DEACTIVATE
// PATCH /api/superadmin/municipalities/:id/deactivate
// ──────────────────────────────────────────────
export const deactivateMunicipality = async (req, res) => {
  try {
    const muni = await Municipality.findById(req.params.id)
    if (!muni) return res.status(404).json({ message: 'Municipality not found' })
    if (!muni.isActive) return res.status(400).json({ message: 'Municipality is already inactive' })

    muni.isActive = false
    await muni.save()

    await audit(req.user, 'municipality.deactivate', {
      municipality: muni._id,
      meta: { name: muni.name },
      ip: getIP(req),
    })

    res.json({ message: `Municipality "${muni.name}" deactivated` })
  } catch (err) {
    console.error('deactivateMunicipality error:', err)
    res.status(500).json({ message: 'Server error' })
  }
}

// ──────────────────────────────────────────────
// Municipality: ACTIVATE
// PATCH /api/superadmin/municipalities/:id/activate
// ──────────────────────────────────────────────
export const activateMunicipality = async (req, res) => {
  try {
    const muni = await Municipality.findById(req.params.id)
    if (!muni) return res.status(404).json({ message: 'Municipality not found' })
    if (muni.isActive) return res.status(400).json({ message: 'Municipality is already active' })

    muni.isActive = true
    await muni.save()

    await audit(req.user, 'municipality.activate', {
      municipality: muni._id,
      meta: { name: muni.name },
      ip: getIP(req),
    })

    res.json({ message: `Municipality "${muni.name}" activated` })
  } catch (err) {
    console.error('activateMunicipality error:', err)
    res.status(500).json({ message: 'Server error' })
  }
}

// ──────────────────────────────────────────────
// City Admins: LIST for a municipality
// GET /api/superadmin/municipalities/:id/admins
// ──────────────────────────────────────────────
export const listCityAdmins = async (req, res) => {
  try {
    const muni = await Municipality.findById(req.params.id)
    if (!muni) return res.status(404).json({ message: 'Municipality not found' })

    const admins = await User.find(
      { municipality: muni._id, role: 'admin' },
      { passwordHash: 0, otp: 0, otpExpiry: 0, passwordSetToken: 0, passwordSetTokenExpiry: 0 }
    )
      .sort({ createdAt: -1 })
      .lean()

    res.json({ data: admins })
  } catch (err) {
    console.error('listCityAdmins error:', err)
    res.status(500).json({ message: 'Server error' })
  }
}

// ──────────────────────────────────────────────
// City Admins: INVITE
// POST /api/superadmin/municipalities/:id/admins
// Body: name, email
// ──────────────────────────────────────────────
export const inviteCityAdmin = async (req, res) => {
  try {
    const muni = await Municipality.findById(req.params.id)
    if (!muni) return res.status(404).json({ message: 'Municipality not found' })
    if (!muni.isActive) {
      return res.status(400).json({ message: 'Cannot invite admin to an inactive municipality' })
    }

    const { name, email } = req.body
    if (!name || !name.trim()) return res.status(400).json({ message: 'name is required' })
    if (!email || !email.trim()) return res.status(400).json({ message: 'email is required' })

    const normalizedEmail = email.toLowerCase().trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email address' })
    }

    // Check if email already in use
    const existing = await User.findOne({ email: normalizedEmail })
    if (existing) {
      return res.status(409).json({ message: `Email ${normalizedEmail} is already registered` })
    }

    // Generate invite token (48-hour expiry)
    const token = generateInviteToken()
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000)

    // Create user (no password yet – passwordHash is a placeholder)
    const placeholderHash = await bcrypt.hash(token, 10) // never used for login
    const newAdmin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: placeholderHash,
      role: 'admin',
      municipality: muni._id,
      city: muni.name,
      state: muni.state,
      isVerified: false,
      isActive: true,
      tokenVersion: 0,
      passwordSetToken: token,
      passwordSetTokenExpiry: expiry,
    })

    // Send invite email (set-password link)
    const setPasswordUrl = `${CLIENT_URL}/set-password?token=${token}`
    await sendCityAdminInviteEmail(normalizedEmail, {
      name: name.trim(),
      municipalityName: muni.name,
      setPasswordUrl,
    })

    await audit(req.user, 'cityadmin.invite', {
      municipality: muni._id,
      user: newAdmin._id,
      meta: { email: normalizedEmail, name: name.trim() },
      ip: getIP(req),
    })

    res.status(201).json({
      message: `Invitation sent to ${normalizedEmail}`,
      data: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        isVerified: newAdmin.isVerified,
        isActive: newAdmin.isActive,
      },
    })
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' })
    }
    console.error('inviteCityAdmin error:', err)
    res.status(500).json({ message: 'Server error inviting city admin' })
  }
}

// ──────────────────────────────────────────────
// City Admins: REVOKE (soft-disable)
// DELETE /api/superadmin/municipalities/:id/admins/:uid
// ──────────────────────────────────────────────
export const revokeCityAdmin = async (req, res) => {
  try {
    const muni = await Municipality.findById(req.params.id)
    if (!muni) return res.status(404).json({ message: 'Municipality not found' })

    const admin = await User.findOne({
      _id: req.params.uid,
      municipality: muni._id,
      role: 'admin',
    })
    if (!admin) return res.status(404).json({ message: 'City admin not found in this municipality' })

    admin.isActive = false
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1 // invalidate existing sessions
    await admin.save()

    await audit(req.user, 'cityadmin.revoke', {
      municipality: muni._id,
      user: admin._id,
      meta: { email: admin.email },
      ip: getIP(req),
    })

    res.json({ message: `City admin ${admin.email} has been revoked` })
  } catch (err) {
    console.error('revokeCityAdmin error:', err)
    res.status(500).json({ message: 'Server error revoking city admin' })
  }
}

// ──────────────────────────────────────────────
// City Admins: RESET PASSWORD (re-issue invite link)
// POST /api/superadmin/municipalities/:id/admins/:uid/reset-password
// ──────────────────────────────────────────────
export const resetCityAdminPassword = async (req, res) => {
  try {
    const muni = await Municipality.findById(req.params.id)
    if (!muni) return res.status(404).json({ message: 'Municipality not found' })

    const admin = await User.findOne({
      _id: req.params.uid,
      municipality: muni._id,
      role: 'admin',
    })
    if (!admin) return res.status(404).json({ message: 'City admin not found in this municipality' })

    // Generate new invite token
    const token = generateInviteToken()
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000)

    admin.passwordSetToken = token
    admin.passwordSetTokenExpiry = expiry
    admin.isVerified = false // force them to complete set-password flow again
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1 // invalidate existing sessions
    await admin.save()

    // Send security notification + new invite link
    const setPasswordUrl = `${CLIENT_URL}/set-password?token=${token}`
    await sendPasswordChangedEmail(admin.email, {
      name: admin.name,
      municipalityName: muni.name,
    })
    await sendCityAdminInviteEmail(admin.email, {
      name: admin.name,
      municipalityName: muni.name,
      setPasswordUrl,
    })

    await audit(req.user, 'cityadmin.reset_password', {
      municipality: muni._id,
      user: admin._id,
      meta: { email: admin.email },
      ip: getIP(req),
    })

    res.json({ message: `Password reset link sent to ${admin.email}` })
  } catch (err) {
    console.error('resetCityAdminPassword error:', err)
    res.status(500).json({ message: 'Server error resetting password' })
  }
}

// ──────────────────────────────────────────────
// Audit Log: LIST
// GET /api/superadmin/audit-log?page=1&limit=30&action=&municipality=
// ──────────────────────────────────────────────
export const listAuditLog = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30))
    const skip = (page - 1) * limit

    const filter = {}
    if (req.query.action) filter.action = req.query.action
    if (req.query.municipality) filter.targetMunicipality = req.query.municipality
    if (req.query.actor) filter.actor = req.query.actor

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('targetMunicipality', 'name state')
        .populate('targetUser', 'name email')
        .lean(),
      AuditLog.countDocuments(filter),
    ])

    res.json({
      data: logs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error('listAuditLog error:', err)
    res.status(500).json({ message: 'Server error listing audit log' })
  }
}
