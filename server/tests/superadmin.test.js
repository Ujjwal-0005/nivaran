/**
 * superadmin.test.js
 *
 * Tests for Step 2 and Step 2 PATCH: Super Admin portal.
 * Runs against the MONGO_URI_TEST database only — never the real one.
 *
 * Run with: npm run test:superadmin  (from server/)
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
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'

// Load .env so JWT_SECRET and other vars are available (MONGO_URI already overridden by testDb)
dotenv.config()

import authRoutes from '../routes/authRoutes.js'
import superadminRoutes from '../routes/superadminRoutes.js'
import reportRoutes from '../routes/reportRoutes.js'

import Municipality from '../models/Municipality.js'
import User from '../models/User.js'
import Department from '../models/Department.js'
import Report from '../models/Report.js'
import Category from '../models/Category.js'
import AuditLog from '../models/AuditLog.js'

// ─── Unique fixture identifiers for this run ────────────────────────────────
const TEST_TIMESTAMP = Date.now()
const SA_EMAIL   = `sa.test.${TEST_TIMESTAMP}@nivaran.gov`
const SA_PASS    = 'SuperTest@1234'
const CITY_NAME  = `TestCity_${TEST_TIMESTAMP}`
const CITY_STATE = 'Punjab'
const ADMIN_EMAIL = `cityadmin_${TEST_TIMESTAMP}@test.gov`

// ─── Test Rate Limiting App Setup ────────────────────────────────────────────
const testAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { message: 'Too many requests' },
})

const app = express()
app.use(cors())
app.use(express.json())

app.post('/test/rate-limit/login', testAuthLimiter, (req, res) => res.json({ ok: true }))
app.post('/test/rate-limit/set-password', testAuthLimiter, (req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/superadmin', superadminRoutes)
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
let saToken       = ''
let adminToken    = ''
let testMuniId    = ''
let testAdminId   = ''
let rawInviteToken = ''
let testCategoryId = ''

// ─── "Clean slate" — remove leftover fixtures from crashed previous runs ──────
async function cleanSlate() {
  // Match by the fixed prefix patterns used by this suite.
  // We remove by email prefix patterns only — never delete everything.
  const deletedUsers = await User.deleteMany({
    email: { $regex: /^(sa\.test\.\d+@nivaran\.gov|cityadmin_\d+@test\.gov|test\.admin\.403@nivaran\.gov)$/ },
  })
  // Remove leftover test municipalities (name starts with TestCity_)
  const orphanMusis = await Municipality.find({ name: /^TestCity_\d+$/ })
  for (const m of orphanMusis) {
    await Department.deleteMany({ municipality: m._id })
    await User.deleteMany({ municipality: m._id })
    await AuditLog.deleteMany({ targetMunicipality: m._id })
    await Municipality.findByIdAndDelete(m._id)
  }
  const total = deletedUsers.deletedCount + orphanMusis.length
  if (total > 0) {
    console.log(`[clean-slate] Removed ${total} leftover superadmin-test fixture(s)`)
  }
}

// ─── Teardown — removes exactly the fixtures created by THIS run ──────────────
async function cleanup() {
  try {
    if (testMuniId) {
      await Municipality.findByIdAndDelete(testMuniId)
      await Department.deleteMany({ municipality: testMuniId })
      await User.deleteMany({ municipality: testMuniId })
      await AuditLog.deleteMany({ targetMunicipality: testMuniId })
    }
    await User.deleteMany({
      email: { $in: [SA_EMAIL, ADMIN_EMAIL, 'test.admin.403@nivaran.gov'] },
    })
  } catch (err) {
    console.warn('[cleanup] Warning during cleanup:', err.message)
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────
const run = async () => {
  // Connect to the TEST database (guard aborts if MONGO_URI_TEST is invalid)
  await connectTestDB()

  await cleanSlate()

  // Seed a super admin for this test session
  const saHash = await bcrypt.hash(SA_PASS, 10)
  await User.findOneAndUpdate(
    { email: SA_EMAIL },
    {
      $set: {
        name: 'Test Super Admin',
        email: SA_EMAIL,
        passwordHash: saHash,
        role: 'superadmin',
        isVerified: true,
        isActive: true,
        tokenVersion: 0,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  // Seed a regular municipality + admin for the 403 tests
  const jal = await Municipality.findOne({ name: 'Jalandhar' })
  if (jal) {
    const jalAdminHash = await bcrypt.hash('Admin@123', 10)
    await User.findOneAndUpdate(
      { email: 'test.admin.403@nivaran.gov' },
      {
        $set: {
          name: 'Test City Admin 403',
          email: 'test.admin.403@nivaran.gov',
          passwordHash: jalAdminHash,
          role: 'admin',
          municipality: jal._id,
          isVerified: true,
          isActive: true,
          tokenVersion: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
  }

  const cat = await Category.findOne()
  if (cat) {
    testCategoryId = cat._id
  }

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  PORT = server.address().port
  console.log(`\n🧪 Step 2 & Step 2 PATCH Tests  (port ${PORT})\n`)

  try {
    // ── 1. Super Admin login ────────────────────────────────────────────────
    await test('1. Super Admin can log in', async () => {
      const { status, data } = await request('POST', '/api/auth/login', null, {
        email: SA_EMAIL,
        password: SA_PASS,
      })
      assert(status === 200, `Expected 200, got ${status}: ${data.message}`)
      assert(data.token, 'Expected JWT token in response')
      saToken = data.token
    })

    // ── 2. City admin cannot access /api/superadmin ─────────────────────────
    await test('2. City admin cannot access /api/superadmin (403)', async () => {
      const loginRes = await request('POST', '/api/auth/login', null, {
        email: 'test.admin.403@nivaran.gov',
        password: 'Admin@123',
      })
      if (loginRes.status !== 200) {
        console.log('     (Jalandhar not seeded – skipping city admin 403 check)')
        return
      }
      adminToken = loginRes.data.token
      const { status } = await request('GET', '/api/superadmin/municipalities', adminToken)
      assert(status === 403, `Expected 403, got ${status}`)
    })

    // ── 3. Unauthenticated request returns 401 ──────────────────────────────
    await test('3. Unauthenticated request to /api/superadmin returns 401', async () => {
      const { status } = await request('GET', '/api/superadmin/municipalities', null)
      assert(status === 401, `Expected 401, got ${status}`)
    })

    // ── 4. List municipalities ──────────────────────────────────────────────
    await test('4. Super Admin can list municipalities', async () => {
      const { status, data } = await request('GET', '/api/superadmin/municipalities', saToken)
      assert(status === 200, `Expected 200, got ${status}`)
      assert(Array.isArray(data.data), 'Expected data.data to be an array')
      assert(data.pagination, 'Expected pagination object')
    })

    // ── 5. Create municipality ──────────────────────────────────────────────
    await test('5. Super Admin can create a municipality (departments auto-seeded)', async () => {
      const { status, data } = await request('POST', '/api/superadmin/municipalities', saToken, {
        name: CITY_NAME,
        state: CITY_STATE,
        type: 'council',
        centroid: { lat: 31.326, lng: 75.576 },
        defaultZoom: 13,
      })
      assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
      assert(data.data._id, 'Expected muni._id in response')
      testMuniId = data.data._id

      const municipalDeptCount = await Department.countDocuments({ municipality: testMuniId, isExternal: false })
      assert(municipalDeptCount === 10, `Expected 10 municipal departments, got ${municipalDeptCount}`)
    })

    // ── 6. Duplicate municipality returns 409 ───────────────────────────────
    await test('6. Duplicate municipality create returns 409', async () => {
      const { status } = await request('POST', '/api/superadmin/municipalities', saToken, {
        name: CITY_NAME,
        state: CITY_STATE,
        type: 'council',
        centroid: { lat: 31.326, lng: 75.576 },
      })
      assert(status === 409, `Expected 409, got ${status}`)
    })

    // ── 7. Update municipality ──────────────────────────────────────────────
    await test('7. Super Admin can update a municipality', async () => {
      const { status, data } = await request('PUT', `/api/superadmin/municipalities/${testMuniId}`, saToken, {
        nameLocal: 'ਟੈਸਟ ਸ਼ਹਿਰ',
        defaultZoom: 14,
      })
      assert(status === 200, `Expected 200, got ${status}: ${data.message}`)
      assert(data.data.nameLocal === 'ਟੈਸਟ ਸ਼ਹਿਰ', 'nameLocal not updated')
    })

    // ── 8. Deactivate municipality ──────────────────────────────────────────
    await test('8. Super Admin can deactivate a municipality', async () => {
      const { status, data } = await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/deactivate`, saToken)
      assert(status === 200, `Expected 200, got ${status}: ${data.message}`)
      const muni = await Municipality.findById(testMuniId)
      assert(muni.isActive === false, 'Expected isActive=false')
    })

    // ── 9. Activate municipality ────────────────────────────────────────────
    await test('9. Super Admin can activate a municipality', async () => {
      const { status } = await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/activate`, saToken)
      assert(status === 200, `Expected 200, got ${status}`)
      const muni = await Municipality.findById(testMuniId)
      assert(muni.isActive === true, 'Expected isActive=true')
    })

    // ── 10. Invite city admin ────────────────────────────────────────────────
    await test('10. Super Admin can invite a city admin (hashed token stored, primary admin flag set)', async () => {
      const { status, data } = await request(
        'POST',
        `/api/superadmin/municipalities/${testMuniId}/admins`,
        saToken,
        { name: 'Invited Admin', email: ADMIN_EMAIL, designation: 'Commissioner' }
      )
      assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
      assert(data.data.id, 'Expected admin id in response')
      assert(data.data.isVerified === false, 'Invited admin should not be verified yet')
      assert(data.data.isPrimaryAdmin === true, 'First admin should automatically be primary admin')
      assert(data.data.designation === 'Commissioner', 'Expected designation to be set')
      testAdminId = data.data.id

      const adminDoc = await User.findById(testAdminId)
      assert(adminDoc.passwordSetToken, 'Expected passwordSetToken to be set in DB')
      assert(adminDoc.passwordSetToken.length === 64, `Expected 64-char sha256 hash, got length ${adminDoc.passwordSetToken.length}`)
      assert(adminDoc.passwordSetTokenExpiry > new Date(), 'Expected token to be valid (future expiry)')

      const testRawToken = 'testrawtoken1234567890abcdef12345678'
      const testHash = crypto.createHash('sha256').update(testRawToken).digest('hex')
      adminDoc.passwordSetToken = testHash
      await adminDoc.save()
      rawInviteToken = testRawToken
    })

    // ── 11. Duplicate invite email returns 409 ──────────────────────────────
    await test('11. Duplicate invite email returns 409', async () => {
      const { status } = await request(
        'POST',
        `/api/superadmin/municipalities/${testMuniId}/admins`,
        saToken,
        { name: 'Another Admin', email: ADMIN_EMAIL }
      )
      assert(status === 409, `Expected 409, got ${status}`)
    })

    // ── 12. set-password with valid token activates admin ───────────────────
    await test('12. /api/auth/set-password with valid token activates admin', async () => {
      const { status, data } = await request('POST', '/api/auth/set-password', null, {
        token: rawInviteToken,
        password: 'NewSecure@456',
      })
      assert(status === 200, `Expected 200, got ${status}: ${data.message}`)
      assert(data.token, 'Expected a JWT token in response')
      assert(data.user.role === 'admin', 'Expected role=admin in response')

      const refreshed = await User.findById(testAdminId)
      assert(refreshed.isVerified === true, 'Expected isVerified=true')
      assert(refreshed.passwordSetToken === null, 'Expected token cleared')
    })

    // ── 13. Expired/invalid/reused set-password token returns 400 ───────────
    await test('13. Expired/invalid/reused set-password token returns 400', async () => {
      const { status: reuseStatus } = await request('POST', '/api/auth/set-password', null, {
        token: rawInviteToken,
        password: 'AnyPass@789',
      })
      assert(reuseStatus === 400, `Expected 400 for reused token, got ${reuseStatus}`)

      const { status: invalidStatus } = await request('POST', '/api/auth/set-password', null, {
        token: 'invalidtokenxyz',
        password: 'AnyPass@789',
      })
      assert(invalidStatus === 400, `Expected 400 for invalid token, got ${invalidStatus}`)
    })

    // ── 14. List city admins ────────────────────────────────────────────────
    await test('14. Super Admin can list city admins', async () => {
      const { status, data } = await request(
        'GET',
        `/api/superadmin/municipalities/${testMuniId}/admins`,
        saToken
      )
      assert(status === 200, `Expected 200, got ${status}`)
      assert(Array.isArray(data.data), 'Expected data.data array')
      const found = data.data.find((a) => a._id === testAdminId || a._id?.toString() === testAdminId)
      assert(found, 'Invited admin not in list')
      assert(!found.passwordHash, 'passwordHash should not be in response')
      assert(!found.passwordSetToken, 'passwordSetToken should not be in response')
    })

    // ── 15. Last-admin guard ────────────────────────────────────────────────
    await test('15. Deactivating the last active admin of an active city returns 409', async () => {
      const { status, data } = await request(
        'DELETE',
        `/api/superadmin/municipalities/${testMuniId}/admins/${testAdminId}`,
        saToken,
        { reason: 'Attempting sole admin deactivation' }
      )
      assert(status === 409, `Expected 409, got ${status}: ${JSON.stringify(data)}`)
    })

    // ── 16. Second admin + make-primary ────────────────────────────────────
    let secondAdminId = ''
    await test('16. Add second admin, make primary moves the primary flag', async () => {
      const secondEmail = `second.admin.${Date.now()}@test.gov`
      const { status, data } = await request(
        'POST',
        `/api/superadmin/municipalities/${testMuniId}/admins`,
        saToken,
        { name: 'Second Admin', email: secondEmail, designation: 'Assistant' }
      )
      assert(status === 201, `Expected 201, got ${status}`)
      secondAdminId = data.data.id
      assert(data.data.isPrimaryAdmin === false, 'Second admin should NOT be primary initially')

      const { status: mpStatus } = await request(
        'POST',
        `/api/superadmin/admins/${secondAdminId}/make-primary`,
        saToken
      )
      assert(mpStatus === 200, `Expected 200, got ${mpStatus}`)

      const firstAdminDoc  = await User.findById(testAdminId)
      const secondAdminDoc = await User.findById(secondAdminId)
      assert(secondAdminDoc.isPrimaryAdmin === true,  'Second admin should now be primary')
      assert(firstAdminDoc.isPrimaryAdmin  === false, 'First admin should now be demoted')
    })

    // ── 17. Deactivating primary promotes remaining ────────────────────────
    await test('17. Deactivating primary admin promotes remaining active admin to primary', async () => {
      const { status, data } = await request(
        'DELETE',
        `/api/superadmin/municipalities/${testMuniId}/admins/${secondAdminId}`,
        saToken,
        { reason: 'Resigned' }
      )
      assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`)

      const firstAdminDoc  = await User.findById(testAdminId)
      assert(firstAdminDoc.isPrimaryAdmin === true, 'First admin should have been auto-promoted back to primary')

      const secondAdminDoc = await User.findById(secondAdminId)
      assert(secondAdminDoc.isActive           === false,    'Second admin should be inactive')
      assert(secondAdminDoc.deactivationReason === 'Resigned', 'Reason should be stored')
      assert(secondAdminDoc.deactivatedAt      !== null,     'deactivatedAt should be recorded')
    })

    // ── 18. Reactivate admin restores access ───────────────────────────────
    await test('18. Reactivate admin restores active status', async () => {
      const { status, data } = await request(
        'POST',
        `/api/superadmin/admins/${secondAdminId}/reactivate`,
        saToken
      )
      assert(status === 200, `Expected 200, got ${status}`)
      const secondAdminDoc = await User.findById(secondAdminId)
      assert(secondAdminDoc.isActive           === true, 'Admin should now be active')
      assert(secondAdminDoc.deactivationReason === null, 'deactivationReason should be cleared')
    })

    // ── 19. Deactivating last admin of DEACTIVATED city is allowed ──────────
    await test('19. Deactivating last admin of a deactivated city is allowed', async () => {
      await request('DELETE', `/api/superadmin/municipalities/${testMuniId}/admins/${secondAdminId}`, saToken, { reason: 'Clean' })
      await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/deactivate`, saToken)

      const { status } = await request(
        'DELETE',
        `/api/superadmin/municipalities/${testMuniId}/admins/${testAdminId}`,
        saToken,
        { reason: 'City shut down' }
      )
      assert(status === 200, `Expected 200 when city is inactive, got ${status}`)

      await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/activate`, saToken)
      await request('POST', `/api/superadmin/admins/${testAdminId}/reactivate`, saToken)
    })

    // ── 20. Update admin designation, name, phone ──────────────────────────
    await test('20. PATCH /admins/:id updates name, phone, designation', async () => {
      const { status, data } = await request('PATCH', `/api/superadmin/admins/${testAdminId}`, saToken, {
        name: 'Updated Admin Name',
        phone: '+919999999999',
        designation: 'Special Officer',
      })
      assert(status === 200, `Expected 200, got ${status}`)
      assert(data.data.name        === 'Updated Admin Name', 'Name not updated')
      assert(data.data.phone       === '+919999999999',     'Phone not updated')
      assert(data.data.designation === 'Special Officer',   'Designation not updated')
    })

    // ── 21. GET /api/superadmin/admins ────────────────────────────────────
    await test('21. GET /api/superadmin/admins returns paginated items and supports filters', async () => {
      const { status, data } = await request('GET', `/api/superadmin/admins?city=${testMuniId}&limit=10`, saToken)
      assert(status === 200, `Expected 200, got ${status}`)
      assert(Array.isArray(data.items), 'Expected data.items array')
      assert(data.total  >= 1, 'Expected at least 1 admin')
      assert(data.page   === 1, 'Expected page=1')
      assert(data.limit  === 10, 'Expected limit=10')
    })

    // ── 22. GET /api/superadmin/overview ─────────────────────────────────
    await test('22. GET /api/superadmin/overview returns aggregate counts only without personal data', async () => {
      const { status, data } = await request('GET', '/api/superadmin/overview', saToken)
      assert(status === 200, `Expected 200, got ${status}`)
      assert(data.totals, 'Expected totals object')
      assert(typeof data.totals.totalCities  === 'number', 'Expected totalCities number')
      assert(typeof data.totals.totalAdmins  === 'number', 'Expected totalAdmins number')
      assert(typeof data.totals.totalReports === 'number', 'Expected totalReports number')
      assert(Array.isArray(data.perCity), 'Expected perCity array')

      const serialized = JSON.stringify(data)
      assert(!serialized.includes(ADMIN_EMAIL), 'Overview must not contain email addresses')
      assert(!serialized.includes(SA_EMAIL),    'Overview must not contain super admin email')

      if (adminToken) {
        const { status: forbiddenStatus } = await request('GET', '/api/superadmin/overview', adminToken)
        assert(forbiddenStatus === 403, `Expected 403 for non-superadmin on /overview, got ${forbiddenStatus}`)
      }
    })

    // ── 23. Deactivated city blocks new reports ────────────────────────────
    await test('23. Deactivated city blocks new report submission with 403', async () => {
      if (!testCategoryId) {
        console.log('     (No category found – skipping report test)')
        return
      }

      const citizenEmail = `citizen.test.${Date.now()}@example.com`
      const citizenHash  = await bcrypt.hash('Citizen@123', 10)
      const citizen = await User.create({
        name: 'Test Citizen',
        email: citizenEmail,
        passwordHash: citizenHash,
        role: 'citizen',
        municipality: testMuniId,
        isVerified: true,
        isActive: true,
      })

      const { data: citLogin } = await request('POST', '/api/auth/login', null, {
        email: citizenEmail,
        password: 'Citizen@123',
      })
      const citizenToken = citLogin.token

      await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/deactivate`, saToken)

      const { status, data } = await request('POST', '/api/reports', citizenToken, {
        category: testCategoryId,
        description: 'Test pothole in deactivated city',
        lat: 31.326,
        lng: 75.576,
      })
      assert(status === 403, `Expected 403, got ${status}: ${JSON.stringify(data)}`)

      await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/activate`, saToken)
      await User.findByIdAndDelete(citizen._id)
    })

    // ── 24. Deactivated city rejects inviting admins ───────────────────────
    await test('24. Inviting admin to deactivated city returns 400', async () => {
      await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/deactivate`, saToken)

      const { status } = await request(
        'POST',
        `/api/superadmin/municipalities/${testMuniId}/admins`,
        saToken,
        { name: 'Blocked Admin', email: `blocked_${Date.now()}@test.gov` }
      )
      assert(status === 400, `Expected 400 for inviting to inactive city, got ${status}`)

      await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/activate`, saToken)
    })

    // ── 25. Rate limiting returns 429 ─────────────────────────────────────
    await test('25. Rate limiter returns 429 when threshold exceeded', async () => {
      await request('POST', '/test/rate-limit/login', null, {})
      await request('POST', '/test/rate-limit/login', null, {})
      await request('POST', '/test/rate-limit/login', null, {})
      const { status } = await request('POST', '/test/rate-limit/login', null, {})
      assert(status === 429, `Expected 429 on 4th request, got ${status}`)
    })

    // ── 26. Audit log has no raw tokens ───────────────────────────────────
    await test('26. Audit log entries never contain raw token or links', async () => {
      const logs       = await AuditLog.find({ targetMunicipality: testMuniId }).lean()
      const serialized = JSON.stringify(logs)
      assert(!serialized.includes(rawInviteToken),       'Audit log must never contain raw invite token')
      assert(!serialized.includes('/set-password?token='), 'Audit log must never contain set-password url')
    })

  } finally {
    // ── Teardown: always runs, even when an assertion or exception fails ──
    console.log('\n🧹 Cleaning up superadmin test fixtures…')
    await cleanup()

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
    if (failed === 0) {
      console.log('🎉 All Step 2 & Step 2 PATCH tests passed!\n')
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
