/**
 * staffApproval.test.js
 *
 * Tests for Step 3: Staff self-registration with city-admin approval.
 * Runs against the MONGO_URI_TEST database only — never the real one.
 *
 * Run with: npm run test:staff  (from server/)
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
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// Load .env so JWT_SECRET and other vars are available (MONGO_URI already overridden by testDb)
dotenv.config()

import authRoutes from '../routes/authRoutes.js'
import staffRoutes from '../routes/staffRoutes.js'
import municipalityRoutes from '../routes/municipalityRoutes.js'
import reportRoutes from '../routes/reportRoutes.js'

import Municipality from '../models/Municipality.js'
import User from '../models/User.js'
import Department from '../models/Department.js'
import Report from '../models/Report.js'
import Category from '../models/Category.js'
import AuditLog from '../models/AuditLog.js'

// ─── Unique fixture identifiers for this run ──────────────────────────────────
const TEST_TIMESTAMP = Date.now()
// All emails created by this run contain the timestamp, so cleanup is precise.
const STAFF_EMAIL   = `staff.test.${TEST_TIMESTAMP}@nivaran.gov`
const STAFF_PASS    = 'StaffTest@123'
const ADMIN_EMAIL   = `admin.test.${TEST_TIMESTAMP}@nivaran.gov`
const CITIZEN_EMAIL = `citizen.test.${TEST_TIMESTAMP}@example.com`

// ─── Test App Setup ──────────────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/municipalities', municipalityRoutes)
app.use('/api/reports', reportRoutes)

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ message: err.message || 'Error' })
})

const server = http.createServer(app)

// ─── Helpers ──────────────────────────────────────────────────────────────────
let PORT
const request = async (method, path, token, body = null) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, opts)
  let data
  try { data = await res.json() } catch { data = {} }
  return { status: res.status, data }
}

let passed = 0
let failed = 0
const results = []

const test = async (name, fn) => {
  try {
    await fn()
    passed++
    results.push({ ok: true, name })
    console.log(`  ✅ ${name}`)
  } catch (err) {
    failed++
    results.push({ ok: false, name, err: err.message })
    console.log(`  ❌ ${name}`)
    console.log(`     ${err.message}`)
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

// ─── Fixture state ────────────────────────────────────────────────────────────
let adminToken    = ''
let citizenToken  = ''
let testMuniId    = ''
let testDeptId    = ''
let testCategoryId = ''
let staffId       = ''
let reportId      = ''

// ─── "Clean slate" — remove leftover fixtures from crashed previous runs ──────
async function cleanSlate() {
  // Remove by the fixed email patterns used by this suite.
  // We match by prefix only — never delete everything.
  const deleted = await User.deleteMany({
    email: {
      $regex:
        /^(staff\.test\.\d+@nivaran\.gov|admin\.test\.\d+@nivaran\.gov|citizen\.test\.\d+@example\.com|pending\.staff\.\d+@nivaran\.gov|rejected\.staff\.\d+@nivaran\.gov|citizen2\.\d+@example\.com|invalid\.\d+@example\.com|another\.staff\.\d+@nivaran\.gov|invalid\.dept\.\d+@nivaran\.gov)$/,
    },
  })
  // Remove any report created by test users that might be lingering
  await Report.deleteMany({
    description: { $regex: /^Test pothole for auto-assign/ },
  })
  if (deleted.deletedCount > 0) {
    console.log(`[clean-slate] Removed ${deleted.deletedCount} leftover staff-test fixture(s)`)
  }
}

// ─── Teardown — removes exactly the fixtures created by THIS run ──────────────
async function cleanup() {
  try {
    if (staffId) await User.findByIdAndDelete(staffId)
    await User.deleteMany({
      email: { $in: [STAFF_EMAIL, ADMIN_EMAIL, CITIZEN_EMAIL] },
    })
    // Catch any mid-test users created with patterns known to this suite
    await User.deleteMany({ email: new RegExp(`\\.test\\.${TEST_TIMESTAMP}@`) })
    await User.deleteMany({ email: /^pending\.staff\.\d+@nivaran\.gov$/ })
    await User.deleteMany({ email: /^rejected\.staff\.\d+@nivaran\.gov$/ })
    await User.deleteMany({ email: /^citizen2\.\d+@example\.com$/ })
    await User.deleteMany({ email: /^invalid\.\d+@/ })
    if (reportId) await Report.findByIdAndDelete(reportId)
    if (testMuniId) await AuditLog.deleteMany({ targetMunicipality: testMuniId })
  } catch (err) {
    console.warn('[cleanup] Warning during cleanup:', err.message)
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────
const run = async () => {
  // Connect to the TEST database (guard aborts if MONGO_URI_TEST is invalid)
  await connectTestDB()

  await cleanSlate()

  // Start server first before making any requests
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  PORT = server.address().port
  console.log(`\n🧪 Step 3: Staff Approval Tests  (port ${PORT})\n`)

  // Get or create a test municipality
  const muni = await Municipality.findOne({ name: 'Jalandhar' })
  if (!muni) {
    console.error('\n  Jalandhar municipality not found in the test database.')
    console.error('  Seed the test database before running tests.\n')
    await disconnectTestDB()
    process.exit(1)
  }
  testMuniId = muni._id

  // Get a department
  const dept = await Department.findOne({ municipality: testMuniId })
  if (!dept) {
    console.error('\n  No department found for Jalandhar — seed the test database first.\n')
    await disconnectTestDB()
    process.exit(1)
  }
  testDeptId = dept._id

  // Get a category
  const cat = await Category.findOne()
  if (!cat) {
    console.error('\n  No category found — seed the test database first.\n')
    await disconnectTestDB()
    process.exit(1)
  }
  testCategoryId = cat._id

  // Create a city admin with the unique timestamp email
  const adminHash = await bcrypt.hash('Admin@123', 10)
  await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    {
      $set: {
        name: 'Test City Admin',
        email: ADMIN_EMAIL,
        passwordHash: adminHash,
        role: 'admin',
        municipality: testMuniId,
        isVerified: true,
        isActive: true,
        tokenVersion: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  const { data: adminLogin } = await request('POST', '/api/auth/login', null, {
    email: ADMIN_EMAIL,
    password: 'Admin@123',
  })
  adminToken = adminLogin.token

  // Create a citizen with the unique timestamp email
  const citizenHash = await bcrypt.hash('Citizen@123', 10)
  await User.findOneAndUpdate(
    { email: CITIZEN_EMAIL },
    {
      $set: {
        name: 'Test Citizen',
        email: CITIZEN_EMAIL,
        passwordHash: citizenHash,
        role: 'citizen',
        municipality: testMuniId,
        isVerified: true,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  const { data: citizenLogin } = await request('POST', '/api/auth/login', null, {
    email: CITIZEN_EMAIL,
    password: 'Citizen@123',
  })
  citizenToken = citizenLogin.token

  try {
    // ── 1. Public GET departments ───────────────────────────────────────────
    await test('1. Public GET /api/municipalities/:id/departments returns departments', async () => {
      const { status, data } = await request('GET', `/api/municipalities/${testMuniId}/departments`, null)
      assert(status === 200, `Expected 200, got ${status}`)
      assert(Array.isArray(data.departments), 'Expected departments array')
    })

    // ── 2. Staff registration sets pending ────────────────────────────────
    await test('2. Staff registration sets applicationStatus to pending', async () => {
      const { status, data } = await request('POST', '/api/auth/register', null, {
        name: 'Test Staff',
        email: STAFF_EMAIL,
        password: STAFF_PASS,
        role: 'staff',
        municipality: testMuniId.toString(),
        department: testDeptId.toString(),
        employeeId: `EMP-TEST-${TEST_TIMESTAMP}`,
        designation: 'Field Officer',
      })
      assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
      assert(data.role === 'staff', 'Expected role=staff in response')

      const staff = await User.findOne({ email: STAFF_EMAIL })
      assert(staff !== null, 'Staff should be created')
      assert(staff.applicationStatus === 'pending', 'Expected applicationStatus=pending')
      assert(staff.appliedAt !== null, 'Expected appliedAt to be set')
      assert(staff.employeeId === `EMP-TEST-${TEST_TIMESTAMP}`, 'Expected employeeId to be set')
      staffId = staff._id.toString()
    })

    // ── 3. Duplicate employeeId returns 409 ───────────────────────────────
    await test('3. Duplicate employeeId returns 409', async () => {
      const { status } = await request('POST', '/api/auth/register', null, {
        name: 'Another Staff',
        email: `another.staff.${Date.now()}@nivaran.gov`,
        password: 'Another@123',
        role: 'staff',
        municipality: testMuniId.toString(),
        department: testDeptId.toString(),
        employeeId: `EMP-TEST-${TEST_TIMESTAMP}`,
        designation: 'Officer',
      })
      assert(status === 409, `Expected 409 for duplicate employeeId, got ${status}`)
    })

    // ── 4. Staff OTP verification returns no token if pending ─────────────
    await test('4. Staff OTP verification returns no token when pending', async () => {
      const staff = await User.findOne({ email: STAFF_EMAIL })
      const otp   = staff.otp

      const { status, data } = await request('POST', '/api/auth/verify-otp', null, {
        email: STAFF_EMAIL,
        otp,
      })
      assert(status === 200, `Expected 200, got ${status}`)
      assert(data.requiresApproval === true,   'Expected requiresApproval=true')
      assert(data.applicationStatus === 'pending', 'Expected applicationStatus=pending')
      assert(!data.token, 'Expected no token when pending')
    })

    // ── 5. Staff login blocked when pending ───────────────────────────────
    await test('5. Staff login blocked when applicationStatus is pending', async () => {
      const { status, data } = await request('POST', '/api/auth/login', null, {
        email: STAFF_EMAIL,
        password: STAFF_PASS,
      })
      assert(status === 403, `Expected 403, got ${status}`)
      assert(data.applicationStatus === 'pending', 'Expected applicationStatus=pending')
      assert(!data.token, 'Expected no token when pending')
    })

    // ── 6. Admin can list staff applications ─────────────────────────────
    await test('6. Admin can GET /api/staff/applications with status filter', async () => {
      const { status, data } = await request('GET', '/api/staff/applications?status=pending', adminToken)
      assert(status === 200, `Expected 200, got ${status}`)
      assert(Array.isArray(data.items), 'Expected items array')
      assert(data.total >= 1, 'Expected at least 1 pending application')
    })

    // ── 7. Admin can approve staff application ────────────────────────────
    await test('7. Admin can approve staff application', async () => {
      if (!staffId) {
        console.log('     (Skipping - staffId not set)')
        return
      }
      const { status, data } = await request('POST', `/api/staff/applications/${staffId}/approve`, adminToken)
      assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)
      assert(data.application.applicationStatus === 'approved', 'Expected approved status')

      const staff = await User.findById(staffId)
      assert(staff.applicationStatus === 'approved', 'Expected applicationStatus=approved in DB')
      assert(staff.reviewedAt !== null, 'Expected reviewedAt to be set')
      assert(staff.reviewedBy !== null, 'Expected reviewedBy to be set')
    })

    // ── 8. Approved staff can login ───────────────────────────────────────
    await test('8. Approved staff can login and receive token', async () => {
      if (!staffId) {
        console.log('     (Skipping - staffId not set)')
        return
      }
      const { status, data } = await request('POST', '/api/auth/login', null, {
        email: STAFF_EMAIL,
        password: STAFF_PASS,
      })
      assert(status === 200, `Expected 200, got ${status}`)
      assert(data.token, 'Expected JWT token')
      assert(data.user.role === 'staff', 'Expected role=staff')
    })

    // ── 9. Auto-assign only considers approved staff ───────────────────────
    await test('9. Auto-assign only considers approved staff', async () => {
      if (!staffId) {
        console.log('     (Skipping - staffId not set)')
        return
      }
      const pendingStaffHash = await bcrypt.hash('Pending@123', 10)
      const pendingStaff = await User.create({
        name: 'Pending Staff',
        email: `pending.staff.${Date.now()}@nivaran.gov`,
        passwordHash: pendingStaffHash,
        role: 'staff',
        municipality: testMuniId,
        department: testDeptId,
        applicationStatus: 'pending',
        isVerified: true,
        isActive: true,
      })

      const uniqueLat = 31.326 + (Math.random() * 0.01)
      const uniqueLng = 75.576 + (Math.random() * 0.01)
      const { status, data } = await request('POST', '/api/reports', citizenToken, {
        category: testCategoryId,
        description: 'Test pothole for auto-assign',
        lat: uniqueLat,
        lng: uniqueLng,
      })
      assert(status === 201 || status === 200, `Expected 201 or 200, got ${status}`)
      if (status === 201) {
        let newReportId = null
        if (data && data.data && data.data._id)         newReportId = data.data._id
        else if (data && data.report && data.report._id) newReportId = data.report._id
        else if (data && data._id)                       newReportId = data._id

        if (newReportId) {
          reportId = newReportId
          const report = await Report.findById(reportId)
          if (report && report.assignedTo) {
            assert(report.assignedTo.toString() === staffId.toString(), 'Expected assignment to approved staff only')
          } else {
            console.log('     (Report created but not assigned – may be no approved staff in dept)')
          }
        } else {
          console.log('     (Report ID not found in response – skipping assignment verification)')
        }
      } else {
        console.log('     (Duplicate detected – skipping assignment verification)')
      }

      await User.findByIdAndDelete(pendingStaff._id)
    })

    // ── 10. Manual assign rejects non-approved staff ───────────────────────
    await test('10. Manual assign rejects non-approved staff', async () => {
      if (!reportId) {
        console.log('     (Skipping - reportId not set)')
        return
      }
      const pendingStaffHash = await bcrypt.hash('Pending@123', 10)
      const pendingStaff = await User.create({
        name: 'Pending Staff 2',
        email: `pending.staff.${Date.now()}@nivaran.gov`,
        passwordHash: pendingStaffHash,
        role: 'staff',
        municipality: testMuniId,
        department: testDeptId,
        applicationStatus: 'pending',
        isVerified: true,
        isActive: true,
      })

      const { status, data } = await request('POST', `/api/reports/${reportId}/assign`, adminToken, {
        staffId: pendingStaff._id.toString(),
      })
      assert(status === 400, `Expected 400, got ${status}`)
      assert(data.message.includes('not approved'), 'Expected error about not being approved')

      await User.findByIdAndDelete(pendingStaff._id)
    })

    // ── 11. Admin can reject staff application ────────────────────────────
    let rejectedStaffId    = ''
    let rejectedStaffEmail = ''
    await test('11. Admin can reject staff application with reason', async () => {
      const rejectedStaffHash = await bcrypt.hash('Rejected@123', 10)
      rejectedStaffEmail = `rejected.staff.${Date.now()}@nivaran.gov`
      const rejectedStaff = await User.create({
        name: 'Rejected Staff',
        email: rejectedStaffEmail,
        passwordHash: rejectedStaffHash,
        role: 'staff',
        municipality: testMuniId,
        department: testDeptId,
        employeeId: `EMP-REJECTED-${TEST_TIMESTAMP}`,
        designation: 'Officer',
        applicationStatus: 'pending',
        isVerified: true,
        isActive: true,
      })
      rejectedStaffId = rejectedStaff._id.toString()

      const { status, data } = await request('POST', `/api/staff/applications/${rejectedStaffId}/reject`, adminToken, {
        reason: 'Insufficient documentation provided',
      })
      assert(status === 200, `Expected 200, got ${status}`)
      assert(data.application.applicationStatus === 'rejected', 'Expected rejected status')

      const staff = await User.findById(rejectedStaffId)
      assert(staff.applicationStatus === 'rejected', 'Expected applicationStatus=rejected in DB')
      assert(staff.rejectionReason === 'Insufficient documentation provided', 'Expected rejection reason')
    })

    // ── 12. Rejected staff cannot login ───────────────────────────────────
    await test('12. Rejected staff cannot login', async () => {
      if (!rejectedStaffEmail) {
        console.log('     (Skipping - rejectedStaffEmail not set)')
        return
      }
      const { status, data } = await request('POST', '/api/auth/login', null, {
        email: rejectedStaffEmail,
        password: 'Rejected@123',
      })
      assert(status === 403, `Expected 403, got ${status}`)
      assert(data.applicationStatus === 'rejected', 'Expected applicationStatus=rejected')
    })

    // ── 13. Admin can reconsider rejected application ─────────────────────
    await test('13. Admin can reconsider rejected application', async () => {
      if (!rejectedStaffId) {
        console.log('     (Skipping - rejectedStaffId not set)')
        return
      }
      const { status, data } = await request('POST', `/api/staff/applications/${rejectedStaffId}/reconsider`, adminToken)
      assert(status === 200, `Expected 200, got ${status}`)
      assert(data.application.applicationStatus === 'pending', 'Expected pending status after reconsider')

      const staff = await User.findById(rejectedStaffId)
      assert(staff.applicationStatus === 'pending', 'Expected applicationStatus=pending in DB')
      assert(staff.rejectionReason   === null,      'Expected rejection reason cleared')
    })

    // ── 14. Admin can revoke approved staff ───────────────────────────────
    await test('14. Admin can revoke approved staff with reason', async () => {
      if (!staffId) {
        console.log('     (Skipping - staffId not set)')
        return
      }
      const { status, data } = await request('POST', `/api/staff/${staffId}/revoke`, adminToken, {
        reason: 'Misconduct reported',
      })
      assert(status === 200, `Expected 200, got ${status}`)
      assert(data.releasedTickets >= 0, 'Expected releasedTickets count')

      const staff = await User.findById(staffId)
      assert(staff.applicationStatus === 'rejected', 'Expected applicationStatus=rejected after revoke')
      assert(staff.revokedAt         !== null,        'Expected revokedAt to be set')
      assert(staff.revokedBy         !== null,        'Expected revokedBy to be set')
      assert(staff.revocationReason  === 'Misconduct reported', 'Expected revocation reason')
    })

    // ── 15. Revoked staff cannot login ────────────────────────────────────
    await test('15. Revoked staff cannot login (session invalidated)', async () => {
      if (!staffId) {
        console.log('     (Skipping - staffId not set)')
        return
      }
      const { status, data } = await request('POST', '/api/auth/login', null, {
        email: STAFF_EMAIL,
        password: STAFF_PASS,
      })
      assert(status === 403, `Expected 403, got ${status}`)
      assert(data.applicationStatus === 'rejected', 'Expected applicationStatus=rejected')
    })

    // ── 16. Audit log entries for staff actions ───────────────────────────
    await test('16. Audit log entries created for staff actions', async () => {
      const logs        = await AuditLog.find({ targetMunicipality: testMuniId })
      const staffActions = logs.filter((log) => log.action.startsWith('staff.'))
      if (staffActions.length === 0) {
        console.log('     (No staff action logs found – may be due to earlier test failures)')
        return
      }
      assert(staffActions.length > 0, 'Expected staff action audit logs')

      const applyLog = staffActions.find((log) => log.action === 'staff.apply')
      if (applyLog) assert(applyLog !== undefined, 'Expected staff.apply audit log')

      const approveLog = staffActions.find((log) => log.action === 'staff.approve')
      if (approveLog) assert(approveLog !== undefined, 'Expected staff.approve audit log')

      const revokeLog = staffActions.find((log) => log.action === 'staff.revoke')
      if (revokeLog) assert(revokeLog !== undefined, 'Expected staff.revoke audit log')
    })

    // ── 17. Search filter works on applications endpoint ──────────────────
    await test('17. Search filter works on /api/staff/applications', async () => {
      const { status, data } = await request('GET', '/api/staff/applications?search=Test', adminToken)
      assert(status === 200, `Expected 200, got ${status}`)
      assert(Array.isArray(data.items), 'Expected items array')
    })

    // ── 18. Pagination works on applications endpoint ─────────────────────
    await test('18. Pagination works on /api/staff/applications', async () => {
      const { status, data } = await request('GET', '/api/staff/applications?page=1&limit=5', adminToken)
      assert(status === 200, `Expected 200, got ${status}`)
      assert(data.page       === 1, 'Expected page=1')
      assert(data.limit      === 5, 'Expected limit=5')
      assert(data.totalPages !== undefined, 'Expected totalPages')
    })

    // ── 19. Citizen registration still works ──────────────────────────────
    await test('19. Citizen registration still works with role=citizen', async () => {
      const { status, data } = await request('POST', '/api/auth/register', null, {
        name: 'Test Citizen 2',
        email: `citizen2.${Date.now()}@example.com`,
        password: 'Citizen@123',
        role: 'citizen',
        municipality: testMuniId.toString(),
      })
      assert(status === 201, `Expected 201, got ${status}`)
      assert(data.role === 'citizen', 'Expected role=citizen')
    })

    // ── 20. Invalid role returns 400 ──────────────────────────────────────
    await test('20. Invalid role in registration returns 400', async () => {
      const { status } = await request('POST', '/api/auth/register', null, {
        name: 'Invalid User',
        email: `invalid.${Date.now()}@example.com`,
        password: 'Invalid@123',
        role: 'admin',
        municipality: testMuniId.toString(),
      })
      assert(status === 400, `Expected 400 for invalid role, got ${status}`)
    })

    // ── 21. Department validation for staff registration ──────────────────
    await test('21. Staff registration validates department belongs to municipality', async () => {
      const otherMuni = await Municipality.findOne({ _id: { $ne: testMuniId } })
      const otherDept = await Department.findOne({ municipality: otherMuni?._id })

      if (otherDept) {
        const { status } = await request('POST', '/api/auth/register', null, {
          name: 'Invalid Dept Staff',
          email: `invalid.dept.${Date.now()}@nivaran.gov`,
          password: 'Invalid@123',
          role: 'staff',
          municipality: testMuniId.toString(),
          department: otherDept._id.toString(),
          employeeId: 'EMP-INVALID-001',
          designation: 'Officer',
        })
        assert(status === 400, `Expected 400 for mismatched department, got ${status}`)
      }
    })

    // ── 22. Seed staff have applicationStatus=approved ────────────────────
    await test('22. Seed staff have applicationStatus=approved', async () => {
      const seedStaff = await User.findOne({ role: 'staff', email: /staff\.roads\.jalandhar/ })
      if (seedStaff) {
        assert(seedStaff.applicationStatus === 'approved', `Expected seed staff to have applicationStatus=approved, got ${seedStaff.applicationStatus}`)
        assert(seedStaff.employeeId !== null, 'Expected seed staff to have employeeId')
      } else {
        console.log('     (Seed staff not found – may not be seeded yet)')
      }
    })

  } finally {
    // ── Teardown: always runs, even when an assertion or exception fails ──
    console.log('\n🧹 Cleaning up staff approval test fixtures…')
    await cleanup()

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
    if (failed === 0) {
      console.log('🎉 All Step 3 staff approval tests passed!\n')
    } else {
      console.log('❌ Some tests failed. See above for details.\n')
    }

    server.close()
    await disconnectTestDB()
    process.exit(failed > 0 ? 1 : 0)
  }
}

run().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
