/**
 * tenantIsolation.test.js
 *
 * Tests cross-municipality data isolation (reports, staff, departments, analytics,
 * socket rooms). Runs against the MONGO_URI_TEST database only — never the real one.
 *
 * Run with: npm run test:isolation  (from server/)
 *
 * Requires MONGO_URI_TEST to be set in server/.env or in the current shell session.
 * The guard in tests/helpers/testDb.js aborts immediately if:
 *   - MONGO_URI_TEST is missing or empty
 *   - MONGO_URI_TEST equals MONGO_URI
 *   - The database name in MONGO_URI_TEST does not contain "test"
 */

// ── IMPORTANT: testDb must be imported FIRST so it overrides process.env.MONGO_URI
// before any other module that touches mongoose is imported.
import { connectTestDB, disconnectTestDB } from './helpers/testDb.js'

import http from 'http'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { io as ClientIO } from 'socket.io-client'

// Load .env so JWT_SECRET and other vars are available (MONGO_URI already overridden by testDb)
dotenv.config()

import { initSocket } from '../config/socket.js'
import { notifyAdmins } from '../utils/notify.js'

import authRoutes from '../routes/authRoutes.js'
import reportRoutes from '../routes/reportRoutes.js'
import categoryRoutes from '../routes/categoryRoutes.js'
import staffRoutes from '../routes/staffRoutes.js'
import departmentRoutes from '../routes/departmentRoutes.js'
import analyticsRoutes from '../routes/analyticsRoutes.js'
import publicRoutes from '../routes/publicRoutes.js'
import municipalityRoutes from '../routes/municipalityRoutes.js'

import Municipality from '../models/Municipality.js'
import Department from '../models/Department.js'
import Category from '../models/Category.js'
import User from '../models/User.js'
import Report from '../models/Report.js'

// Unique prefix for any fixtures this suite creates (avoids collision across runs)
const TEST_RUN_ID  = `iso_${Date.now()}`
const SA_TEST_EMAIL = `superadmin.${TEST_RUN_ID}@nivaran.gov`

// ── Build test express app ────────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/municipalities', municipalityRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/public', publicRoutes)

app.use((err, req, res, next) => {
  const status = err.statusCode || 500
  res.status(status).json({ message: err.message || 'Error' })
})

const server = http.createServer(app)
const ioServer = initSocket(server)

// ── Fetch helper ──────────────────────────────────────────────────────────────
const request = async (port, method, path, token, body = null) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const options = { method, headers }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(`http://127.0.0.1:${port}${path}`, options)
  let data = null
  try {
    data = await res.json()
  } catch (e) {
    data = null
  }
  return { status: res.status, data }
}

