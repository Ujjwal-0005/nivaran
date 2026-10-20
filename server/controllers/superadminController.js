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
import Report from '../models/Report.js'
import CityRequest from '../models/CityRequest.js'
import { createDefaultDepartments, seedAgenciesForCity } from '../utils/departments.js'
import { getCityStatus, getBulkCityStatus } from '../utils/cityStatus.js'
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

/** Generate a cryptographically secure raw invite token (32 bytes → 64 hex chars) */
const generateInviteToken = () => crypto.randomBytes(32).toString('hex')

/** SHA-256 hash helper for invite tokens */
const hashInviteToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

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

    // Attach city admin count and computed live status per municipality
    const ids = municipalities.map((m) => m._id)
    const [adminCounts, statusMap] = await Promise.all([
      User.aggregate([
        { $match: { municipality: { $in: ids }, role: 'admin' } },
        { $group: { _id: '$municipality', count: { $sum: 1 } } },
      ]),
      getBulkCityStatus(ids),
    ])
    const adminCountMap = Object.fromEntries(adminCounts.map((a) => [a._id.toString(), a.count]))
    const enriched = municipalities.map((m) => {
      const status = statusMap.get(m._id.toString()) || { isLive: false, reasons: ['inactive'] }
      return {
        ...m,
        adminCount: adminCountMap[m._id.toString()] || 0,
        isLive: status.isLive,
        reasons: status.reasons,
      }
    })

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

    const status = await getCityStatus(muni._id)

    res.json({
      data: {
        ...muni,
        isLive: status.isLive,
        reasons: status.reasons,
      },
    })
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
    if (muni.state) {
      await seedAgenciesForCity(muni._id, muni.state)
    }

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

    const { name, email, designation } = req.body
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

    // Determine if this is the first admin for this city (becomes primary)
    const existingAdminCount = await User.countDocuments({
      municipality: muni._id,
      role: 'admin',
    })
    const isFirstAdmin = existingAdminCount === 0

    // Generate raw invite token (32 bytes hex) and store only SHA-256 hash
    const rawToken = generateInviteToken()
    const hashedToken = hashInviteToken(rawToken)
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000)

    // Create user (no password yet – passwordHash is a placeholder)
    const placeholderHash = await bcrypt.hash(rawToken, 10) // never used for login
    const newAdmin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      designation: designation?.trim() || '',
      isPrimaryAdmin: isFirstAdmin,
      createdBy: req.user._id,
      passwordHash: placeholderHash,
      role: 'admin',
      municipality: muni._id,
      city: muni.name,
      state: muni.state,
      isVerified: false,
      isActive: true,
      tokenVersion: 0,
      passwordSetToken: hashedToken,
      passwordSetTokenExpiry: expiry,
    })

    // Send invite email (set-password link with raw token)
    const setPasswordUrl = `${CLIENT_URL}/set-password?token=${rawToken}`
    await sendCityAdminInviteEmail(normalizedEmail, {
      name: name.trim(),
      municipalityName: muni.name,
      setPasswordUrl,
    })

    await audit(req.user, 'cityadmin.invite', {
      municipality: muni._id,
      user: newAdmin._id,
      meta: { email: normalizedEmail, name: name.trim(), isPrimaryAdmin: newAdmin.isPrimaryAdmin },
      ip: getIP(req),
    })

    res.status(201).json({
      message: `Invitation sent to ${normalizedEmail}`,
      data: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        designation: newAdmin.designation,
        isPrimaryAdmin: newAdmin.isPrimaryAdmin,
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
// City Admins: REVOKE / DEACTIVATE (soft-disable)
// DELETE /api/superadmin/municipalities/:id/admins/:uid
// Body: reason (required)
// ──────────────────────────────────────────────
export const revokeCityAdmin = async (req, res) => {
  try {
    const muni = await Municipality.findById(req.params.id)
    if (!muni) return res.status(404).json({ message: 'Municipality not found' })

    const { reason } = req.body
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Deactivation reason is required' })
    }

    const admin = await User.findOne({
      _id: req.params.uid,
      municipality: muni._id,
      role: 'admin',
    })
    if (!admin) return res.status(404).json({ message: 'City admin not found in this municipality' })

    if (!admin.isActive) {
      return res.status(400).json({ message: 'City admin is already deactivated' })
    }

    // Last-admin guard: If the municipality is active, ensure target is not the only active admin
    const activeAdmins = await User.find({
      municipality: muni._id,
      role: 'admin',
      isActive: true,
    }).sort({ createdAt: 1 })

    if (muni.isActive && activeAdmins.length <= 1) {
      return res.status(409).json({
        message: 'Cannot deactivate the last active admin of an active city. Create another admin first, or deactivate the city.',
      })
    }

    // Deactivate admin
    admin.isActive = false
    admin.deactivatedAt = new Date()
    admin.deactivatedBy = req.user._id
    admin.deactivationReason = reason.trim()
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1 // invalidate existing sessions

    const wasPrimary = admin.isPrimaryAdmin
    if (wasPrimary) {
      admin.isPrimaryAdmin = false
    }

    await admin.save()

    // If primary was deactivated and another active admin exists, promote oldest active admin
    let promotedAdmin = null
    if (wasPrimary) {
      const remainingActive = activeAdmins.filter(
        (a) => a._id.toString() !== admin._id.toString()
      )
      if (remainingActive.length > 0) {
        promotedAdmin = remainingActive[0]
        promotedAdmin.isPrimaryAdmin = true
        await promotedAdmin.save()

        await audit(req.user, 'admin.make_primary', {
          municipality: muni._id,
          user: promotedAdmin._id,
          meta: { email: promotedAdmin.email, reason: 'Promoted as oldest active admin after previous primary deactivation' },
          ip: getIP(req),
        })
      }
    }

    await audit(req.user, 'admin.deactivate', {
      municipality: muni._id,
      user: admin._id,
      meta: { email: admin.email, reason: reason.trim() },
      ip: getIP(req),
    })

    res.json({
      message: `City admin ${admin.email} has been deactivated`,
      promotedPrimaryAdmin: promotedAdmin ? promotedAdmin.email : null,
    })
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

    // Generate new raw invite token (32 bytes hex) and store only SHA-256 hash
    const rawToken = generateInviteToken()
    const hashedToken = hashInviteToken(rawToken)
    const expiry = new Date(Date.now() + 48 * 60 * 60 * 1000)

    admin.passwordSetToken = hashedToken
    admin.passwordSetTokenExpiry = expiry
    admin.isVerified = false // force them to complete set-password flow again
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1 // invalidate existing sessions
    await admin.save()

    // Send security notification + new invite link with raw token
    const setPasswordUrl = `${CLIENT_URL}/set-password?token=${rawToken}`
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

// ──────────────────────────────────────────────
// Overview: GET /api/superadmin/overview (Counts only)
// ──────────────────────────────────────────────
export const getOverview = async (req, res) => {
  try {
    const [
      totalCities,
      activeCities,
      inactiveCities,
      totalAdmins,
      totalStaff,
      totalCitizens,
      totalReports,
      reportsByStatusAgg,
      cityReportsAgg,
      cityUsersAgg,
      municipalities,
    ] = await Promise.all([
      Municipality.countDocuments(),
      Municipality.countDocuments({ isActive: true }),
      Municipality.countDocuments({ isActive: false }),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'staff' }),
      User.countDocuments({ role: 'citizen' }),
      Report.countDocuments(),
      Report.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Report.aggregate([
        {
          $group: {
            _id: { municipality: '$municipality', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        {
          $group: {
            _id: { municipality: '$municipality', role: '$role' },
            count: { $sum: 1 },
          },
        },
      ]),
      Municipality.find({}, 'name state type isActive createdAt').sort({ name: 1 }).lean(),
    ])

    const reportsByStatus = {
      submitted: 0,
      acknowledged: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
    }
    for (const item of reportsByStatusAgg) {
      if (item._id && reportsByStatus[item._id] !== undefined) {
        reportsByStatus[item._id] = item.count
      }
    }

    // Build city maps
    const cityUserCounts = {} // { [muniId]: { admin, staff, citizen } }
    for (const item of cityUsersAgg) {
      if (!item._id.municipality) continue
      const mId = item._id.municipality.toString()
      if (!cityUserCounts[mId]) cityUserCounts[mId] = { admins: 0, staff: 0, citizens: 0 }
      if (item._id.role === 'admin') cityUserCounts[mId].admins = item.count
      if (item._id.role === 'staff') cityUserCounts[mId].staff = item.count
      if (item._id.role === 'citizen') cityUserCounts[mId].citizens = item.count
    }

    const cityReportCounts = {} // { [muniId]: { total, byStatus } }
    for (const item of cityReportsAgg) {
      if (!item._id.municipality) continue
      const mId = item._id.municipality.toString()
      if (!cityReportCounts[mId]) {
        cityReportCounts[mId] = {
          total: 0,
          byStatus: { submitted: 0, acknowledged: 0, in_progress: 0, resolved: 0, rejected: 0 },
        }
      }
      cityReportCounts[mId].total += item.count
      if (item._id.status && cityReportCounts[mId].byStatus[item._id.status] !== undefined) {
        cityReportCounts[mId].byStatus[item._id.status] = item.count
      }
    }

    const perCityTable = municipalities.map((m) => {
      const mId = m._id.toString()
      const u = cityUserCounts[mId] || { admins: 0, staff: 0, citizens: 0 }
      const r = cityReportCounts[mId] || {
        total: 0,
        byStatus: { submitted: 0, acknowledged: 0, in_progress: 0, resolved: 0, rejected: 0 },
      }
      return {
        id: m._id,
        name: m.name,
        state: m.state,
        type: m.type,
        isActive: m.isActive,
        admins: u.admins,
        staff: u.staff,
        citizens: u.citizens,
        reportsTotal: r.total,
        reportsByStatus: r.byStatus,
      }
    })

    res.json({
      totals: {
        totalCities,
        activeCities,
        inactiveCities,
        totalAdmins,
        totalStaff,
        totalCitizens,
        totalReports,
        reportsByStatus,
      },
      perCity: perCityTable,
    })
  } catch (err) {
    console.error('getOverview error:', err)
    res.status(500).json({ message: 'Server error retrieving platform overview' })
  }
}

// ──────────────────────────────────────────────
// City Admins: GET /api/superadmin/admins (Paginated across cities)
// ──────────────────────────────────────────────
export const listAllAdmins = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const filter = { role: 'admin' }
    if (req.query.city) {
      filter.municipality = req.query.city
    }
    if (req.query.status === 'active') {
      filter.isActive = true
    } else if (req.query.status === 'inactive' || req.query.status === 'deactivated') {
      filter.isActive = false
    } else if (req.query.status === 'pending') {
      filter.isVerified = false
      filter.isActive = true
    }

    const [items, total] = await Promise.all([
      User.find(filter, {
        passwordHash: 0,
        otp: 0,
        otpExpiry: 0,
        passwordSetToken: 0,
        passwordSetTokenExpiry: 0,
      })
        .populate('municipality', 'name state isActive')
        .populate('createdBy', 'name email')
        .populate('deactivatedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ])

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('listAllAdmins error:', err)
    res.status(500).json({ message: 'Server error listing city admins' })
  }
}

// ──────────────────────────────────────────────
// City Admins: PATCH /api/superadmin/admins/:id (Update name, phone, designation)
// ──────────────────────────────────────────────
export const updateAdmin = async (req, res) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' })
    if (!admin) return res.status(404).json({ message: 'Admin not found' })

    const { name, phone, designation } = req.body
    const changes = {}
    if (name && name.trim()) changes.name = name.trim()
    if (phone !== undefined) changes.phone = phone.trim()
    if (designation !== undefined) changes.designation = designation.trim()

    Object.assign(admin, changes)
    await admin.save()

    await audit(req.user, 'admin.update', {
      municipality: admin.municipality,
      user: admin._id,
      meta: { changes: Object.keys(changes) },
      ip: getIP(req),
    })

    res.json({
      message: 'Admin updated successfully',
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        designation: admin.designation,
        isPrimaryAdmin: admin.isPrimaryAdmin,
        isActive: admin.isActive,
      },
    })
  } catch (err) {
    console.error('updateAdmin error:', err)
    res.status(500).json({ message: 'Server error updating admin' })
  }
}

// ──────────────────────────────────────────────
// City Admins: POST /api/superadmin/admins/:id/make-primary
// ──────────────────────────────────────────────
export const makePrimaryAdmin = async (req, res) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' })
    if (!admin) return res.status(404).json({ message: 'Admin not found' })

    if (!admin.isActive) {
      return res.status(400).json({ message: 'Cannot make a deactivated admin primary' })
    }

    if (admin.isPrimaryAdmin) {
      return res.json({ message: 'Admin is already primary', data: admin })
    }

    // Demote current primary admin for this municipality
    await User.updateMany(
      { municipality: admin.municipality, role: 'admin', isPrimaryAdmin: true },
      { $set: { isPrimaryAdmin: false } }
    )

    admin.isPrimaryAdmin = true
    await admin.save()

    await audit(req.user, 'admin.make_primary', {
      municipality: admin.municipality,
      user: admin._id,
      meta: { email: admin.email },
      ip: getIP(req),
    })

    res.json({
      message: `${admin.name} is now the primary admin`,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        isPrimaryAdmin: true,
      },
    })
  } catch (err) {
    console.error('makePrimaryAdmin error:', err)
    res.status(500).json({ message: 'Server error setting primary admin' })
  }
}

