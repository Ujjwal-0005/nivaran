/**
 * superadmin.test.js
 *
 * Tests for Step 2: Super Admin portal
 * Run with: npm run test:superadmin  (from server/)
 *
 * Test cases:
 *  1.  Super Admin can log in
 *  2.  Non-superadmin cannot access /api/superadmin (403)
 *  3.  Unauthenticated request to /api/superadmin returns 401
 *  4.  Super Admin can list municipalities
 *  5.  Super Admin can create a municipality (departments auto-seeded)
 *  6.  Duplicate municipality returns 409
 *  7.  Super Admin can update a municipality
 *  8.  Super Admin can deactivate a municipality
 *  9.  Super Admin can activate a municipality
 * 10.  Super Admin can invite a city admin (user created, isVerified=false)
 * 11.  Duplicate invite email returns 409
 * 12.  /api/auth/set-password with valid token activates admin + returns JWT
 * 13.  Expired/invalid set-password token returns 400
 * 14.  Super Admin can list city admins for a municipality
 * 15.  Super Admin can revoke a city admin (isActive=false, tokenVersion bumped)
 * 16.  Revoked city admin cannot log in (403)
 * 17.  Super Admin can reset city admin password (new token issued)
 * 18.  Audit log is written for each mutating action
 * 19.  Non-superadmin (city admin) cannot reach /api/superadmin/audit-log
 * 20.  Audit log supports action filter
 */

import http from 'http'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

import connectDB from '../config/db.js'
import authRoutes from '../routes/authRoutes.js'
import superadminRoutes from '../routes/superadminRoutes.js'

import Municipality from '../models/Municipality.js'
import User from '../models/User.js'
import Department from '../models/Department.js'
import AuditLog from '../models/AuditLog.js'

dotenv.config()

// ─── Test App ────────────────────────────────────────────────────────────────

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/superadmin', superadminRoutes)
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ message: err.message || 'Error' })
})

const server = http.createServer(app)

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SA_EMAIL = `sa.test.${Date.now()}@nivaran.gov`
const SA_PASS = 'SuperTest@1234'
const CITY_NAME = `TestCity_${Date.now()}`
const CITY_STATE = 'Punjab'
const ADMIN_EMAIL = `cityadmin_${Date.now()}@test.gov`

let saToken = ''
let adminToken = '' // a regular city admin token for 403 tests
let testMuniId = ''
let testAdminId = ''

// ─── Suite ───────────────────────────────────────────────────────────────────