const signToken = (user, customTokenVersion = null) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      municipality: user.municipality || null,
      tokenVersion: customTokenVersion !== null ? customTokenVersion : (user.tokenVersion ?? 0),
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${message}`)
  }
}

// ── Cleanup helper — removes only fixtures created by THIS run ────────────────
async function cleanup() {
  try {
    await User.deleteMany({ email: SA_TEST_EMAIL })
    // Remove any other fixtures with this run's prefix (future-proofing)
    await User.deleteMany({ email: new RegExp(TEST_RUN_ID) })
  } catch (err) {
    console.warn('[cleanup] Warning during cleanup:', err.message)
  }
}

// ── "Clean slate" — remove leftover fixtures from previous crashed runs ───────
async function cleanSlate() {
  // tenantIsolation only adds a superadmin. Remove any with the "iso_" prefix
  // that may have been left over from a crash. Match by prefix only.
  const deleted = await User.deleteMany({ email: /^superadmin\.iso_\d+@nivaran\.gov$/ })
  if (deleted.deletedCount > 0) {
    console.log(`[clean-slate] Removed ${deleted.deletedCount} leftover isolation-test fixture(s)`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function runTests() {
  console.log('=== Starting Tenant Isolation Test Suite ===\n')

  // Connect to the TEST database (guard aborts if MONGO_URI_TEST is invalid)
  await connectTestDB()

  await cleanSlate()

  const port = 5055
  await new Promise((resolve) => server.listen(port, resolve))
  console.log(`Test server running on port ${port}`)

  try {
    // 1. Fetch the two seeded municipalities: Jalandhar & Phagwara
    const jalandhar = await Municipality.findOne({ name: 'Jalandhar' })
    const phagwara  = await Municipality.findOne({ name: 'Phagwara' })
    assert(jalandhar && phagwara, 'Found seeded Jalandhar and Phagwara municipalities')

    if (!jalandhar || !phagwara) {
      console.error('\n  The test database does not have the required seed data.')
      console.error('  Run: MONGO_URI=<test-db-uri> node seed.js  to seed the test database.\n')
      process.exit(1)
    }

    // 2. Fetch users for each municipality
    const jAdmin   = await User.findOne({ email: 'admin.jalandhar@nivaran.gov' })
    const pAdmin   = await User.findOne({ email: 'admin.phagwara@nivaran.gov' })
    const jStaff   = await User.findOne({ email: 'staff.roads.jalandhar@nivaran.gov' })
    const pStaff   = await User.findOne({ email: 'staff.roads.phagwara@nivaran.gov' })
    const jCitizen = await User.findOne({ email: 'citizen1.jalandhar@example.com' })
    const pCitizen = await User.findOne({ email: 'citizen1.phagwara@example.com' })

    assert(jAdmin && pAdmin,     'Found admin users for both cities')
    assert(jStaff && pStaff,     'Found staff users for both cities')
    assert(jCitizen && pCitizen, 'Found citizen users for both cities')

    // 3. Create a Superadmin user for this run (unique email = no collision)
    const superAdmin = await User.findOneAndUpdate(
      { email: SA_TEST_EMAIL },
      {
        $setOnInsert: {
          name: 'Super Admin (isolation test)',
          email: SA_TEST_EMAIL,
          passwordHash: 'dummyhash',
          role: 'superadmin',
          isVerified: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    const jAdminToken     = signToken(jAdmin)
    const pAdminToken     = signToken(pAdmin)
    const jStaffToken     = signToken(jStaff)
    const pStaffToken     = signToken(pStaff)
    const jCitizenToken   = signToken(jCitizen)
    const pCitizenToken   = signToken(pCitizen)
    const superAdminToken = signToken(superAdmin)

    // 4. Fetch reports from each municipality
    const jReport = await Report.findOne({ municipality: jalandhar._id })
    const pReport = await Report.findOne({ municipality: phagwara._id })
    assert(jReport && pReport, 'Found sample report for both cities')

    console.log('\n--- 1. Cross-City Report Isolation (:id endpoints) ---')
    const resGetPByJCitizen = await request(port, 'GET', `/api/reports/${pReport._id}`, jCitizenToken)
    assert(resGetPByJCitizen.status === 404, 'Jalandhar citizen reading Phagwara report returns 404')

    const resGetPByJAdmin = await request(port, 'GET', `/api/reports/${pReport._id}`, jAdminToken)
    assert(resGetPByJAdmin.status === 404, 'Jalandhar admin reading Phagwara report returns 404')

    const resUpvoteCross = await request(port, 'POST', `/api/reports/${pReport._id}/upvote`, jCitizenToken)
    assert(resUpvoteCross.status === 404, 'Jalandhar citizen upvoting Phagwara report returns 404')

    const resJoinCross = await request(port, 'POST', `/api/reports/${pReport._id}/join`, jCitizenToken)
    assert(resJoinCross.status === 404, 'Jalandhar citizen joining Phagwara report returns 404')

    const resCommentCross = await request(port, 'POST', `/api/reports/${pReport._id}/comments`, jCitizenToken, {
      text: 'Cross city comment attempt',
    })
    assert(resCommentCross.status === 404, 'Cross-city comment attempt returns 404')

    const resDisputeCross = await request(port, 'POST', `/api/reports/${pReport._id}/dispute`, jCitizenToken, {
      reason: 'Cross city dispute attempt',
    })
    assert(resDisputeCross.status === 404, 'Cross-city dispute attempt returns 404')

    const resAssignCross = await request(port, 'PATCH', `/api/reports/${pReport._id}/assign`, jAdminToken, {
      staffId: jStaff._id,
    })
    assert(resAssignCross.status === 404, 'Jalandhar admin assigning Phagwara report returns 404')

    const resResolveDispCross = await request(port, 'PATCH', `/api/reports/${pReport._id}/resolve-dispute`, jAdminToken, {
      action: 'mark_resolved',
      note: 'Illegal override',
    })
    assert(resResolveDispCross.status === 404, 'Jalandhar admin resolving Phagwara dispute returns 404')

    const resStatusCross = await request(port, 'PATCH', `/api/reports/${pReport._id}/status`, jStaffToken, {
      status: 'acknowledged',
    })
    assert(resStatusCross.status === 404, 'Jalandhar staff updating Phagwara report status returns 404')

    console.log('\n--- 2. List & Query Scoping (Reports, Staff, Departments, Analytics) ---')
    const resJReports = await request(port, 'GET', '/api/reports', jAdminToken)
    assert(resJReports.status === 200, 'Jalandhar admin successfully gets reports')
    const allJalandhar = resJReports.data.reports.every(
      (r) => r.municipality.toString() === jalandhar._id.toString()
    )
    assert(allJalandhar && resJReports.data.reports.length > 0, 'All reports returned to Jalandhar admin belong strictly to Jalandhar')

    const resJStaff = await request(port, 'GET', '/api/staff', jAdminToken)
    assert(resJStaff.status === 200, 'Jalandhar admin successfully gets staff')
    const allJStaff = resJStaff.data.staff.every((s) => s.email.includes('jalandhar'))
    assert(allJStaff, 'All staff returned belong strictly to Jalandhar')

    const resCrossStaffTickets = await request(port, 'GET', `/api/staff/${pStaff._id}/tickets`, jAdminToken)
    assert(resCrossStaffTickets.status === 404, 'Jalandhar admin requesting Phagwara staff tickets returns 404')

    const resJDepts = await request(port, 'GET', '/api/departments', jAdminToken)
    const allJDepts = resJDepts.data.departments.every(
      (d) => d.municipality.toString() === jalandhar._id.toString()
    )
    assert(allJDepts, 'All departments returned belong strictly to caller municipality')

    const resOverview = await request(port, 'GET', '/api/analytics/overview', jAdminToken)
    const countInJalandharDb = await Report.countDocuments({ municipality: jalandhar._id })
    assert(resOverview.data.totalReports === countInJalandharDb, 'Analytics overview total matches exactly Jalandhar report count')

    console.log('\n--- 3. Nearby & Duplicate Isolation ---')
    const resNearby = await request(
      port,
      'GET',
      `/api/reports/nearby?lat=${jalandhar.centroid.lat}&lng=${jalandhar.centroid.lng}&radius=50000`,
      jCitizenToken
    )
    const anyPhagwaraNearby = resNearby.data.reports.some(
      (r) => r.ticketId.includes('PHA')
    )
    assert(!anyPhagwaraNearby, 'Nearby reports query for Jalandhar citizen never includes Phagwara reports')

    console.log('\n--- 4. Token Version & Superadmin Restrictions ---')
    const expiredToken = signToken(jCitizen, 999)
    const resExpired = await request(port, 'GET', '/api/reports/mine', expiredToken)
    assert(resExpired.status === 401, 'Token with old/mismatched tokenVersion is rejected (401)')

    const resSuperAdminReports = await request(port, 'GET', '/api/reports', superAdminToken)
    assert(resSuperAdminReports.status === 403, 'Superadmin token is refused (403) by report routes')

    const resSuperAdminMine = await request(port, 'GET', '/api/reports/mine', superAdminToken)
    assert(resSuperAdminMine.status === 403, 'Superadmin token is refused (403) by citizen report routes')

    console.log('\n--- 5. Socket.io Authentication & Tenant Room Isolation ---')
    const socketUrl = `http://127.0.0.1:${port}`

    const noTokenSocket = ClientIO(socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
    })
    const noTokenErr = await new Promise((resolve) => {
      noTokenSocket.on('connect_error', (err) => resolve(err.message))
      noTokenSocket.connect()
    })
    assert(noTokenErr.includes('Authentication error'), 'Socket without valid token is rejected')
    noTokenSocket.close()

    const badVerSocket = ClientIO(socketUrl, {
      auth: { token: expiredToken },
      transports: ['websocket'],
      autoConnect: false,
    })
    const badVerErr = await new Promise((resolve) => {
      badVerSocket.on('connect_error', (err) => resolve(err.message))
      badVerSocket.connect()
    })
    assert(badVerErr.includes('Authentication error'), 'Socket with bad tokenVersion is rejected')
    badVerSocket.close()

    const jAdminSocket = ClientIO(socketUrl, {
      auth: { token: jAdminToken },
      transports: ['websocket'],
    })
    await new Promise((resolve) => jAdminSocket.on('connect', resolve))

    const pAdminSocket = ClientIO(socketUrl, {
      auth: { token: pAdminToken },
      transports: ['websocket'],
    })
    await new Promise((resolve) => pAdminSocket.on('connect', resolve))

    let jReceived = false
    let pReceived = false

    jAdminSocket.on('test_tenant_alert', () => { jReceived = true })
    pAdminSocket.on('test_tenant_alert', () => { pReceived = true })

    await notifyAdmins(jalandhar._id, 'test_tenant_alert', { msg: 'Jalandhar Alert Only' })

    await new Promise((r) => setTimeout(r, 400))

    assert(jReceived === true,  'Jalandhar admin received event targeted to Jalandhar')
    assert(pReceived === false, 'Phagwara admin NEVER received Jalandhar event (Room isolation verified)')

    jAdminSocket.close()
    pAdminSocket.close()

    console.log(`\n========================================`)
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`)
    console.log(`========================================\n`)

    if (failed > 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error('Test execution error:', err)
    // Do NOT exit here — let the finally block run first
    process.exitCode = 1
  } finally {
    // ── Teardown: always runs, even when an assertion or exception fails ───
    console.log('\n🧹 Cleaning up tenant isolation test fixtures…')
    await cleanup()

    server.close()
    await disconnectTestDB()

    if (process.exitCode !== 1) {
      process.exit(0)
    } else {
      process.exit(1)
    }
  }
}

runTests()