// ──────────────────────────────────────────────
// City Admins: POST /api/superadmin/admins/:id/reactivate
// ──────────────────────────────────────────────
export const reactivateAdmin = async (req, res) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' })
    if (!admin) return res.status(404).json({ message: 'Admin not found' })

    if (admin.isActive) {
      return res.status(400).json({ message: 'Admin is already active' })
    }

    admin.isActive = true
    admin.deactivatedAt = null
    admin.deactivatedBy = null
    admin.deactivationReason = null
    admin.tokenVersion = (admin.tokenVersion ?? 0) + 1 // invalidate any old tokens
    await admin.save()

    await audit(req.user, 'admin.reactivate', {
      municipality: admin.municipality,
      user: admin._id,
      meta: { email: admin.email },
      ip: getIP(req),
    })

    res.json({
      message: `Admin ${admin.email} has been reactivated`,
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        isActive: true,
        isVerified: admin.isVerified,
      },
    })
  } catch (err) {
    console.error('reactivateAdmin error:', err)
    res.status(500).json({ message: 'Server error reactivating admin' })
  }
}

// ──────────────────────────────────────────────
// City Requests (Waitlist): GET & PATCH
// ──────────────────────────────────────────────

/**
 * GET /api/superadmin/city-requests
 * Paginated, sorted by requestCount desc, filter by status and state.
 * Never exposes requesters array or email hashes.
 */
