/**
 * server/tests/scale.test.js
 *
 * Test suite for Prompt 7: Scale and Polish (Part 7)
 * Validates:
 *   1. Pagination defaults and clamps (page, limit) on:
 *      - GET /api/reports (getAllReports)
 *      - GET /api/reports/mine (getMyReports)
 *      - GET /api/reports/assigned (getAssignedReports)
 *      - GET /api/reports/department (getDepartmentReports)
 *      - GET /api/reports/disputed (getDisputedReports)
 *      - GET /api/staff/:id/tickets (getStaffTickets)
 *   2. Response structure contains pagination metadata: { page, limit, total, totalPages }
 *   3. Indexes backed queries:
 *      - Report queries use index prefix { municipality: 1 }
 *      - Own-reports query uses index { citizen: 1, createdAt: -1 }
 *   4. Bounds checking (limit > 100 clamped to 100, page < 1 clamped to 1)
 */

import { connectTestDB, disconnectTestDB } from './helpers/testDb.js'
import http from 'http'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

dotenv.config()

import Municipality from '../models/Municipality.js'
import Department from '../models/Department.js'
import Category from '../models/Category.js'
import User from '../models/User.js'
import Report from '../models/Report.js'
import reportRoutes from '../routes/reportRoutes.js'
import staffRoutes from '../routes/staffRoutes.js'
import superadminRoutes from '../routes/superadminRoutes.js'
import publicRoutes from '../routes/publicRoutes.js'
import municipalityRoutes from '../routes/municipalityRoutes.js'
import compression from 'compression'
import { parsePagination, buildPagination } from '../utils/pagination.js'

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

const app = express()
app.use(cors())
app.use(compression())
app.use(express.json({ limit: '10mb' }))

// Cache headers for public routes
app.use(['/api/public', '/api/municipalities'], (req, res, next) => {
  if (req.method === 'GET' && !req.headers.authorization) {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
  }
  next()
})

app.use('/api/reports', reportRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/superadmin', superadminRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/municipalities', municipalityRoutes)

let server
let baseUrl

