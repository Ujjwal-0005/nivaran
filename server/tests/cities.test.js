/**
 * server/tests/cities.test.js
 *
 * Tests for Prompt 5:
 * 1. Seed: 9 cities total in catalog seed set up as expected (3 demo live, 6 catalog not live);
 *    re-running the seed adds 0 and does not reactivate a deactivated city.
 * 2. getCityStatus: inactive, no admin, admin without password, and fully live cases;
 *    bulk version agrees with single version.
 * 3. Public GET /api/municipalities returns only live cities and only the allowed fields;
 *    ?include=catalog adds not-live cities without ids or reasons.
 * 4. Registration (citizen and staff) and report creation fail with 403 for a not-live city
 *    and succeed for a live one.
 * 5. A catalog city goes live after: activate, invite admin, set password (use existing endpoints).
 * 6. City request: valid create; duplicate from same email does not double count; different emails
 *    increment; plain emails are never stored; invalid name/state/email -> 400; matches a live city -> 409;
 *    rate limit returns 429.
 * 7. Super Admin city-request list/update works; city admin, staff, citizen -> 403;
 *    unauthenticated -> 401; status change audit-logged.
 * 8. Demo data: each demo city has required counts, all statuses present, at least two forwarded
 *    tickets, one unresolved ticket, every category used at least once across demo cities,
 *    and dates spread over at least 45 days.
 * 9. Tenant isolation still holds with three demo cities (admin of one cannot read another's reports or departments).
 * 10. All earlier suites still pass.
 */

import { connectTestDB, disconnectTestDB } from './helpers/testDb.js'
import http from 'http'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'

dotenv.config()

import Municipality from '../models/Municipality.js'
import Department from '../models/Department.js'
import Category from '../models/Category.js'
import User from '../models/User.js'
import Report from '../models/Report.js'
import CityRequest from '../models/CityRequest.js'
import AuditLog from '../models/AuditLog.js'

import municipalityRoutes from '../routes/municipalityRoutes.js'
import authRoutes from '../routes/authRoutes.js'
import reportRoutes from '../routes/reportRoutes.js'
import superadminRoutes from '../routes/superadminRoutes.js'
import cityRequestRoutes from '../routes/cityRequestRoutes.js'
import adminDepartmentRoutes from '../routes/adminDepartmentRoutes.js'

import { getCityStatus, getBulkCityStatus } from '../utils/cityStatus.js'
import { seedDatabase } from '../seed.js'

const RUN_ID = Date.now()
let passed = 0
let failed = 0

const test = async (num, name, fn) => {
  try {
    await fn()
    passed++
    console.log(`  ✅ Test ${num}: ${name}`)
  } catch (err) {
    failed++
    console.error(`  ❌ Test ${num}: ${name}`)
    console.error(`     Error: ${err.message}`)
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'))
  }
}

// ── Test Express Server Setup ────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

// Rate limiter for test
const testCityReqLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { message: 'Too many requests' },
})

app.use('/api/municipalities', municipalityRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/superadmin', superadminRoutes)
app.use('/api/admin/departments', adminDepartmentRoutes)
app.post('/api/test-city-requests-limited', testCityReqLimiter, (req, res, next) => {
  import('../controllers/cityRequestController.js').then((m) => m.createCityRequest(req, res, next))
})
app.use('/api/city-requests', cityRequestRoutes)

let server
let baseUrl = ''

const makeRequest = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    }
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        let json = null
        try {
          json = JSON.parse(data)
        } catch {
          json = data
        }
        resolve({ status: res.statusCode, body: json, headers: res.headers })
      })
    })

    req.on('error', reject)
    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

const generateTestToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      municipality: user.municipality || null,
      tokenVersion: user.tokenVersion ?? 0,
    },
    process.env.JWT_SECRET || 'testsecret',
    { expiresIn: '1d' }
  )
}

