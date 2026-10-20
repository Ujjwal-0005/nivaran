/**
 * server/tests/crossCityReport.test.js
 *
 * Tests for Prompt 6:
 * Report in another city using the map pin:
 *  1. resolveCityFromPoint unit tests:
 *     - Coordinates validation (-90..90, -180..180).
 *     - Matches nearest live city centroid within radius.
 *     - Border rule: within HOME_PREFER_MARGIN_KM (5km), prefers home city if live and in radius.
 *     - Returns not_live with metadata when nearest city in radius is not yet live.
 *     - Returns null when pin is too far from any city.
 *  2. Cross-city report creation:
 *     - Citizen registered in Jalandhar drops pin in Ludhiana:
 *       Report is saved with municipality = Ludhiana (not Jalandhar).
 *     - Department routed using Ludhiana's departments/overrides.
 *     - Auto-assigned to Ludhiana staff (never Jalandhar staff).
 *     - Ludhiana admin sees it; Jalandhar admin does not.
 *     - Citizen sees it in "My Reports" regardless of city.
 *  3. Border case:
 *     - Pin near boundary prefers home city if within margin.
 *  4. Non-live / out-of-boundary cases:
 *     - Pin in Amritsar (catalog, not live) fails with 403.
 *     - Pin in middle of ocean / desert fails with 400.
 *  5. Client cannot supply or override municipality:
 *     - Client body municipality field is completely ignored; only pin coordinates govern.
 *  6. Category availability respects pin location:
 *     - GET /api/categories?lat=...&lng=... respects target city's category configurations.
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
import CategoryConfig from '../models/CategoryConfig.js'
import User from '../models/User.js'
import Report from '../models/Report.js'

import reportRoutes from '../routes/reportRoutes.js'
import categoryRoutes from '../routes/categoryRoutes.js'
import municipalityRoutes from '../routes/municipalityRoutes.js'
import { resolveCityFromPoint, CoordinateValidationError, getCrossCityDailyLimit } from '../utils/resolveCityFromPoint.js'

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
app.use('/api/reports', reportRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/municipalities', municipalityRoutes)

let server
let baseUrl

const startServer = () => {
  return new Promise((resolve) => {
    server = http.createServer(app)
    server.listen(0, () => {
      const port = server.address().port
      baseUrl = `http://localhost:${port}`
      resolve()
    })
  })
}

const stopServer = () => {
  return new Promise((resolve) => {
    if (server) server.close(resolve)
    else resolve()
  })
}

// ── Helper HTTP Client ────────────────────────────────────────────────────────
async function req(method, endpoint, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const options = { method, headers }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(`${baseUrl}${endpoint}`, options)
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

function makeToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
      municipality: user.municipality,
      tokenVersion: user.tokenVersion || 0,
    },
    process.env.JWT_SECRET || 'testsecret',
    { expiresIn: '1h' }
  )
}

// ── Main Test Runner ──────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n==================================================')
  console.log('🧪 Running Cross-City Pin Reporting Tests (Prompt 6)')
  console.log('==================================================\n')

  await connectTestDB()
  await startServer()

  try {
    // ── Setup & Fetch Seed Municipalities ────────────────────────────────────
    const jalandhar = await Municipality.findOne({ name: 'Jalandhar' })
    const ludhiana = await Municipality.findOne({ name: 'Ludhiana' })
    const phagwara = await Municipality.findOne({ name: 'Phagwara' })
    const amritsar = await Municipality.findOne({ name: 'Amritsar' })

    if (!jalandhar || !ludhiana || !phagwara || !amritsar) {
      throw new Error('Seed municipalities missing. Run freshTestDb.js first.')
    }

    // Citizens
    const jalandharCitizen = await User.findOne({ email: 'citizen1.jalandhar@example.com' })
    const jalandharCitizen2 = await User.findOne({ email: 'citizen2.jalandhar@example.com' })
    const jalandharCitizen3 = await User.findOne({ email: 'citizen3.jalandhar@example.com' })
    const ludhianaCitizen = await User.findOne({ email: 'citizen1.ludhiana@example.com' })
    const jalandharAdmin = await User.findOne({ email: 'admin.jalandhar@nivaran.gov' })
    const ludhianaAdmin = await User.findOne({ email: 'admin.ludhiana@nivaran.gov' })

    const potholeCategory = await Category.findOne({ name: /pothole/i }) || await Category.findOne()

    // Clean any prior cross-city reports created by test users so suite is idempotent
    await Report.deleteMany({
      citizen: { $in: [jalandharCitizen._id, jalandharCitizen2._id, jalandharCitizen3._id] },
      description: { $regex: /test/i },
    })

    const jalandharCitizenToken = makeToken(jalandharCitizen)
    const jalandharCitizen2Token = makeToken(jalandharCitizen2)
    const jalandharCitizen3Token = makeToken(jalandharCitizen3)
    const ludhianaCitizenToken = makeToken(ludhianaCitizen)
    const jalandharAdminToken = makeToken(jalandharAdmin)
    const ludhianaAdminToken = makeToken(ludhianaAdmin)

    // ── Test 1: Coordinate validation in resolveCityFromPoint ────────────────
    await test(1, 'Coordinate validation in resolveCityFromPoint rejects invalid values', async () => {
      let threwLat = false
      try {
        await resolveCityFromPoint({ lat: 95, lng: 75 })
      } catch (e) {
        if (e instanceof CoordinateValidationError) threwLat = true
      }
      if (!threwLat) throw new Error('Did not throw CoordinateValidationError for lat > 90')

      let threwLng = false
      try {
        await resolveCityFromPoint({ lat: 31, lng: 185 })
      } catch (e) {
        if (e instanceof CoordinateValidationError) threwLng = true
      }
      if (!threwLng) throw new Error('Did not throw CoordinateValidationError for lng > 180')
    })

    // ── Test 2: Pin resolution identifies nearest live city ──────────────────
    await test(2, 'resolveCityFromPoint resolves to nearest live municipality centroid', async () => {
      // Pin right at Ludhiana centroid
      const res = await resolveCityFromPoint({
        lat: ludhiana.centroid.lat,
        lng: ludhiana.centroid.lng,
        homeMunicipalityId: jalandhar._id,
      })

      if (!res || !res.municipality) {
        throw new Error('Failed to resolve city near Ludhiana centroid')
      }
      if (res.municipality._id.toString() !== ludhiana._id.toString()) {
        throw new Error(`Expected Ludhiana, resolved to ${res.municipality.name}`)
      }
      if (!res.isLive) {
        throw new Error('Expected resolved city to be live')
      }
    })

    // ── Test 3: Non-live city in radius returns not_live metadata ────────────
    await test(3, 'resolveCityFromPoint identifies nearest non-live city without resolving it', async () => {
      // Pin near Amritsar centroid (catalog city, isActive: false)
      const res = await resolveCityFromPoint({
        lat: amritsar.centroid.lat,
        lng: amritsar.centroid.lng,
        homeMunicipalityId: jalandhar._id,
      })

      if (!res) {
        throw new Error('Expected result object with not-live metadata')
      }
      if (res.isLive !== false) {
        throw new Error('Expected isLive: false for Amritsar pin')
      }
      if (!res.nearestNotLive || res.nearestNotLive.name !== 'Amritsar') {
        throw new Error(`Expected nearestNotLive name Amritsar, got ${JSON.stringify(res.nearestNotLive)}`)
      }
    })

    // ── Test 4: Pin in middle of nowhere returns null ────────────────────────
    await test(4, 'resolveCityFromPoint returns null for coordinates far away from any city', async () => {
      const res = await resolveCityFromPoint({
        lat: 20.0,
        lng: 78.0,
        homeMunicipalityId: jalandhar._id,
      })
      if (res !== null) {
        throw new Error('Expected null for coordinates far from Punjab')
      }
    })

    // ── Test 5: Border rule prefers home city within margin ──────────────────
    await test(5, 'Border rule prefers home city when within margin of nearest centroid', async () => {
      // Pick a point near Jalandhar and Phagwara border (they are ~21 km apart)
      // Jalandhar centroid: ~31.326, 75.576
      // Phagwara centroid: ~31.224, 75.770
      // Midpoint is ~31.275, 75.673
      const midLat = (jalandhar.centroid.lat + phagwara.centroid.lat) / 2
      const midLng = (jalandhar.centroid.lng + phagwara.centroid.lng) / 2

      const resHomeJal = await resolveCityFromPoint({
        lat: midLat,
        lng: midLng,
        homeMunicipalityId: jalandhar._id,
      })

      const resHomePhag = await resolveCityFromPoint({
        lat: midLat,
        lng: midLng,
        homeMunicipalityId: phagwara._id,
      })

      if (!resHomeJal || !resHomePhag) {
        throw new Error('Border point failed to resolve')
      }
      if (resHomeJal.municipality._id.toString() !== jalandhar._id.toString()) {
        throw new Error('Border rule did not prefer Jalandhar for Jalandhar citizen')
      }
      if (resHomePhag.municipality._id.toString() !== phagwara._id.toString()) {
        throw new Error('Border rule did not prefer Phagwara for Phagwara citizen')
      }
    })

    // ── Test 6: Cross-City report creation routes to pin city ────────────────
    let crossCityTicketId = null
    let crossCityReportId = null

    await test(6, 'Citizen of Jalandhar filing with pin in Ludhiana creates report in Ludhiana', async () => {
      const res = await req(
        'POST',
        '/api/reports',
        {
          category: potholeCategory._id,
          description: `Pothole on Ferozepur road test ${RUN_ID}`,
          lat: ludhiana.centroid.lat,
          lng: ludhiana.centroid.lng,
          isAnonymous: false,
          forceNew: true,
        },
        jalandharCitizenToken
      )

      if (res.status !== 201) {
        throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`)
      }

      crossCityTicketId = res.data.ticketId
      crossCityReportId = res.data.report.id

      if (res.data.report.city !== 'Ludhiana') {
        throw new Error(`Expected report city Ludhiana, got ${res.data.report.city}`)
      }

      // Check DB record
      const dbReport = await Report.findById(crossCityReportId).populate('department')
      if (!dbReport) throw new Error('Report not found in DB')

      if (dbReport.municipality.toString() !== ludhiana._id.toString()) {
        throw new Error(`Expected DB report municipality Ludhiana (${ludhiana._id}), got ${dbReport.municipality}`)
      }

      // Routed department must belong to Ludhiana
      if (dbReport.department && dbReport.department.municipality.toString() !== ludhiana._id.toString()) {
        throw new Error(`Department belongs to ${dbReport.department.municipality}, not Ludhiana`)
      }

      // Assigned staff must belong to Ludhiana
      if (dbReport.assignedTo) {
        const staff = await User.findById(dbReport.assignedTo)
        if (staff.municipality.toString() !== ludhiana._id.toString()) {
          throw new Error('Assigned staff is not from Ludhiana')
        }
      }
    })

    // ── Test 7: Multi-tenant scoping for cross-city ticket ───────────────────
    await test(7, 'Ludhiana admin sees the ticket; Jalandhar admin does not', async () => {
      // Ludhiana admin fetches all reports
      const resLudhiana = await req('GET', '/api/reports', null, ludhianaAdminToken)
      if (resLudhiana.status !== 200) throw new Error(`Ludhiana admin get reports failed: ${resLudhiana.status}`)
      const foundInLudhiana = resLudhiana.data.reports?.some((r) => r.ticketId === crossCityTicketId)
      if (!foundInLudhiana) throw new Error('Ludhiana admin did not see the report filed in Ludhiana')

      // Jalandhar admin fetches all reports
      const resJalandhar = await req('GET', '/api/reports', null, jalandharAdminToken)
      if (resJalandhar.status !== 200) throw new Error(`Jalandhar admin get reports failed: ${resJalandhar.status}`)
      const foundInJalandhar = resJalandhar.data.reports?.some((r) => r.ticketId === crossCityTicketId)
      if (foundInJalandhar) throw new Error('Jalandhar admin saw a report belonging to Ludhiana!')
    })

    // ── Test 8: Citizen sees cross-city report in My Reports ──────────────────
    await test(8, 'Citizen can view their own cross-city report in My Reports and Detail', async () => {
      const res = await req('GET', '/api/reports/mine', null, jalandharCitizenToken)
      if (res.status !== 200) throw new Error(`Citizen get my reports failed: ${res.status}`)

      const found = res.data.reports?.find((r) => r.ticketId === crossCityTicketId)
      if (!found) throw new Error('Cross-city report not found in citizen My Reports list')
      if (found.municipality?.name !== 'Ludhiana') {
        throw new Error(`Expected populated municipality Ludhiana, got ${found.municipality?.name}`)
      }

      // Check detail
      const detailRes = await req('GET', `/api/reports/${crossCityReportId}`, null, jalandharCitizenToken)
      if (detailRes.status !== 200) throw new Error(`Citizen get report detail failed: ${detailRes.status}`)
      if (detailRes.data.report?.ticketId !== crossCityTicketId) {
        throw new Error('Report detail ticketId mismatch')
      }
    })

    // ── Test 9: Client cannot spoof municipality in request body ─────────────
    await test(9, 'Client-supplied municipality in body is ignored; pin coordinates govern', async () => {
      const res = await req(
        'POST',
        '/api/reports',
        {
          municipality: jalandhar._id, // trying to force Jalandhar
          targetCity: 'Jalandhar',
          category: potholeCategory._id,
          description: `Spoof test ${RUN_ID}`,
          lat: ludhiana.centroid.lat,
          lng: ludhiana.centroid.lng,
          forceNew: true,
        },
        jalandharCitizen2Token
      )

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`)
      if (res.data.report.city !== 'Ludhiana') {
        throw new Error('Spoofed municipality was accepted!')
      }

      const dbReport = await Report.findById(res.data.report.id)
      if (dbReport.municipality.toString() !== ludhiana._id.toString()) {
        throw new Error('Spoofed municipality overrode pin derivation!')
      }
    })

    // ── Test 10: Pin in non-live city returns 403 ─────────────────────────────
    await test(10, 'Pin in non-live catalog city returns 403 Forbidden with city name', async () => {
      const res = await req(
        'POST',
        '/api/reports',
        {
          category: potholeCategory._id,
          description: `Amritsar test ${RUN_ID}`,
          lat: amritsar.centroid.lat,
          lng: amritsar.centroid.lng,
        },
        jalandharCitizenToken
      )

      if (res.status !== 403) {
        throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
      if (!res.data.message?.includes('Amritsar') || !res.data.message?.includes('not live')) {
        throw new Error(`Expected message stating Amritsar is not live, got "${res.data.message}"`)
      }
    })

    // ── Test 11: Pin out of all boundaries returns 400 ───────────────────────
    await test(11, 'Pin out of all municipality boundaries returns 400 Bad Request', async () => {
      const res = await req(
        'POST',
        '/api/reports',
        {
          category: potholeCategory._id,
          description: `Ocean test ${RUN_ID}`,
          lat: 10.0,
          lng: 70.0,
        },
        jalandharCitizenToken
      )

      if (res.status !== 400) {
        throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.data)}`)
      }
    })

    // ── Test 12: GET /api/categories?lat=...&lng=... pin-based availability ──
    await test(12, 'GET /api/categories with pin coordinates returns categories available in that city', async () => {
      // Disable a category specifically in Ludhiana
      await CategoryConfig.findOneAndUpdate(
        { municipality: ludhiana._id, category: potholeCategory._id },
        { municipality: ludhiana._id, category: potholeCategory._id, isEnabled: false },
        { upsert: true, new: true }
      )

      // Query categories with Ludhiana pin
      const resLudhiana = await req(
        'GET',
        `/api/categories?lat=${ludhiana.centroid.lat}&lng=${ludhiana.centroid.lng}`,
        null,
        jalandharCitizenToken
      )

      if (resLudhiana.status !== 200) throw new Error(`Expected 200, got ${resLudhiana.status}`)
      const hasPotholeLudhiana = resLudhiana.data.categories?.some((c) => c._id === potholeCategory._id.toString())
      if (hasPotholeLudhiana) {
        throw new Error('Disabled category was returned for Ludhiana pin!')
      }

      // Query categories with Jalandhar pin (should still be enabled in Jalandhar)
      const resJalandhar = await req(
        'GET',
        `/api/categories?lat=${jalandhar.centroid.lat}&lng=${jalandhar.centroid.lng}`,
        null,
        jalandharCitizenToken
      )
      const hasPotholeJalandhar = resJalandhar.data.categories?.some((c) => c._id === potholeCategory._id.toString())
      if (!hasPotholeJalandhar) {
        throw new Error('Category should be enabled for Jalandhar pin')
      }

      // Cleanup
      await CategoryConfig.deleteOne({ municipality: ludhiana._id, category: potholeCategory._id })
    })

    // ── Test 13: Public GET /api/municipalities/resolve ──────────────────────
    await test(13, 'Public GET /api/municipalities/resolve resolves live city and returns 403 for not-live', async () => {
      // Live city (Ludhiana)
      const resLive = await req('GET', `/api/municipalities/resolve?lat=${ludhiana.centroid.lat}&lng=${ludhiana.centroid.lng}`)
      if (resLive.status !== 200) throw new Error(`Expected 200, got ${resLive.status}`)
      if (resLive.data.municipality?.name !== 'Ludhiana' || !resLive.data.municipality?.isLive) {
        throw new Error('Expected live Ludhiana municipality in resolve response')
      }

      // Not live city (Amritsar) -> 403
      const resNotLive = await req('GET', `/api/municipalities/resolve?lat=${amritsar.centroid.lat}&lng=${amritsar.centroid.lng}`)
      if (resNotLive.status !== 403) throw new Error(`Expected 403, got ${resNotLive.status}`)
      if (!resNotLive.data.message?.includes('not live')) {
        throw new Error(`Expected not live message, got: ${resNotLive.data.message}`)
      }

      // Out of bounds -> 400
      const resOOB = await req('GET', `/api/municipalities/resolve?lat=12.0&lng=77.0`)
      if (resOOB.status !== 400) throw new Error(`Expected 400, got ${resOOB.status}`)
    })

    // ── Test 14: CROSS_CITY_DAILY_LIMIT returns 429 ──────────────────────────
    await test(14, 'CROSS_CITY_DAILY_LIMIT returns 429 after daily limit exceeded', async () => {
      process.env.CROSS_CITY_DAILY_LIMIT = '2'

      // First report in Ludhiana
      const r1 = await req('POST', '/api/reports', {
        category: potholeCategory._id,
        description: `Cross-city limit test 1 ${RUN_ID}`,
        lat: ludhiana.centroid.lat,
        lng: ludhiana.centroid.lng,
        forceNew: true,
      }, jalandharCitizen3Token)
      if (r1.status !== 201) throw new Error(`Report 1 failed: ${r1.status}`)

      // Second report in Ludhiana
      const r2 = await req('POST', '/api/reports', {
        category: potholeCategory._id,
        description: `Cross-city limit test 2 ${RUN_ID}`,
        lat: ludhiana.centroid.lat,
        lng: ludhiana.centroid.lng,
        forceNew: true,
      }, jalandharCitizen3Token)
      if (r2.status !== 201) throw new Error(`Report 2 failed: ${r2.status}`)

      // Third report in Ludhiana should fail with 429
      const r3 = await req('POST', '/api/reports', {
        category: potholeCategory._id,
        description: `Cross-city limit test 3 ${RUN_ID}`,
        lat: ludhiana.centroid.lat,
        lng: ludhiana.centroid.lng,
        forceNew: true,
      }, jalandharCitizen3Token)

      if (r3.status !== 429) {
        throw new Error(`Expected 429 for third report, got ${r3.status}: ${JSON.stringify(r3.data)}`)
      }
      if (!r3.data.message?.includes('limit reached')) {
        throw new Error(`Expected limit reached message, got: ${r3.data.message}`)
      }

      // But reporting in home city (Jalandhar) is still allowed!
      const rHome = await req('POST', '/api/reports', {
        category: potholeCategory._id,
        description: `Home city report test ${RUN_ID}`,
        lat: jalandhar.centroid.lat,
        lng: jalandhar.centroid.lng,
        forceNew: true,
      }, jalandharCitizen3Token)
      if (rHome.status !== 201) {
        throw new Error(`Home city report should succeed even if cross-city limit reached. Got ${rHome.status}`)
      }

      delete process.env.CROSS_CITY_DAILY_LIMIT
    })

    // ── Test 15: Owner exception for comments on own cross-city report ────────
    await test(15, 'Citizen can comment on their own cross-city report across tenant boundary', async () => {
      const commentRes = await req(
        'POST',
        `/api/reports/${crossCityReportId}/comments`,
        { text: `Citizen update comment test ${RUN_ID}` },
        jalandharCitizenToken
      )

      if (commentRes.status !== 201) {
        throw new Error(`Expected 201 adding comment to cross-city report, got ${commentRes.status}: ${JSON.stringify(commentRes.data)}`)
      }
      if (!commentRes.data.comment?.text?.includes('Citizen update comment test')) {
        throw new Error('Comment was not recorded')
      }
    })

    // ── Test 16: Owner exception for dispute and rating on own cross-city report ─
    await test(16, 'Citizen can rate and dispute their own cross-city report when resolved', async () => {
      // Mark report resolved in DB directly
      await Report.findByIdAndUpdate(crossCityReportId, { status: 'resolved' })

      // Rate report
      const rateRes = await req(
        'POST',
        `/api/reports/${crossCityReportId}/rate`,
        { score: 4, feedback: 'Resolved fine' },
        jalandharCitizenToken
      )
      if (rateRes.status !== 200) {
        throw new Error(`Expected 200 rating cross-city report, got ${rateRes.status}`)
      }

      // Dispute report
      const disputeRes = await req(
        'POST',
        `/api/reports/${crossCityReportId}/dispute`,
        { reason: 'Pothole opened up again next day' },
        jalandharCitizenToken
      )
      if (disputeRes.status !== 200) {
        throw new Error(`Expected 200 disputing cross-city report, got ${disputeRes.status}: ${JSON.stringify(disputeRes.data)}`)
      }
    })

    // ── Test 17: /join requires pin within 50m in the same city ──────────────
    await test(17, '/join requires pin within 50 meters and in the same city', async () => {
      // Target report is in Ludhiana at ludhiana.centroid
      const rep = await Report.findById(crossCityReportId)

      // 1. Join with pin far away in Ludhiana (>50m, e.g. 500m away) -> 400
      const farLat = rep.location.lat + 0.005
      const resFar = await req(
        'POST',
        `/api/reports/${crossCityReportId}/join`,
        { lat: farLat, lng: rep.location.lng },
        ludhianaCitizenToken
      )
      if (resFar.status !== 400) {
        throw new Error(`Expected 400 for far pin, got ${resFar.status}`)
      }
      if (!resFar.data.message?.includes('50 meters')) {
        throw new Error(`Expected 50 meters message, got: ${resFar.data.message}`)
      }

      // 2. Join with pin in another city (Jalandhar) -> 400
      const resOtherCity = await req(
        'POST',
        `/api/reports/${crossCityReportId}/join`,
        { lat: jalandhar.centroid.lat, lng: jalandhar.centroid.lng },
        ludhianaCitizenToken
      )
      if (resOtherCity.status !== 400) {
        throw new Error(`Expected 400 for different city pin, got ${resOtherCity.status}`)
      }

      // 3. Join with pin within 50m (e.g. 0.0001 deg ~ 11 meters) -> 200
      const nearLat = rep.location.lat + 0.0001
      const resNear = await req(
        'POST',
        `/api/reports/${crossCityReportId}/join`,
        { lat: nearLat, lng: rep.location.lng },
        ludhianaCitizenToken
      )
      if (resNear.status !== 200) {
        throw new Error(`Expected 200 for close pin in same city, got ${resNear.status}: ${JSON.stringify(resNear.data)}`)
      }
    })

    // ── Test 18: locationMatch and reporterHomeMunicipality are removed from responses ─
    await test(18, 'Internal routing metadata (locationMatch, reporterHomeMunicipality, routingHistory) never exposed to citizen or staff', async () => {
      const citizenDetail = await req('GET', `/api/reports/${crossCityReportId}`, null, jalandharCitizenToken)
      if (citizenDetail.status !== 200) throw new Error(`Detail failed: ${citizenDetail.status}`)

      const rObj = citizenDetail.data.report
      if ('locationMatch' in rObj) throw new Error('locationMatch exposed to citizen')
      if ('reporterHomeMunicipality' in rObj) throw new Error('reporterHomeMunicipality exposed to citizen')
      if ('routingHistory' in rObj) throw new Error('routingHistory exposed to citizen')
      if ('routedBy' in rObj) throw new Error('routedBy exposed to citizen')
    })
  } finally {
    console.log('\n🧹 Cleaning up test fixtures…')
    await stopServer()
    await disconnectTestDB()
  }

  console.log('\n──────────────────────────────────────────────────')
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
  if (failed === 0) {
    console.log('🎉 All Cross-City Pin Reporting tests passed!\n')
    process.exit(0)
  } else {
    console.error(`💥 ${failed} test(s) failed.\n`)
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