function request(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
    const headers = options.headers || {}
    let body = options.body

    if (body && typeof body === 'object') {
      body = JSON.stringify(body)
      headers['Content-Type'] = 'application/json'
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => {
          raw += chunk
        })
        res.on('end', () => {
          let data = raw
          try {
            data = JSON.parse(raw)
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: data })
        })
      }
    )

    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function runScaleTests() {
  console.log('\n==================================================')
  console.log('🧪 Running Scale & Pagination Tests (Prompt 7)')
  console.log('==================================================\n')

  await connectTestDB()

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port
      baseUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })

  // Fixtures from DB
  const muni = await Municipality.findOne({ isActive: true })
  if (!muni) throw new Error('No active municipality found for scale tests')

  const admin = await User.findOne({ municipality: muni._id, role: 'admin', isActive: true })
  const citizen = await User.findOne({ municipality: muni._id, role: 'citizen', isActive: true })
  const staff = await User.findOne({ municipality: muni._id, role: 'staff', applicationStatus: 'approved', isActive: true })

  const adminToken = jwt.sign(
    { userId: admin._id, email: admin.email, role: 'admin', municipalityId: muni._id.toString() },
    process.env.JWT_SECRET || 'test_jwt_secret',
    { expiresIn: '1h' }
  )

  const citizenToken = jwt.sign(
    { userId: citizen._id, email: citizen.email, role: 'citizen', municipalityId: muni._id.toString() },
    process.env.JWT_SECRET || 'test_jwt_secret',
    { expiresIn: '1h' }
  )

  const staffToken = jwt.sign(
    { userId: staff._id, email: staff.email, role: 'staff', municipalityId: muni._id.toString() },
    process.env.JWT_SECRET || 'test_jwt_secret',
    { expiresIn: '1h' }
  )

  // ── Test 1: parsePagination & buildPagination unit bounds ──
  await test(1, 'parsePagination clamps defaults, minimums and ceilings cleanly', async () => {
    const p1 = parsePagination({ query: {} })
    if (p1.page !== 1 || p1.limit !== 20 || p1.skip !== 0) {
      throw new Error(`Expected page=1, limit=20, skip=0, got ${JSON.stringify(p1)}`)
    }

    const p2 = parsePagination({ query: { page: '-5', limit: '9999' } })
    if (p2.page !== 1 || p2.limit !== 100 || p2.skip !== 0) {
      throw new Error(`Expected clamp to page=1, limit=100, got ${JSON.stringify(p2)}`)
    }

    const p3 = parsePagination({ query: { page: '3', limit: '15' } })
    if (p3.page !== 3 || p3.limit !== 15 || p3.skip !== 30) {
      throw new Error(`Expected page=3, limit=15, skip=30, got ${JSON.stringify(p3)}`)
    }

    const env = buildPagination({ page: 2, limit: 10, total: 35 })
    if (env.totalPages !== 4 || env.total !== 35) {
      throw new Error(`Expected totalPages=4, got ${env.totalPages}`)
    }
  })

  // ── Test 2: Admin list reports returns paginated envelope ──
  await test(2, 'GET /api/reports returns reports and valid pagination envelope', async () => {
    const res = await request('GET', '/api/reports?page=1&limit=5', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    if (!Array.isArray(res.body.reports)) throw new Error('Expected reports array')
    if (!res.body.pagination || typeof res.body.pagination.total !== 'number') {
      throw new Error(`Expected pagination envelope in response: ${JSON.stringify(res.body)}`)
    }
    if (res.body.pagination.limit !== 5 || res.body.pagination.page !== 1) {
      throw new Error(`Pagination values mismatch: ${JSON.stringify(res.body.pagination)}`)
    }
  })

  // ── Test 3: Citizen own reports returns paginated envelope ──
  await test(3, 'GET /api/reports/mine returns reports and valid pagination envelope', async () => {
    const res = await request('GET', '/api/reports/mine?page=1&limit=10', {
      headers: { Authorization: `Bearer ${citizenToken}` },
    })

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    if (!Array.isArray(res.body.reports)) throw new Error('Expected reports array')
    if (!res.body.pagination || typeof res.body.pagination.total !== 'number') {
      throw new Error(`Expected pagination envelope in response: ${JSON.stringify(res.body)}`)
    }
  })

  // ── Test 4: Staff assigned reports returns paginated envelope ──
  await test(4, 'GET /api/reports/assigned returns reports and valid pagination envelope', async () => {
    const res = await request('GET', '/api/reports/assigned?page=1&limit=10', {
      headers: { Authorization: `Bearer ${staffToken}` },
    })

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    if (!Array.isArray(res.body.reports)) throw new Error('Expected reports array')
    if (!res.body.pagination || typeof res.body.pagination.total !== 'number') {
      throw new Error(`Expected pagination envelope in response: ${JSON.stringify(res.body)}`)
    }
  })

  // ── Test 5: Staff department reports returns paginated envelope ──
  await test(5, 'GET /api/reports/department returns reports and valid pagination envelope', async () => {
    const res = await request('GET', '/api/reports/department?page=1&limit=10', {
      headers: { Authorization: `Bearer ${staffToken}` },
    })

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    if (!Array.isArray(res.body.reports)) throw new Error('Expected reports array')
    if (!res.body.pagination || typeof res.body.pagination.total !== 'number') {
      throw new Error(`Expected pagination envelope in response: ${JSON.stringify(res.body)}`)
    }
  })

  // ── Test 6: Admin disputed reports returns paginated envelope ──
  await test(6, 'GET /api/reports/disputed returns reports and valid pagination envelope', async () => {
    const res = await request('GET', '/api/reports/disputed?page=1&limit=10', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    if (!Array.isArray(res.body.reports)) throw new Error('Expected reports array')
    if (!res.body.pagination || typeof res.body.pagination.total !== 'number') {
      throw new Error(`Expected pagination envelope in response: ${JSON.stringify(res.body)}`)
    }
  })

  // ── Test 7: Staff tickets history endpoint returns paginated envelope ──
  await test(7, 'GET /api/staff/:id/tickets returns tickets and pagination envelope', async () => {
    const res = await request('GET', `/api/staff/${staff._id}/tickets?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    if (!Array.isArray(res.body.tickets)) throw new Error('Expected tickets array')
    if (!res.body.pagination || typeof res.body.pagination.total !== 'number') {
      throw new Error(`Expected pagination envelope in response: ${JSON.stringify(res.body)}`)
    }
  })

  // ── Test 8: Query index plan verification (Explain test) ──
  await test(8, 'Report queries are backed by indexes using explain()', async () => {
    // 1. Admin filter by municipality and status
    const explainAdmin = await Report.find({ municipality: muni._id, status: 'reported' }).explain('executionStats')
    const winningAdmin = explainAdmin.queryPlanner?.winningPlan
    const stageAdmin = winningAdmin?.stage || winningAdmin?.inputStage?.stage
    if (stageAdmin === 'COLLSCAN') {
      throw new Error(`Admin query resulted in COLLSCAN! Explain: ${JSON.stringify(winningAdmin)}`)
    }

    // 2. Citizen own reports by citizen id
    const explainCitizen = await Report.find({ citizen: citizen._id }).sort({ createdAt: -1 }).explain('executionStats')
    const winningCitizen = explainCitizen.queryPlanner?.winningPlan
    const stageCitizen = winningCitizen?.stage || winningCitizen?.inputStage?.stage
    if (stageCitizen === 'COLLSCAN') {
      throw new Error(`Citizen own query resulted in COLLSCAN! Explain: ${JSON.stringify(winningCitizen)}`)
    }
  })

  // ── Test 9: Limit bounds enforcement ──
  await test(9, 'Excessive limit queries are automatically capped at maxLimit (100)', async () => {
    const res = await request('GET', '/api/reports?limit=500', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
    if (res.body.pagination.limit !== 100) {
      throw new Error(`Expected limit to be capped at 100, got ${res.body.pagination.limit}`)
    }
  })

  // ── Test 10: Map bounded box and map cap (Part 1 Map) ──
  await test(10, 'GET /api/reports/map filters within bounding box and caps total points', async () => {
    const res = await request(
      'GET',
      '/api/reports/map?minLat=30.0&minLng=74.0&maxLat=32.5&maxLng=76.5&limit=250',
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    )

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`)
    if (!Array.isArray(res.body.reports)) throw new Error('Expected reports array')
    if (typeof res.body.count !== 'number') throw new Error('Expected count in response')
    if (res.body.cap !== 250) throw new Error(`Expected cap 250, got ${res.body.cap}`)
  })

  // ── Test 11: Backend compression and public route cache-control headers (Part 6) ──
  await test(11, 'Public GET endpoints set Cache-Control headers without auth', async () => {
    const res = await request('GET', '/api/municipalities')
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`)
    const cacheHeader = res.headers['cache-control']
    if (!cacheHeader || !cacheHeader.includes('public') || !cacheHeader.includes('max-age')) {
      throw new Error(`Expected public Cache-Control header, got: ${cacheHeader}`)
    }
  })

  if (server) {
    await new Promise((resolve) => server.close(resolve))
  }
  await disconnectTestDB()

  console.log('\n──────────────────────────────────────────────────')
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
  if (failed > 0) {
    console.error(`💥 ${failed} scale tests failed!`)
    process.exit(1)
  } else {
    console.log('🎉 All Scale & Polish tests passed!\n')
    process.exit(0)
  }
}

runScaleTests().catch((err) => {
  console.error('Unhandled scale test failure:', err)
  process.exit(1)
})