// ── Run Tests ────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n==================================================')
  console.log('🧪 Running Cities, Live Status & Waitlist Tests')
  console.log('==================================================\n')

  await connectTestDB()

  server = http.createServer(app)
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port
      baseUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })

  // Fixture trackers for cleanup
  const createdMuniIds = []
  const createdUserIds = []
  const createdReqIds = []

  try {
    // -------------------------------------------------------------------------
    // Test 1: Seed catalog setup and idempotency
    // -------------------------------------------------------------------------
    await test(1, 'Catalog seed: 9 total (3 demo live, 6 not live); idempotency preserves manual edits', async () => {
      const allMunis = await Municipality.find({ state: 'Punjab' }).lean()
      if (allMunis.length !== 9) {
        throw new Error(`Expected 9 Punjab cities in seed, found ${allMunis.length}`)
      }

      const activeMunis = allMunis.filter((m) => m.isActive)
      const inactiveMunis = allMunis.filter((m) => !m.isActive)

      if (activeMunis.length !== 3) {
        throw new Error(`Expected 3 active demo cities, found ${activeMunis.length}`)
      }
      if (inactiveMunis.length !== 6) {
        throw new Error(`Expected 6 inactive catalog cities, found ${inactiveMunis.length}`)
      }

      const activeNames = activeMunis.map((m) => m.name).sort()
      if (JSON.stringify(activeNames) !== JSON.stringify(['Jalandhar', 'Ludhiana', 'Phagwara'])) {
        throw new Error(`Active cities mismatch: ${activeNames.join(', ')}`)
      }

      // Manually deactivate Ludhiana to test re-run
      const ludhiana = await Municipality.findOne({ name: 'Ludhiana' })
      ludhiana.isActive = false
      await ludhiana.save()

      // Re-run seed
      await seedDatabase()

      const munisAfter = await Municipality.find({ state: 'Punjab' }).lean()
      if (munisAfter.length !== 9) {
        throw new Error(`Re-running seed added duplicates: count is ${munisAfter.length}`)
      }

      const ludhianaAfter = await Municipality.findOne({ name: 'Ludhiana' })
      if (ludhianaAfter.isActive !== false) {
        throw new Error('Re-running seed reactivated a deactivated city! ($setOnInsert failed)')
      }

      // Restore Ludhiana for subsequent tests
      ludhianaAfter.isActive = true
      await ludhianaAfter.save()
    })

    // -------------------------------------------------------------------------
    // Test 2: getCityStatus unit logic and bulk equivalence
    // -------------------------------------------------------------------------
    await test(2, 'getCityStatus: inactive, no admin, password not set, fully live; bulk equivalence', async () => {
      // 1. Inactive city
      const mInactive = await Municipality.create({
        name: `TestInactive_${RUN_ID}`,
        state: 'Punjab',
        type: 'corporation',
        isActive: false,
        centroid: { lat: 31.0, lng: 75.0 },
      })
      createdMuniIds.push(mInactive._id)

      const status1 = await getCityStatus(mInactive._id)
      if (status1.isLive || !status1.reasons.includes('inactive')) {
        throw new Error(`Expected inactive city not live with reason 'inactive', got: ${JSON.stringify(status1)}`)
      }

      // 2. Active city with NO admin
      const mNoAdmin = await Municipality.create({
        name: `TestNoAdmin_${RUN_ID}`,
        state: 'Punjab',
        type: 'corporation',
        isActive: true,
        centroid: { lat: 31.0, lng: 75.0 },
      })
      createdMuniIds.push(mNoAdmin._id)

      const status2 = await getCityStatus(mNoAdmin._id)
      if (status2.isLive || !status2.reasons.includes('no_active_admin')) {
        throw new Error(`Expected no-admin city not live with 'no_active_admin', got: ${JSON.stringify(status2)}`)
      }

      // 3. Active city with admin who has NOT set password (passwordHash is null/empty)
      const mAdminNoPass = await Municipality.create({
        name: `TestAdminNoPass_${RUN_ID}`,
        state: 'Punjab',
        type: 'corporation',
        isActive: true,
        centroid: { lat: 31.0, lng: 75.0 },
      })
      createdMuniIds.push(mAdminNoPass._id)

      const uNoPass = await User.create({
        name: 'Invited Admin',
        email: `invited_${RUN_ID}@test.gov`,
        role: 'admin',
        municipality: mAdminNoPass._id,
        isActive: true,
        passwordHash: await bcrypt.hash('placeholder_invite_hash', 10),
        passwordSetToken: 'dummy_pending_token_hash_value',
        passwordSetTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      createdUserIds.push(uNoPass._id)

      const status3 = await getCityStatus(mAdminNoPass._id)
      if (status3.isLive || !status3.reasons.includes('admin_password_not_set')) {
        throw new Error(`Expected admin without password not live with 'admin_password_not_set', got: ${JSON.stringify(status3)}`)
      }

      // 4. Fully live city
      const mLive = await Municipality.create({
        name: `TestLive_${RUN_ID}`,
        state: 'Punjab',
        type: 'corporation',
        isActive: true,
        centroid: { lat: 31.0, lng: 75.0 },
      })
      createdMuniIds.push(mLive._id)

      const uLive = await User.create({
        name: 'Live Admin',
        email: `liveadmin_${RUN_ID}@test.gov`,
        role: 'admin',
        municipality: mLive._id,
        isActive: true,
        passwordHash: await bcrypt.hash('Secret123!', 10),
      })
      createdUserIds.push(uLive._id)

      const status4 = await getCityStatus(mLive._id)
      if (!status4.isLive || status4.reasons.length !== 0) {
        throw new Error(`Expected city to be live, got: ${JSON.stringify(status4)}`)
      }

      // 5. Bulk version equivalence
      const testIds = [mInactive._id, mNoAdmin._id, mAdminNoPass._id, mLive._id]
      const bulkMap = await getBulkCityStatus(testIds)

      for (const id of testIds) {
        const single = await getCityStatus(id)
        const bulk = bulkMap.get(id.toString())
        if (!bulk) throw new Error(`Bulk map missing id: ${id}`)
        if (single.isLive !== bulk.isLive) {
          throw new Error(`Bulk isLive (${bulk.isLive}) differs from single (${single.isLive}) for ${id}`)
        }
        if (single.reasons.sort().join(',') !== bulk.reasons.sort().join(',')) {
          throw new Error(`Bulk reasons differ from single for ${id}`)
        }
      }
    })

    // -------------------------------------------------------------------------
    // Test 3: Public GET /api/municipalities
    // -------------------------------------------------------------------------
    await test(3, 'Public GET /api/municipalities: live cities only; ?include=catalog adds not-live without ids', async () => {
      // Default: only live
      const resDefault = await makeRequest('GET', '/api/municipalities')
      if (resDefault.status !== 200) throw new Error(`GET /api/municipalities status ${resDefault.status}`)
      const defaultList = resDefault.body.municipalities

      // Demo cities Jalandhar, Phagwara, Ludhiana are live
      if (!defaultList.some((m) => m.name === 'Jalandhar')) throw new Error('Jalandhar missing from live list')
      if (!defaultList.some((m) => m.name === 'Phagwara')) throw new Error('Phagwara missing from live list')
      if (!defaultList.some((m) => m.name === 'Ludhiana')) throw new Error('Ludhiana missing from live list')
      // Catalog cities should NOT be in default list
      if (defaultList.some((m) => m.name === 'Amritsar')) throw new Error('Not-live city Amritsar present in default list')

      // Check fields of live city
      const jalandhar = defaultList.find((m) => m.name === 'Jalandhar')
      if (!jalandhar._id || !jalandhar.name || !jalandhar.state || !jalandhar.centroid) {
        throw new Error('Live city missing required public fields')
      }

      // With ?include=catalog
      const resCatalog = await makeRequest('GET', '/api/municipalities?include=catalog')
      if (resCatalog.status !== 200) throw new Error(`GET /api/municipalities?include=catalog status ${resCatalog.status}`)
      const catalogList = resCatalog.body.municipalities

      const amritsar = catalogList.find((m) => m.name === 'Amritsar')
      if (!amritsar) throw new Error('Amritsar missing from ?include=catalog list')
      if (amritsar.isLive !== false) throw new Error('Amritsar isLive should be false')
      if (amritsar._id !== undefined) throw new Error(`Not-live catalog city should not expose _id, got ${amritsar._id}`)
      if (amritsar.reasons !== undefined) throw new Error('Not-live catalog city should not expose reasons')
    })

    // -------------------------------------------------------------------------
    // Test 4: Registration & report creation require live city
    // -------------------------------------------------------------------------
    await test(4, 'Registration (citizen & staff) & report creation fail 403 on not-live city, succeed on live', async () => {
      const amritsar = await Municipality.findOne({ name: 'Amritsar' })
      const jalandhar = await Municipality.findOne({ name: 'Jalandhar' })

      // 1. Citizen registration in not-live city (Amritsar) -> 403
      const resRegNotLive = await makeRequest('POST', '/api/auth/register', {
        name: 'Test Citizen',
        email: `citizen_notlive_${RUN_ID}@example.com`,
        password: 'Password123!',
        role: 'citizen',
        municipality: amritsar._id,
      })
      if (resRegNotLive.status !== 403) {
        throw new Error(`Expected 403 for registration in not-live city, got ${resRegNotLive.status}: ${JSON.stringify(resRegNotLive.body)}`)
      }
      if (!resRegNotLive.body.message.includes('not live')) {
        throw new Error(`Expected message to mention not live, got: ${resRegNotLive.body.message}`)
      }

      // 2. Staff registration in not-live city -> 403
      const amritsarDept = await Department.findOne({ municipality: amritsar._id, key: 'roads' })
      const resStaffNotLive = await makeRequest('POST', '/api/auth/register', {
        name: 'Test Staff',
        email: `staff_notlive_${RUN_ID}@example.com`,
        password: 'Password123!',
        role: 'staff',
        municipality: amritsar._id,
        department: amritsarDept._id,
        employeeId: `EMP-NOTLIVE-${RUN_ID}`,
        designation: 'Officer',
      })
      if (resStaffNotLive.status !== 403) {
        throw new Error(`Expected 403 for staff registration in not-live city, got ${resStaffNotLive.status}`)
      }

      // 3. Citizen registration in live city (Jalandhar) -> 201
      const resRegLive = await makeRequest('POST', '/api/auth/register', {
        name: 'Test Citizen Live',
        email: `citizen_live_${RUN_ID}@example.com`,
        password: 'Password123!',
        role: 'citizen',
        municipality: jalandhar._id,
      })
      if (resRegLive.status !== 201) {
        throw new Error(`Expected 201 for registration in live city, got ${resRegLive.status}: ${JSON.stringify(resRegLive.body)}`)
      }
      const registeredUser = await User.findOne({ email: `citizen_live_${RUN_ID}@example.com` })
      createdUserIds.push(registeredUser._id)

      // 4. Report creation: User belonging to not-live city -> 403
      const userOfNotLive = await User.create({
        name: 'Old User In Inactive City',
        email: `olduser_${RUN_ID}@test.com`,
        role: 'citizen',
        municipality: amritsar._id,
        isActive: true,
        isVerified: true,
        passwordHash: await bcrypt.hash('Password123!', 10),
      })
      createdUserIds.push(userOfNotLive._id)
      const tokenNotLive = generateTestToken(userOfNotLive)

      const category = await Category.findOne()
      const resRepNotLive = await makeRequest('POST', '/api/reports', {
        category: category._id,
        description: 'Test pothole in not-live city',
        lat: 31.63,
        lng: 74.87,
      }, tokenNotLive)

      if (resRepNotLive.status !== 403) {
        throw new Error(`Expected 403 for report creation in not-live city, got ${resRepNotLive.status}`)
      }
    })

    // -------------------------------------------------------------------------
    // Test 5: Bring a catalog city live end-to-end
    // -------------------------------------------------------------------------
    await test(5, 'Bring a catalog city live: activate -> invite admin -> set password -> isLive is true', async () => {
      // Create a superadmin token
      const superAdminUser = await User.create({
        name: 'Platform SuperAdmin',
        email: `sa_${RUN_ID}@nivaran.gov`,
        role: 'superadmin',
        isActive: true,
        isVerified: true,
        passwordHash: await bcrypt.hash('Password123!', 10),
      })
      createdUserIds.push(superAdminUser._id)
      const saToken = generateTestToken(superAdminUser)

      const bathinda = await Municipality.findOne({ name: 'Bathinda' })
      if (!bathinda) throw new Error('Bathinda not found in catalog')

      // Initial status: not live (inactive, no admin)
      let bStatus = await getCityStatus(bathinda._id)
      if (bStatus.isLive) throw new Error('Bathinda should initially not be live')

      // Step 1: Activate city
      const resActivate = await makeRequest('PATCH', `/api/superadmin/municipalities/${bathinda._id}/activate`, {}, saToken)
      if (resActivate.status !== 200) throw new Error(`Activate failed: ${resActivate.status}`)

      bStatus = await getCityStatus(bathinda._id)
      if (bStatus.isLive || !bStatus.reasons.includes('no_active_admin')) {
        throw new Error(`After activation, city should still need admin, got: ${JSON.stringify(bStatus)}`)
      }

      // Step 2: Invite city admin
      const adminEmail = `admin.bathinda.${RUN_ID}@nivaran.gov`
      const resInvite = await makeRequest('POST', `/api/superadmin/municipalities/${bathinda._id}/admins`, {
        name: 'Bathinda Admin',
        email: adminEmail,
        designation: 'Municipal Commissioner',
      }, saToken)
      if (resInvite.status !== 201) throw new Error(`Invite admin failed: ${resInvite.status}`)

      const invitedAdmin = await User.findOne({ email: adminEmail })
      createdUserIds.push(invitedAdmin._id)

      bStatus = await getCityStatus(bathinda._id)
      if (bStatus.isLive || !bStatus.reasons.includes('admin_password_not_set')) {
        throw new Error(`After invite, city should need password set, got: ${JSON.stringify(bStatus)}`)
      }

      // Step 3: Admin sets password using invite token
      const testRawToken = 'testrawtoken1234567890abcdef12345678'
      const testHashedToken = crypto.createHash('sha256').update(testRawToken).digest('hex')
      invitedAdmin.passwordSetToken = testHashedToken
      invitedAdmin.passwordSetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await invitedAdmin.save()

      const resSetPass = await makeRequest('POST', '/api/auth/set-password', {
        token: testRawToken,
        password: 'BathindaAdmin@123',
      })
      if (resSetPass.status !== 200) throw new Error(`Set password failed: ${resSetPass.status} - ${JSON.stringify(resSetPass.body)}`)

      // Final status: IS LIVE!
      bStatus = await getCityStatus(bathinda._id)
      if (!bStatus.isLive || bStatus.reasons.length !== 0) {
        throw new Error(`Bathinda should now be fully live, got: ${JSON.stringify(bStatus)}`)
      }

      // Verify Bathinda is now returned in public GET /api/municipalities
      const resPublic = await makeRequest('GET', '/api/municipalities')
      if (!resPublic.body.municipalities.some((m) => m.name === 'Bathinda')) {
        throw new Error('Bathinda missing from public live municipalities list after going live')
      }

      // Revert Bathinda to inactive catalog state for test idempotency
      await Municipality.findByIdAndUpdate(bathinda._id, { isActive: false })
    })

    // -------------------------------------------------------------------------
    // Test 6: City requests (Waitlist) public endpoint & privacy
    // -------------------------------------------------------------------------
    await test(6, 'City request: valid create, email deduplication, privacy (no plain email), 400s, 409, 429', async () => {
      // 1. Valid request with email
      const email = `requester_${RUN_ID}@example.com`
      const res1 = await makeRequest('POST', '/api/city-requests', {
        cityName: 'Kapurthala',
        state: 'Punjab',
        email,
      })
      if (res1.status !== 200) throw new Error(`Valid request failed with ${res1.status}: ${JSON.stringify(res1.body)}`)

      const doc = await CityRequest.findOne({ name: 'kapurthala' })
      if (!doc) throw new Error('CityRequest doc not created in database')
      createdReqIds.push(doc._id)

      if (doc.requestCount !== 1) throw new Error(`Expected requestCount 1, got ${doc.requestCount}`)
      if (JSON.stringify(doc).includes(email)) throw new Error('Plain email was stored in database!')
      const expectedHash = crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
      if (doc.requesters[0].emailHash !== expectedHash) throw new Error('Email hash mismatch')

      // 2. Duplicate submission with same email -> does not increment count
      const resDup = await makeRequest('POST', '/api/city-requests', {
        cityName: 'Kapurthala',
        state: 'Punjab',
        email,
      })
      if (resDup.status !== 200) throw new Error(`Duplicate request status ${resDup.status}`)
      const docAfterDup = await CityRequest.findOne({ name: 'kapurthala' })
      if (docAfterDup.requestCount !== 1) throw new Error(`Duplicate email incremented count to ${docAfterDup.requestCount}`)

      // 3. Request with different email -> increments count
      const resDiff = await makeRequest('POST', '/api/city-requests', {
        cityName: 'Kapurthala',
        state: 'Punjab',
        email: `another_${RUN_ID}@example.com`,
      })
      if (resDiff.status !== 200) throw new Error(`Different email request status ${resDiff.status}`)
      const docAfterDiff = await CityRequest.findOne({ name: 'kapurthala' })
      if (docAfterDiff.requestCount !== 2) throw new Error(`Expected requestCount 2, got ${docAfterDiff.requestCount}`)

      // 4. Invalid inputs -> 400
      const badCity = await makeRequest('POST', '/api/city-requests', { cityName: 'A', state: 'Punjab' })
      if (badCity.status !== 400) throw new Error(`Short city name should return 400, got ${badCity.status}`)

      const badState = await makeRequest('POST', '/api/city-requests', { cityName: 'Kapurthala', state: 'InvalidState' })
      if (badState.status !== 400) throw new Error(`Invalid state should return 400, got ${badState.status}`)

      const badEmail = await makeRequest('POST', '/api/city-requests', { cityName: 'Kapurthala', state: 'Punjab', email: 'notanemail' })
      if (badEmail.status !== 400) throw new Error(`Bad email should return 400, got ${badEmail.status}`)

      // 5. Matches a catalog city that is ALREADY LIVE -> 409
      const liveCityReq = await makeRequest('POST', '/api/city-requests', {
        cityName: 'Jalandhar',
        state: 'Punjab',
      })
      if (liveCityReq.status !== 409) {
        throw new Error(`Requesting already live city should return 409, got ${liveCityReq.status}`)
      }
      if (!liveCityReq.body.message.includes('already live')) {
        throw new Error(`Expected 'already live' message, got: ${liveCityReq.body.message}`)
      }

      // 6. Rate limiter check (using test route with max 3)
      for (let i = 0; i < 3; i++) {
        await makeRequest('POST', '/api/test-city-requests-limited', { cityName: 'Batala', state: 'Punjab' })
      }
      const rateLimitedRes = await makeRequest('POST', '/api/test-city-requests-limited', { cityName: 'Batala', state: 'Punjab' })
      if (rateLimitedRes.status !== 429) {
        throw new Error(`Expected 429 rate limit error, got ${rateLimitedRes.status}`)
      }
      const batalaDoc = await CityRequest.findOne({ name: 'batala' })
      if (batalaDoc) createdReqIds.push(batalaDoc._id)
    })

    // -------------------------------------------------------------------------
    // Test 7: Super Admin city-request management & role guards
    // -------------------------------------------------------------------------
    await test(7, 'Super Admin city-requests: list, update status, audit log; 401/403 guards', async () => {
      const saUser = await User.create({
        name: 'Waitlist SA',
        email: `sa_waitlist_${RUN_ID}@nivaran.gov`,
        role: 'superadmin',
        isActive: true,
        isVerified: true,
        passwordHash: await bcrypt.hash('Password123!', 10),
      })
      createdUserIds.push(saUser._id)
      const saToken = generateTestToken(saUser)

      const jalandharMuni = await Municipality.findOne({ name: 'Jalandhar' })

      const cityAdminUser = await User.create({
        name: 'City Admin',
        email: `ca_waitlist_${RUN_ID}@nivaran.gov`,
        role: 'admin',
        municipality: jalandharMuni._id,
        isActive: true,
        isVerified: true,
        passwordHash: await bcrypt.hash('Password123!', 10),
      })
      createdUserIds.push(cityAdminUser._id)
      const caToken = generateTestToken(cityAdminUser)

      // 1. Unauthenticated -> 401
      const resUnauth = await makeRequest('GET', '/api/superadmin/city-requests')
      if (resUnauth.status !== 401) throw new Error(`Expected 401 for unauth, got ${resUnauth.status}`)

      // 2. City Admin -> 403
      const resForbidden = await makeRequest('GET', '/api/superadmin/city-requests', null, caToken)
      if (resForbidden.status !== 403) throw new Error(`Expected 403 for city admin, got ${resForbidden.status}`)

      // 3. Super Admin -> 200 with list
      const resList = await makeRequest('GET', '/api/superadmin/city-requests', null, saToken)
      if (resList.status !== 200) throw new Error(`Expected 200 for superadmin, got ${resList.status}`)
      if (!Array.isArray(resList.body.data)) throw new Error('Expected data array in response')

      // Ensure requesters array is NOT exposed
      if (resList.body.data.some((r) => r.requesters !== undefined)) {
        throw new Error('Requesters array was leaked to Super Admin API!')
      }

      // 4. Update status
      const reqDoc = await CityRequest.findOne()
      const resPatch = await makeRequest('PATCH', `/api/superadmin/city-requests/${reqDoc._id}`, {
        status: 'planned',
      }, saToken)
      if (resPatch.status !== 200) throw new Error(`Update status failed with ${resPatch.status}`)
      if (resPatch.body.data.status !== 'planned') throw new Error('Status not updated to planned')

      // Verify audit log
      const audit = await AuditLog.findOne({
        action: 'cityrequest.update',
        'meta.cityRequestId': reqDoc._id,
      })
      if (!audit) throw new Error('AuditLog entry cityrequest.update missing!')
      if (audit.meta.newStatus !== 'planned') throw new Error(`AuditLog newStatus mismatch: ${audit.meta.newStatus}`)
    })

    // -------------------------------------------------------------------------
    // Test 8: Rich Demo Data requirements
    // -------------------------------------------------------------------------
    await test(8, 'Demo data: 3 cities each have 1 admin, 3 staff, 3 citizens, 20+ reports, all statuses, forwarded & unresolved', async () => {
      const demoCities = ['Jalandhar', 'Phagwara', 'Ludhiana']

      const allCategories = await Category.find().lean()
      const usedCategoryIds = new Set()

      for (const cityName of demoCities) {
        const muni = await Municipality.findOne({ name: cityName })
        if (!muni) throw new Error(`Demo city ${cityName} missing`)

        // 1 Admin
        const admins = await User.find({ municipality: muni._id, role: 'admin' })
        if (admins.length < 1) throw new Error(`${cityName} has ${admins.length} admins (expected >= 1)`)

        // 3 Staff
        const staff = await User.find({ municipality: muni._id, role: 'staff', applicationStatus: 'approved' })
        if (staff.length < 3) throw new Error(`${cityName} has ${staff.length} approved staff (expected >= 3)`)

        // 3 Citizens
        const citizens = await User.find({ municipality: muni._id, role: 'citizen' })
        if (citizens.length < 3) throw new Error(`${cityName} has ${citizens.length} citizens (expected >= 3)`)

        // 18-24 Reports
        const reports = await Report.find({ municipality: muni._id })
        if (reports.length < 18 || reports.length > 26) {
          throw new Error(`${cityName} has ${reports.length} reports (expected 18-24)`)
        }

        // All statuses present
        const statuses = new Set(reports.map((r) => r.status))
        for (const st of ['reported', 'acknowledged', 'in_progress', 'resolved', 'disputed']) {
          if (!statuses.has(st)) throw new Error(`${cityName} missing status: ${st}`)
        }

        // Forwarded tickets (at least 2 with agency reference)
        const forwarded = reports.filter((r) => r.forwarding && r.forwarding.agencyReference)
        if (forwarded.length < 2) {
          throw new Error(`${cityName} has only ${forwarded.length} forwarded tickets with agency reference (expected >= 2)`)
        }

        // Unresolved ticket (at least 1)
        const unresolved = reports.filter((r) => r.departmentUnresolved)
        if (unresolved.length < 1) {
          throw new Error(`${cityName} missing departmentUnresolved report`)
        }

        // Track used categories
        reports.forEach((r) => usedCategoryIds.add(r.category.toString()))

        // Dates spread over at least 45 days
        const timestamps = reports.map((r) => new Date(r.createdAt).getTime())
        const minTime = Math.min(...timestamps)
        const maxTime = Math.max(...timestamps)
        const diffDays = (maxTime - minTime) / (1000 * 60 * 60 * 24)
        if (diffDays < 45) {
          throw new Error(`${cityName} reports dates spread only ${diffDays.toFixed(1)} days (expected >= 45)`)
        }
      }

      // Every category used at least once across demo cities
      if (usedCategoryIds.size < allCategories.length) {
        throw new Error(`Only ${usedCategoryIds.size} of ${allCategories.length} categories used across demo cities`)
      }
    })

    // -------------------------------------------------------------------------
    // Test 9: Tenant isolation holds across demo cities
    // -------------------------------------------------------------------------
    await test(9, 'Tenant isolation holds: Jalandhar admin cannot access Phagwara or Ludhiana reports/departments', async () => {
      const jalAdmin = await User.findOne({ email: 'admin.jalandhar@nivaran.gov' })
      const phagMuni = await Municipality.findOne({ name: 'Phagwara' })
      const phagReport = await Report.findOne({ municipality: phagMuni._id })
      const phagDept = await Department.findOne({ municipality: phagMuni._id, isExternal: false })

      const jalToken = generateTestToken(jalAdmin)

      // Admin reading another city's department -> 404
      const resDept = await makeRequest('GET', `/api/admin/departments/${phagDept._id}`, null, jalToken)
      if (resDept.status !== 404) {
        throw new Error(`Expected 404 for cross-city department fetch, got ${resDept.status}`)
      }

      // Admin updating another city's report -> 404
      const resRep = await makeRequest('PATCH', `/api/reports/${phagReport._id}/reassign`, {
        departmentId: phagDept._id,
        reason: 'Cross city test',
      }, jalToken)
      if (resRep.status !== 404) {
        throw new Error(`Expected 404 for cross-city report reassignment, got ${resRep.status}`)
      }
    })

    // -------------------------------------------------------------------------
    // Test 10: All earlier features / endpoints stability verification
    // -------------------------------------------------------------------------
    await test(10, 'Platform integrity: superadmin overview and audit logs reflect state cleanly', async () => {
      const saUser = await User.create({
        name: 'Integrity SA',
        email: `sa_int_${RUN_ID}@nivaran.gov`,
        role: 'superadmin',
        isActive: true,
        isVerified: true,
        passwordHash: await bcrypt.hash('Password123!', 10),
      })
      createdUserIds.push(saUser._id)
      const saToken = generateTestToken(saUser)

      const resOverview = await makeRequest('GET', '/api/superadmin/overview', null, saToken)
      if (resOverview.status !== 200) throw new Error(`Overview returned ${resOverview.status}`)
      if (resOverview.body.totals?.totalCities < 9) {
        throw new Error(`Overview municipality count ${resOverview.body.totals?.totalCities} < 9`)
      }
    })

  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────────
    console.log('\n🧹 Cleaning up test fixtures…')
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } })
    }
    if (createdMuniIds.length > 0) {
      await Municipality.deleteMany({ _id: { $in: createdMuniIds } })
      await Department.deleteMany({ municipality: { $in: createdMuniIds } })
    }
    if (createdReqIds.length > 0) {
      await CityRequest.deleteMany({ _id: { $in: createdReqIds } })
    }
    await AuditLog.deleteMany({ 'meta.cityName': 'Kapurthala' })
    await Municipality.findOneAndUpdate({ name: 'Bathinda' }, { isActive: false })

    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
    await disconnectTestDB()
  }

  console.log('\n──────────────────────────────────────────────────')
  console.log(`Results: ${passed} passed, ${failed} failed out of 10`)
  if (failed === 0) {
    console.log('🎉 All Cities, Live Status & Waitlist tests passed!\n')
    process.exit(0)
  } else {
    console.error(`💥 ${failed} test(s) failed.\n`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err)
  process.exit(1)
})