export const listCityRequests = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit

    const filter = {}
    if (req.query.status) {
      filter.status = req.query.status
    }
    if (req.query.state) {
      filter.state = { $regex: new RegExp(`^${req.query.state.trim()}$`, 'i') }
    }
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search.trim(), $options: 'i' } },
        { displayName: { $regex: req.query.search.trim(), $options: 'i' } },
      ]
    }

    const [requests, total] = await Promise.all([
      CityRequest.find(filter)
        .select('_id name displayName state requestCount status firstRequestedAt lastRequestedAt createdAt updatedAt')
        .sort({ requestCount: -1, lastRequestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CityRequest.countDocuments(filter),
    ])

    res.json({
      data: requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    console.error('listCityRequests error:', err)
    res.status(500).json({ message: 'Server error fetching city requests' })
  }
}

/**
 * PATCH /api/superadmin/city-requests/:id
 * Set status (open | planned | added | dismissed)
 * Audit-log the status change.
 */
export const updateCityRequest = async (req, res) => {
  try {
    const { status } = req.body
    const allowedStatuses = ['open', 'planned', 'added', 'dismissed']

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`,
      })
    }

    const cityRequest = await CityRequest.findById(req.params.id)
    if (!cityRequest) {
      return res.status(404).json({ message: 'City request not found' })
    }

    const oldStatus = cityRequest.status
    cityRequest.status = status
    await cityRequest.save()

    // Audit log
    await audit(req.user, 'cityrequest.update', {
      meta: {
        cityRequestId: cityRequest._id,
        cityName: cityRequest.displayName,
        state: cityRequest.state,
        oldStatus,
        newStatus: status,
      },
      ip: getIP(req),
    })

    res.json({
      message: `City request status updated to ${status}`,
      data: {
        _id: cityRequest._id,
        name: cityRequest.name,
        displayName: cityRequest.displayName,
        state: cityRequest.state,
        requestCount: cityRequest.requestCount,
        status: cityRequest.status,
        firstRequestedAt: cityRequest.firstRequestedAt,
        lastRequestedAt: cityRequest.lastRequestedAt,
      },
    })
  } catch (err) {
    console.error('updateCityRequest error:', err)
    res.status(500).json({ message: 'Server error updating city request' })
  }
}