const run = async () => {
  await connectDB()

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
    const jalAdmin = await User.findOneAndUpdate(
      { email: `test.admin.403@nivaran.gov` },
      {
        $set: {
          name: 'Test City Admin 403',
          email: `test.admin.403@nivaran.gov`,
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

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  PORT = server.address().port
  console.log(`\n🧪 Step 2: Super Admin Tests  (port ${PORT})\n`)

  // ── 1. Super Admin login ──────────────────────────────────────────────────
  await test('1. Super Admin can log in', async () => {
    const { status, data } = await request('POST', '/api/auth/login', null, {
      email: SA_EMAIL,
      password: SA_PASS,
    })
    assert(status === 200, `Expected 200, got ${status}: ${data.message}`)
    assert(data.user.role === 'superadmin', 'Expected role=superadmin')
    assert(data.token, 'Expected a JWT token')
    saToken = data.token
  })

  // ── 2. City admin cannot access /api/superadmin ───────────────────────────
  await test('2. City admin cannot access /api/superadmin (403)', async () => {
    const loginRes = await request('POST', '/api/auth/login', null, {
      email: 'test.admin.403@nivaran.gov',
      password: 'Admin@123',
    })
    if (loginRes.status !== 200) {
      // Jalandhar might not be seeded; skip gracefully
      console.log('     (Jalandhar not seeded – skipping city admin 403 check)')
      return
    }
    adminToken = loginRes.data.token
    const { status } = await request('GET', '/api/superadmin/municipalities', adminToken)
    assert(status === 403, `Expected 403, got ${status}`)
  })

  // ── 3. Unauthenticated request returns 401 ────────────────────────────────
  await test('3. Unauthenticated request to /api/superadmin returns 401', async () => {
    const { status } = await request('GET', '/api/superadmin/municipalities', null)
    assert(status === 401, `Expected 401, got ${status}`)
  })

  // ── 4. List municipalities ────────────────────────────────────────────────
  await test('4. Super Admin can list municipalities', async () => {
    const { status, data } = await request('GET', '/api/superadmin/municipalities', saToken)
    assert(status === 200, `Expected 200, got ${status}`)
    assert(Array.isArray(data.data), 'Expected data.data to be an array')
    assert(data.pagination, 'Expected pagination object')
  })

  // ── 5. Create municipality ────────────────────────────────────────────────
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

    // Verify departments were seeded
    const deptCount = await Department.countDocuments({ municipality: testMuniId })
    assert(deptCount === 10, `Expected 10 departments, got ${deptCount}`)
  })

  // ── 6. Duplicate municipality returns 409 ─────────────────────────────────
  await test('6. Duplicate municipality create returns 409', async () => {
    const { status } = await request('POST', '/api/superadmin/municipalities', saToken, {
      name: CITY_NAME,
      state: CITY_STATE,
      type: 'council',
      centroid: { lat: 31.326, lng: 75.576 },
    })
    assert(status === 409, `Expected 409, got ${status}`)
  })

  // ── 7. Update municipality ────────────────────────────────────────────────
  await test('7. Super Admin can update a municipality', async () => {
    const { status, data } = await request('PUT', `/api/superadmin/municipalities/${testMuniId}`, saToken, {
      nameLocal: 'ਟੈਸਟ ਸ਼ਹਿਰ',
      defaultZoom: 14,
    })
    assert(status === 200, `Expected 200, got ${status}: ${data.message}`)
    assert(data.data.nameLocal === 'ਟੈਸਟ ਸ਼ਹਿਰ', 'nameLocal not updated')
  })

  // ── 8. Deactivate municipality ────────────────────────────────────────────
  await test('8. Super Admin can deactivate a municipality', async () => {
    const { status, data } = await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/deactivate`, saToken)
    assert(status === 200, `Expected 200, got ${status}: ${data.message}`)
    const muni = await Municipality.findById(testMuniId)
    assert(muni.isActive === false, 'Expected isActive=false')
  })

  // ── 9. Activate municipality ──────────────────────────────────────────────
  await test('9. Super Admin can activate a municipality', async () => {
    const { status } = await request('PATCH', `/api/superadmin/municipalities/${testMuniId}/activate`, saToken)
    assert(status === 200, `Expected 200, got ${status}`)
    const muni = await Municipality.findById(testMuniId)
    assert(muni.isActive === true, 'Expected isActive=true')
  })

  // ── 10. Invite city admin ─────────────────────────────────────────────────
  await test('10. Super Admin can invite a city admin', async () => {
    const { status, data } = await request(
      'POST',
      `/api/superadmin/municipalities/${testMuniId}/admins`,
      saToken,
      { name: 'Invited Admin', email: ADMIN_EMAIL }
    )
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`)
    assert(data.data.id, 'Expected admin id in response')
    assert(data.data.isVerified === false, 'Invited admin should not be verified yet')
    testAdminId = data.data.id

    const adminDoc = await User.findById(testAdminId)
    assert(adminDoc.passwordSetToken, 'Expected passwordSetToken to be set')
    assert(adminDoc.passwordSetTokenExpiry > new Date(), 'Expected token to be valid (future expiry)')
  })

  // ── 11. Duplicate invite email returns 409 ────────────────────────────────
  await test('11. Duplicate invite email returns 409', async () => {
    const { status } = await request(
      'POST',
      `/api/superadmin/municipalities/${testMuniId}/admins`,
      saToken,
      { name: 'Another Admin', email: ADMIN_EMAIL }
    )
    assert(status === 409, `Expected 409, got ${status}`)
  })

  // ── 12. set-password with valid token activates admin + returns JWT ───────
  let setPasswordToken = ''
  await test('12. /api/auth/set-password with valid token activates admin', async () => {
    const adminDoc = await User.findById(testAdminId)
    setPasswordToken = adminDoc.passwordSetToken

    const { status, data } = await request('POST', '/api/auth/set-password', null, {
      token: setPasswordToken,
      password: 'NewSecure@456',
    })
    assert(status === 200, `Expected 200, got ${status}: ${data.message}`)
    assert(data.token, 'Expected a JWT token in response')
    assert(data.user.role === 'admin', 'Expected role=admin in response')

    const refreshed = await User.findById(testAdminId)
    assert(refreshed.isVerified === true, 'Expected isVerified=true')
    assert(refreshed.passwordSetToken === null, 'Expected token cleared')
  })

  // ── 13. Expired/invalid set-password token returns 400 ───────────────────
  await test('13. Expired/invalid set-password token returns 400', async () => {
    const { status } = await request('POST', '/api/auth/set-password', null, {
      token: 'invalidtokenxyz',
      password: 'AnyPass@789',
    })
    assert(status === 400, `Expected 400, got ${status}`)
  })

  // ── 14. List city admins ──────────────────────────────────────────────────
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
    // Sensitive fields should be stripped
    assert(!found.passwordHash, 'passwordHash should not be in response')
    assert(!found.passwordSetToken, 'passwordSetToken should not be in response')
  })

  // ── 15. Revoke city admin ─────────────────────────────────────────────────
  await test('15. Super Admin can revoke a city admin', async () => {
    const { status } = await request(
      'DELETE',
      `/api/superadmin/municipalities/${testMuniId}/admins/${testAdminId}`,
      saToken
    )
    assert(status === 200, `Expected 200, got ${status}`)
    const adminDoc = await User.findById(testAdminId)
    assert(adminDoc.isActive === false, 'Expected isActive=false after revoke')
  })

  // ── 16. Revoked admin cannot log in ──────────────────────────────────────
  await test('16. Revoked city admin cannot log in (403)', async () => {
    const { status, data } = await request('POST', '/api/auth/login', null, {
      email: ADMIN_EMAIL,
      password: 'NewSecure@456',
    })
    assert(status === 403, `Expected 403, got ${status}: ${data.message}`)
  })

  // ── 17. Reset city admin password ────────────────────────────────────────
  await test('17. Super Admin can reset city admin password (new token issued)', async () => {
    // Re-activate first so reset makes sense
    await User.findByIdAndUpdate(testAdminId, { isActive: true })

    const { status } = await request(
      'POST',
      `/api/superadmin/municipalities/${testMuniId}/admins/${testAdminId}/reset-password`,
      saToken
    )
    assert(status === 200, `Expected 200, got ${status}`)

    const adminDoc = await User.findById(testAdminId)
    assert(adminDoc.passwordSetToken, 'Expected new passwordSetToken to be set')
    assert(adminDoc.isVerified === false, 'Expected isVerified reset to false')
  })

  // ── 18. Audit log written for mutating actions ────────────────────────────
  await test('18. Audit log entries written for all mutating actions', async () => {
    const logs = await AuditLog.find({ targetMunicipality: testMuniId }).sort({ createdAt: 1 })
    const actions = logs.map((l) => l.action)
    const expected = [
      'municipality.create',
      'municipality.update',
      'municipality.deactivate',
      'municipality.activate',
      'cityadmin.invite',
      'cityadmin.revoke',
      'cityadmin.reset_password',
    ]
    for (const action of expected) {
      assert(actions.includes(action), `Missing audit log entry for action: ${action}`)
    }
  })

  // ── 19. Non-superadmin cannot reach /api/superadmin/audit-log ─────────────
  await test('19. City admin cannot access audit log (403)', async () => {
    if (!adminToken) {
      console.log('     (no city admin token – skipping)')
      return
    }
    const { status } = await request('GET', '/api/superadmin/audit-log', adminToken)
    assert(status === 403, `Expected 403, got ${status}`)
  })

  // ── 20. Audit log action filter works ─────────────────────────────────────
  await test('20. Audit log action filter returns only matching entries', async () => {
    const { status, data } = await request(
      'GET',
      '/api/superadmin/audit-log?action=municipality.create',
      saToken
    )
    assert(status === 200, `Expected 200, got ${status}`)
    assert(Array.isArray(data.data), 'Expected array')
    assert(
      data.data.every((l) => l.action === 'municipality.create'),
      'All returned entries should have action=municipality.create'
    )
  })

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  console.log('\n🧹 Cleaning up test fixtures…')
  await Municipality.findByIdAndDelete(testMuniId)
  await Department.deleteMany({ municipality: testMuniId })
  await User.deleteMany({ email: { $in: [SA_EMAIL, ADMIN_EMAIL, 'test.admin.403@nivaran.gov'] } })
  await AuditLog.deleteMany({ targetMunicipality: testMuniId })

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
  if (failed === 0) {
    console.log('🎉 All Step 2 Super Admin tests passed!\n')
  } else {
    console.log('❌ Some tests failed. See above for details.\n')
  }

  server.close()
  await mongoose.disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
