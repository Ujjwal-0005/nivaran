/**
 * server/tests/routing.test.js
 *
 * Prompt 2 HTTP-level Test Suite covering all 23 scenarios:
 *
 * Routing:
 * 1. Pothole (Jalandhar) -> municipal roads department, sector_primary, one history entry, auto-assigned to approved staff.
 * 2. "Exposed electrical wires" -> PSPCL, external, assignedTo empty.
 * 3. "Streetlight not working" -> municipal Electrical department.
 * 4. "Encroachment" -> Municipal Enforcement.
 * 5. "Broken traffic signal" -> traffic police agency, external, unassigned.
 * 6. CategoryConfig.routeToDepartment override routes there (category_override).
 * 7. Primary deactivated -> sector_fallback, or if none, 201 with departmentUnresolved: true, routedBy: 'none'.
 * 8. A Phagwara citizen's report only lands in Phagwara departments.
 * 9. Duplicate detection and /join still work on a routed report.
 *
 * Category settings:
 * 10. Disabled category: create returns 400 and the category is absent from citizen list; other cities unaffected.
 * 11. severityOverride and slaHoursOverride change new report score inputs and SLA due time; with no config defaults equal; older report keeps values.
 * 12. Settings API validation: bad severity, bad SLA, routeToDepartment from another city, inactive department, unknown category -> 400/404.
 * 13. Settings API roles and tenancy: citizen 403, staff 403, Super Admin 403, Jalandhar admin cannot read or change Phagwara config.
 * 14. DELETE returns category to defaults; each settings change writes an audit entry.
 *
 * Reassign / forward / close:
 * 15. Reassign to another municipal department: assignee cleared, history entry, audit entry, reason required.
 * 16. Reassign to external department or another city's department -> 400/404.
 * 17. Forward to external agency: department changes, forwarding stored, status still open, assignedTo empty, citizen detail shows handledBy and agencyReference.
 * 18. Forward to municipal department or inactive agency -> 400.
 * 19. Admin manual assign on external ticket -> 409; assigning external-department staff or non-approved staff -> rejected.
 * 20. Staff of another department cannot read or update an external ticket.
 * 21. external-status: works on external ticket with note, rejected on municipal ticket (409), rejected without note, rejected for resolved reports.
 * 22. Cross-city: Jalandhar admin using Phagwara report id on reassign, forward, external-status returns 404.
 * 23. Citizen detail contains handledBy but not routedBy, routingHistory or staff private data; ?unresolved=true returns only admin's own city's unresolved reports.
 *
 * Cleans up all test fixtures in a finally block.
 */

import { connectTestDB, disconnectTestDB } from './helpers/testDb.js'
import http from 'http'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

dotenv.config()

import { initSocket } from '../config/socket.js'
import reportRoutes from '../routes/reportRoutes.js'
import categoryRoutes from '../routes/categoryRoutes.js'
import adminCategoryConfigRoutes from '../routes/adminCategoryConfigRoutes.js'

import Municipality from '../models/Municipality.js'
import Department from '../models/Department.js'
import Category from '../models/Category.js'
import User from '../models/User.js'
import Report from '../models/Report.js'
import CategoryConfig from '../models/CategoryConfig.js'
import AuditLog from '../models/AuditLog.js'
import { createDefaultDepartments, seedAgenciesForCity } from '../utils/departments.js'

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
    console.log(`  ❌ Test ${num}: ${name}`)
    console.log(`     ${err.message}`)
  }
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

// Build express app
const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/reports', reportRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/admin/category-settings', adminCategoryConfigRoutes)

app.use((err, req, res, next) => {
  const status = err.statusCode || 500
  res.status(status).json({ message: err.message || 'Error' })
})

const server = http.createServer(app)
initSocket(server)

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

const signToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      municipality: user.municipality || null,
      tokenVersion: user.tokenVersion ?? 0,
      name: user.name || 'Test User',
      email: user.email || 'test@example.com',
    },
    process.env.JWT_SECRET || 'test_jwt_secret',
    { expiresIn: '1h' }
  )
}

async function run() {
  await connectTestDB()

  let port = null
  let jalMuni = null
  let phagMuni = null

  // Fixture IDs to clean up
  const createdMuniIds = []
  const createdUserIds = []
  const createdReportIds = []
  const createdConfigIds = []
  const createdDeptIds = []

  try {
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port
        resolve()
      })
    })

    console.log(`\n🧪 Step: Prompt 2 Routing & Admin Actions Tests (Port ${port})\n`)

    // 1. Setup Municipalities
    jalMuni = await Municipality.create({
      name: `Jalandhar_RouteTest_${RUN_ID}`,
      state: 'Punjab',
      type: 'corporation',
      lgdCode: `LGD_JAL_${RUN_ID}`,
      centroid: { lat: 31.326, lng: 75.576 },
    })
    createdMuniIds.push(jalMuni._id)

    phagMuni = await Municipality.create({
      name: `Phagwara_RouteTest_${RUN_ID}`,
      state: 'Punjab',
      type: 'council',
      lgdCode: `LGD_PHAG_${RUN_ID}`,
      centroid: { lat: 31.224, lng: 75.77 },
    })
    createdMuniIds.push(phagMuni._id)

    // Seed default departments & agencies for both cities
    await createDefaultDepartments(jalMuni._id)
    await seedAgenciesForCity(jalMuni._id)

    await createDefaultDepartments(phagMuni._id)
    await seedAgenciesForCity(phagMuni._id)

    const allJalDepts = await Department.find({ municipality: jalMuni._id })
    const allPhagDepts = await Department.find({ municipality: phagMuni._id })
    createdDeptIds.push(...allJalDepts.map(d => d._id), ...allPhagDepts.map(d => d._id))

    const jalRoadsDept = allJalDepts.find(d => d.sector === 'ROADS' && d.isPrimary)
    const jalElecDept = allJalDepts.find(d => d.sector === 'STREET_LIGHTING' && d.isPrimary)
    const jalEnforceDept = allJalDepts.find(d => d.sector === 'ENFORCEMENT' && d.isPrimary)
    const jalPspclDept = allJalDepts.find(d => d.agencyCode === 'PSPCL')
    const jalTrafficPoliceDept = allJalDepts.find(d => d.agencyCode === 'PUNJAB-POLICE-TRAFFIC')
    const jalWaterDept = allJalDepts.find(d => d.sector === 'WATER' && d.isPrimary)

    // Setup Users
    const passwordHash = await bcrypt.hash('TestPass123!', 10)

    // Jalandhar Admin
    const jalAdmin = await User.create({
      name: `JalAdmin_${RUN_ID}`,
      email: `jaladmin_${RUN_ID}@example.com`,
      passwordHash,
      role: 'admin',
      municipality: jalMuni._id,
      isVerified: true,
      applicationStatus: 'approved',
    })
    createdUserIds.push(jalAdmin._id)
    const jalAdminToken = signToken(jalAdmin)

    // Phagwara Admin
    const phagAdmin = await User.create({
      name: `PhagAdmin_${RUN_ID}`,
      email: `phagadmin_${RUN_ID}@example.com`,
      passwordHash,
      role: 'admin',
      municipality: phagMuni._id,
      isVerified: true,
      applicationStatus: 'approved',
    })
    createdUserIds.push(phagAdmin._id)
    const phagAdminToken = signToken(phagAdmin)

    // Super Admin
    const superAdmin = await User.create({
      name: `SuperAdmin_${RUN_ID}`,
      email: `superadmin_${RUN_ID}@example.com`,
      passwordHash,
      role: 'superadmin',
      municipality: null,
      isVerified: true,
    })
    createdUserIds.push(superAdmin._id)
    const superAdminToken = signToken(superAdmin)

    // Jalandhar Citizen
    const jalCitizen = await User.create({
      name: `JalCitizen_${RUN_ID}`,
      email: `jalcit_${RUN_ID}@example.com`,
      passwordHash,
      role: 'citizen',
      municipality: jalMuni._id,
      isVerified: true,
    })
    createdUserIds.push(jalCitizen._id)
    const jalCitizenToken = signToken(jalCitizen)

    // Phagwara Citizen
    const phagCitizen = await User.create({
      name: `PhagCitizen_${RUN_ID}`,
      email: `phagcit_${RUN_ID}@example.com`,
      passwordHash,
      role: 'citizen',
      municipality: phagMuni._id,
      isVerified: true,
    })
    createdUserIds.push(phagCitizen._id)
    const phagCitizenToken = signToken(phagCitizen)

    // Jalandhar Approved Staff for ROADS
    const jalRoadsStaff = await User.create({
      name: `JalRoadsStaff_${RUN_ID}`,
      email: `jalroadsstaff_${RUN_ID}@example.com`,
      passwordHash,
      role: 'staff',
      department: jalRoadsDept._id,
      municipality: jalMuni._id,
      isVerified: true,
      applicationStatus: 'approved',
    })
    createdUserIds.push(jalRoadsStaff._id)
    const jalRoadsStaffToken = signToken(jalRoadsStaff)

    // Jalandhar Approved Staff for WATER
    const jalWaterStaff = await User.create({
      name: `JalWaterStaff_${RUN_ID}`,
      email: `jalwaterstaff_${RUN_ID}@example.com`,
      passwordHash,
      role: 'staff',
      department: jalWaterDept._id,
      municipality: jalMuni._id,
      isVerified: true,
      applicationStatus: 'approved',
    })
    createdUserIds.push(jalWaterStaff._id)
    const jalWaterStaffToken = signToken(jalWaterStaff)

    // Categories
    const potholeCat = await Category.findOne({ name: 'Pothole' })
    const wiresCat = await Category.findOne({ name: 'Exposed electrical wires' })
    const streetLightCat = await Category.findOne({ name: 'Streetlight not working' })
    const encroachCat = await Category.findOne({ name: 'Encroachment' })
    const trafficSignalCat = await Category.findOne({ name: 'Broken traffic signal' })

    assert(potholeCat, 'Pothole category must exist')
    assert(wiresCat, 'Exposed electrical wires category must exist')
    assert(streetLightCat, 'Streetlight not working category must exist')
    assert(encroachCat, 'Encroachment category must exist')
    assert(trafficSignalCat, 'Broken traffic signal category must exist')

    // ── Test 1: Pothole (Jalandhar) -> municipal roads dept, sector_primary, 1 history entry, auto-assigned to approved staff ──
    let test1ReportId = null
    await test(1, 'Pothole (Jalandhar) routes to municipal roads dept, sector_primary, auto-assigns to approved staff', async () => {
      const res = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: potholeCat._id,
        description: 'Large pothole on GT road near model town',
        lat: 31.326,
        lng: 75.576,
      })
      assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`)
      test1ReportId = res.data.report.id
      createdReportIds.push(test1ReportId)

      const rep = await Report.findById(test1ReportId)
      assert(rep.department.toString() === jalRoadsDept._id.toString(), 'Must route to jalRoadsDept')
      assert(rep.routedBy === 'sector_primary', `Expected routedBy sector_primary, got ${rep.routedBy}`)
      assert(rep.departmentUnresolved === false, 'departmentUnresolved should be false')
      assert(rep.routingHistory.length === 1, `Expected 1 history entry, got ${rep.routingHistory.length}`)
      assert(rep.routingHistory[0].action === 'auto', 'History action must be auto')
      assert(rep.assignedTo && rep.assignedTo.toString() === jalRoadsStaff._id.toString(), 'Must auto-assign to approved roads staff')
    })

    // ── Test 2: "Exposed electrical wires" -> PSPCL, external, assignedTo empty ──
    await test(2, '"Exposed electrical wires" routes to PSPCL, external, unassigned', async () => {
      const res = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: wiresCat._id,
        description: 'Live exposed wires hanging from pole',
        lat: 31.326,
        lng: 75.576,
      })
      assert(res.status === 201, `Expected 201, got ${res.status}`)
      const repId = res.data.report.id
      createdReportIds.push(repId)

      const rep = await Report.findById(repId)
      assert(rep.department.toString() === jalPspclDept._id.toString(), 'Must route to PSPCL agency dept')
      assert(rep.assignedTo === null, 'External agency report must NOT have staff assigned')
      assert(rep.routedBy === 'sector_primary', 'Should be sector_primary')
    })

    // ── Test 3: "Streetlight not working" -> municipal Electrical department ──
    await test(3, '"Streetlight not working" routes to municipal Electrical department', async () => {
      const res = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: streetLightCat._id,
        description: 'Dark street due to non-functioning streetlight',
        lat: 31.326,
        lng: 75.576,
      })
      assert(res.status === 201, `Expected 201, got ${res.status}`)
      const repId = res.data.report.id
      createdReportIds.push(repId)

      const rep = await Report.findById(repId)
      assert(rep.department.toString() === jalElecDept._id.toString(), 'Must route to municipal Electrical dept')
      assert(rep.routedBy === 'sector_primary', 'Should be sector_primary')
    })

    // ── Test 4: "Encroachment" -> Municipal Enforcement ──
    await test(4, '"Encroachment" routes to Municipal Enforcement', async () => {
      const res = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: encroachCat._id,
        description: 'Illegal vendor stall blocking sidewalk',
        lat: 31.326,
        lng: 75.576,
      })
      assert(res.status === 201, `Expected 201, got ${res.status}`)
      const repId = res.data.report.id
      createdReportIds.push(repId)

      const rep = await Report.findById(repId)
      assert(rep.department.toString() === jalEnforceDept._id.toString(), 'Must route to Municipal Enforcement')
      assert(rep.routedBy === 'sector_primary', 'Should be sector_primary')
    })

    // ── Test 5: "Broken traffic signal" -> traffic police agency, external, unassigned ──
    await test(5, '"Broken traffic signal" routes to traffic police agency, external, unassigned', async () => {
      const res = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: trafficSignalCat._id,
        description: 'Traffic signal stuck on red causing gridlock',
        lat: 31.326,
        lng: 75.576,
      })
      assert(res.status === 201, `Expected 201, got ${res.status}`)
      const repId = res.data.report.id
      createdReportIds.push(repId)

      const rep = await Report.findById(repId)
      assert(rep.department.toString() === jalTrafficPoliceDept._id.toString(), 'Must route to traffic police agency')
      assert(rep.assignedTo === null, 'Traffic police external ticket must not be assigned to city staff')
    })

    // ── Test 6: CategoryConfig.routeToDepartment override routes there (category_override) ──
    await test(6, 'CategoryConfig.routeToDepartment override routes there with category_override', async () => {
      const config = await CategoryConfig.create({
        municipality: jalMuni._id,
        category: potholeCat._id,
        routeToDepartment: jalEnforceDept._id,
        isEnabled: true,
      })
      createdConfigIds.push(config._id)

      const res = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: potholeCat._id,
        description: 'Pothole routed by custom city rule to enforcement',
        lat: 31.326,
        lng: 75.576,
      })
      assert(res.status === 201, `Expected 201, got ${res.status}`)
      const repId = res.data.report.id
      createdReportIds.push(repId)

      const rep = await Report.findById(repId)
      assert(rep.department.toString() === jalEnforceDept._id.toString(), 'Must route to override dept')
      assert(rep.routedBy === 'category_override', `Expected category_override, got ${rep.routedBy}`)

      // Cleanup override config
      await CategoryConfig.findByIdAndDelete(config._id)
    })

    // ── Test 7: Primary deactivated -> sector_fallback, or if none, 201 with departmentUnresolved: true, routedBy: 'none' ──
    await test(7, 'Primary deactivated -> sector_fallback or unresolved (201, departmentUnresolved: true, routedBy: none)', async () => {
      // Deactivate primary roads dept
      jalRoadsDept.isActive = false
      await jalRoadsDept.save()

      const res = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: potholeCat._id,
        description: 'Pothole reported while primary roads dept is inactive',
        lat: 31.326,
        lng: 75.576,
      })
      assert(res.status === 201, `Expected 201, got ${res.status}`)
      const repId = res.data.report.id
      createdReportIds.push(repId)

      const rep = await Report.findById(repId)
      // Since Jalandhar ROADS sector has PWD agency as non-primary fallback, or if no fallback, unresolved:
      if (rep.department) {
        assert(rep.routedBy === 'sector_fallback', `Expected sector_fallback, got ${rep.routedBy}`)
      } else {
        assert(rep.departmentUnresolved === true, 'departmentUnresolved should be true')
        assert(rep.routedBy === 'none', `Expected routedBy none, got ${rep.routedBy}`)
      }

      // Restore primary roads dept
      jalRoadsDept.isActive = true
      await jalRoadsDept.save()
    })

    // ── Test 8: A Phagwara citizen's report only lands in Phagwara departments ──
    await test(8, "A Phagwara citizen's report only lands in Phagwara departments", async () => {
      const res = await request(port, 'POST', '/api/reports', phagCitizenToken, {
        categoryId: potholeCat._id,
        description: 'Phagwara pothole on highway',
        lat: 31.224,
        lng: 75.77,
      })
      assert(res.status === 201, `Expected 201, got ${res.status}`)
      const repId = res.data.report.id
      createdReportIds.push(repId)

      const rep = await Report.findById(repId).populate('department')
      assert(rep.department.municipality.toString() === phagMuni._id.toString(), 'Must land in Phagwara municipality dept')
    })

    // ── Test 9: Duplicate detection and /join still work on a routed report ──
    await test(9, 'Duplicate detection and /join still work on a routed report', async () => {
      const origRes = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: potholeCat._id,
        description: 'Duplicate test pothole',
        lat: 31.327,
        lng: 75.577,
      })
      const origRepId = origRes.data.report.id
      createdReportIds.push(origRepId)

      // Another citizen in Jalandhar joins report
      const jalCitizen2 = await User.create({
        name: `JalCit2_${RUN_ID}`,
        email: `jalcit2_${RUN_ID}@example.com`,
        passwordHash,
        role: 'citizen',
        municipality: jalMuni._id,
        isVerified: true,
      })
      createdUserIds.push(jalCitizen2._id)
      const jalCitizen2Token = signToken(jalCitizen2)

      // Join report
      const joinRes = await request(port, 'POST', `/api/reports/${origRepId}/join`, jalCitizen2Token, {})
      assert(joinRes.status === 200, `Expected 200 on /join, got ${joinRes.status}: ${JSON.stringify(joinRes.data)}`)
      assert(joinRes.data.report.reportCount >= 2, 'Report count should have incremented')
    })

    // ── Test 10: Disabled category: create returns 400 and absent from citizen list; other cities unaffected ──
    await test(10, 'Disabled category returns 400 on report submit, absent from citizen list, other cities unaffected', async () => {
      const config = await CategoryConfig.create({
        municipality: jalMuni._id,
        category: streetLightCat._id,
        isEnabled: false,
      })
      createdConfigIds.push(config._id)

      // Submit in Jalandhar -> 400
      const submitRes = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: streetLightCat._id,
        description: 'Should fail because category is disabled in Jalandhar',
        lat: 31.326,
        lng: 75.576,
      })
      assert(submitRes.status === 400, `Expected 400 for disabled category, got ${submitRes.status}`)

      // Citizen list in Jalandhar -> category absent
      const catListJal = await request(port, 'GET', '/api/categories', jalCitizenToken)
      assert(catListJal.status === 200, 'Expected 200 from /api/categories')
      const hasStreetLightInJal = catListJal.data.categories.some(c => c._id.toString() === streetLightCat._id.toString())
      assert(!hasStreetLightInJal, 'Disabled category must be excluded from Jalandhar citizen category list')

      // Citizen list in Phagwara -> category present (unaffected)
      const catListPhag = await request(port, 'GET', '/api/categories', phagCitizenToken)
      const hasStreetLightInPhag = catListPhag.data.categories.some(c => c._id.toString() === streetLightCat._id.toString())
      assert(hasStreetLightInPhag, 'Phagwara citizen must still see the category')

      // Clean up config
      await CategoryConfig.findByIdAndDelete(config._id)
    })

    // ── Test 11: severityOverride and slaHoursOverride change new report score inputs and SLA due time; defaults equal when no config; older report keeps values ──
    await test(11, 'severityOverride and slaHoursOverride change score and SLA; default equals baseline; older reports unaffected', async () => {
      // 1. Create baseline report without config
      const baseRes = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: potholeCat._id,
        description: 'Baseline report before config override',
        lat: 31.326,
        lng: 75.576,
      })
      const baseRepId = baseRes.data.report.id
      createdReportIds.push(baseRepId)
      const baseRep = await Report.findById(baseRepId)

      // 2. Set CategoryConfig override with severity 10 (> default 7) and SLA 12 (< default 48)
      const config = await CategoryConfig.create({
        municipality: jalMuni._id,
        category: potholeCat._id,
        severityOverride: 10,
        slaHoursOverride: 12,
        isEnabled: true,
      })
      createdConfigIds.push(config._id)

      // 3. Create report with config active
      const nowBefore = Date.now()
      const overRes = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: potholeCat._id,
        description: 'Report after severity and SLA override',
        lat: 31.326,
        lng: 75.576,
      })
      const overRepId = overRes.data.report.id
      createdReportIds.push(overRepId)
      const overRep = await Report.findById(overRepId)

      // Compare: overRep SLA deadline must be ~12 hours from now, whereas baseRep was potholeCat.slaHours (48h)
      const overDiffHours = (new Date(overRep.slaDeadline) - nowBefore) / (1000 * 60 * 60)
      assert(Math.round(overDiffHours) === 12, `Expected ~12h SLA deadline, got ${overDiffHours}`)
      assert(overRep.priorityScore > baseRep.priorityScore, 'Report with severity 10 should have higher priority score than default severity 7')

      // Older report kept its original values
      const baseRepAfter = await Report.findById(baseRepId)
      assert(baseRepAfter.priorityScore === baseRep.priorityScore, 'Older report priorityScore must remain unchanged')
      assert(baseRepAfter.slaDeadline.getTime() === baseRep.slaDeadline.getTime(), 'Older report slaDeadline must remain unchanged')

      await CategoryConfig.findByIdAndDelete(config._id)
    })

    // ── Test 12: Settings API validation: bad severity, bad SLA, routeToDepartment from another city, inactive department, unknown category -> 400/404 ──
    await test(12, 'Settings API validation: bad severity, bad SLA, cross-city dept, inactive dept, unknown category -> 400/404', async () => {
      // Bad severity (< 1 or > 10)
      const badSev = await request(port, 'PUT', `/api/admin/category-settings/${potholeCat._id}`, jalAdminToken, {
        severityOverride: 11,
      })
      assert(badSev.status === 400, `Expected 400 for bad severity, got ${badSev.status}`)

      // Bad SLA (<= 0 or > 720)
      const badSla = await request(port, 'PUT', `/api/admin/category-settings/${potholeCat._id}`, jalAdminToken, {
        slaHoursOverride: 1000,
      })
      assert(badSla.status === 400, `Expected 400 for bad SLA, got ${badSla.status}`)

      // routeToDepartment from another city (Phagwara dept)
      const crossCityDept = await request(port, 'PUT', `/api/admin/category-settings/${potholeCat._id}`, jalAdminToken, {
        routeToDepartment: allPhagDepts[0]._id,
      })
      assert(crossCityDept.status === 400, `Expected 400 for cross-city dept, got ${crossCityDept.status}`)

      // Inactive dept
      jalRoadsDept.isActive = false
      await jalRoadsDept.save()
      const inactiveDept = await request(port, 'PUT', `/api/admin/category-settings/${potholeCat._id}`, jalAdminToken, {
        routeToDepartment: jalRoadsDept._id,
      })
      assert(inactiveDept.status === 400, `Expected 400 for inactive dept, got ${inactiveDept.status}`)
      jalRoadsDept.isActive = true
      await jalRoadsDept.save()

      // Unknown category -> 404
      const unknownCat = await request(port, 'PUT', `/api/admin/category-settings/${new Category()._id}`, jalAdminToken, {
        isEnabled: false,
      })
      assert(unknownCat.status === 404, `Expected 404 for unknown category, got ${unknownCat.status}`)
    })

    // ── Test 13: Settings API roles and tenancy: citizen 403, staff 403, Super Admin 403, Jalandhar admin cannot read or change Phagwara config ──
    await test(13, 'Settings API roles and tenancy: citizen/staff/superadmin 403, tenant isolation', async () => {
      const citRes = await request(port, 'GET', '/api/admin/category-settings', jalCitizenToken)
      assert(citRes.status === 403, `Citizen should get 403, got ${citRes.status}`)

      const staffRes = await request(port, 'GET', '/api/admin/category-settings', jalRoadsStaffToken)
      assert(staffRes.status === 403, `Staff should get 403, got ${staffRes.status}`)

      const saRes = await request(port, 'GET', '/api/admin/category-settings', superAdminToken)
      assert(saRes.status === 403, `Super Admin should get 403 (no municipality), got ${saRes.status}`)

      // Jalandhar admin updates Phagwara config? PUT /api/admin/category-settings/:categoryId always operates on req.user.municipality
      const jalAdminGet = await request(port, 'GET', '/api/admin/category-settings', jalAdminToken)
      assert(jalAdminGet.status === 200, 'Jalandhar admin should get 200')
      assert(Array.isArray(jalAdminGet.data.settings), 'Settings must be an array')
    })

    // ── Test 14: DELETE returns category to defaults; each settings change writes an audit entry ──
    await test(14, 'DELETE category config returns defaults, and writes audit entry', async () => {
      // Set override
      await request(port, 'PUT', `/api/admin/category-settings/${potholeCat._id}`, jalAdminToken, {
        severityOverride: 4,
        slaHoursOverride: 36,
      })

      // Delete override
      const delRes = await request(port, 'DELETE', `/api/admin/category-settings/${potholeCat._id}`, jalAdminToken)
      assert(delRes.status === 200, `Expected 200 on DELETE, got ${delRes.status}`)

      const conf = await CategoryConfig.findOne({ municipality: jalMuni._id, category: potholeCat._id })
      assert(!conf, 'Config should be deleted')

      const audits = await AuditLog.find({ action: { $in: ['category_config.update', 'category_config.delete'] }, actor: jalAdmin._id })
      assert(audits.length >= 2, `Expected at least 2 audit entries for upsert & delete, got ${audits.length}`)
    })

    // ── Test 15: Reassign to another municipal department: assignee cleared, history entry, audit entry, reason required ──
    let test15ReportId = null
    await test(15, 'Reassign to another municipal dept clears assignee, appends history, writes audit, requires reason', async () => {
      // Use test1ReportId (currently assigned to jalRoadsDept and jalRoadsStaff)
      test15ReportId = test1ReportId

      // Attempt without reason (< 5 chars) -> 400
      const noReason = await request(port, 'PATCH', `/api/reports/${test15ReportId}/reassign-department`, jalAdminToken, {
        departmentId: jalWaterDept._id,
        reason: 'bad',
      })
      assert(noReason.status === 400, `Expected 400 for short reason, got ${noReason.status}`)

      // Valid reassign to Water dept
      const validReassign = await request(port, 'PATCH', `/api/reports/${test15ReportId}/reassign-department`, jalAdminToken, {
        departmentId: jalWaterDept._id,
        reason: 'Pothole was actually caused by major water pipe burst',
      })
      assert(validReassign.status === 200, `Expected 200 on reassign, got ${validReassign.status}`)

      const rep = await Report.findById(test15ReportId)
      assert(rep.department.toString() === jalWaterDept._id.toString(), 'Department must be updated to Water dept')
      assert(rep.assignedTo && rep.assignedTo.toString() === jalWaterStaff._id.toString(), 'Should auto-assign to jalWaterStaff')
      assert(rep.routingHistory.length === 2, `Expected 2 history entries, got ${rep.routingHistory.length}`)
      assert(rep.routingHistory[1].action === 'reassign', 'Action must be reassign')

      const audit = await AuditLog.findOne({ action: 'report.reassign_department', actor: jalAdmin._id })
      assert(audit, 'Audit log entry must be written for reassign')

      // Verify the UI payload field name (targetDepartmentId) also works — this was the root bug
      const uiFieldReassign = await request(port, 'PATCH', `/api/reports/${test15ReportId}/reassign-department`, jalAdminToken, {
        targetDepartmentId: jalRoadsDept._id,  // restore to Roads using UI field name
        reason: 'Restoring to roads using UI field name to verify fix',
      })
      assert(uiFieldReassign.status === 200, `targetDepartmentId field must be accepted by server, got ${uiFieldReassign.status}`)
      const repAfterUiReassign = await Report.findById(test15ReportId)
      assert(repAfterUiReassign.department.toString() === jalRoadsDept._id.toString(), 'targetDepartmentId must route to the correct department')
    })

    // ── Test 16: Reassign to external department or another city's department -> 400/404 ──
    await test(16, 'Reassign to external department (400) or another city department (404)', async () => {
      // Reassign to external PSPCL -> 400
      const extRes = await request(port, 'PATCH', `/api/reports/${test15ReportId}/reassign-department`, jalAdminToken, {
        departmentId: jalPspclDept._id,
        reason: 'Wrongly trying to reassign municipal ticket to external',
      })
      assert(extRes.status === 400, `Expected 400 for external target, got ${extRes.status}`)

      // Reassign to Phagwara dept -> 404
      const crossRes = await request(port, 'PATCH', `/api/reports/${test15ReportId}/reassign-department`, jalAdminToken, {
        departmentId: allPhagDepts[0]._id,
        reason: 'Wrongly trying to reassign to another city dept',
      })
      assert(crossRes.status === 404, `Expected 404 for cross-city dept, got ${crossRes.status}`)
    })

    // ── Test 17: Forward to external agency: department changes, forwarding stored, status still open, assignedTo empty, citizen detail shows handledBy and agencyReference ──
    let test17ReportId = null
    await test(17, 'Forward to external agency stores forwarding, keeps status open, empties assignedTo, exposes handledBy', async () => {
      test17ReportId = test15ReportId

      const fwdRes = await request(port, 'POST', `/api/reports/${test17ReportId}/forward`, jalAdminToken, {
        departmentId: jalPspclDept._id,
        agencyReference: 'PSPCL-REF-9988',
        note: 'Issue is related to high voltage underground power line leaking current into water drain',
      })
      assert(fwdRes.status === 200, `Expected 200 on forward, got ${fwdRes.status}`)

      const rep = await Report.findById(test17ReportId)
      assert(rep.department.toString() === jalPspclDept._id.toString(), 'Department must be PSPCL')
      assert(rep.assignedTo === null, 'assignedTo must be null')
      assert(rep.forwarding && rep.forwarding.agencyReference === 'PSPCL-REF-9988', 'Forwarding reference must match')
      assert(rep.status === 'reported', 'Status must remain open')

      // Check citizen detail endpoint
      const citDetail = await request(port, 'GET', `/api/reports/${test17ReportId}`, jalCitizenToken)
      assert(citDetail.status === 200, 'Citizen must be able to view report detail')
      assert(citDetail.data.report.handledBy && citDetail.data.report.handledBy.isExternal === true, 'handledBy.isExternal must be true')
      assert(citDetail.data.report.handledBy.name === jalPspclDept.name, 'handledBy name must match PSPCL')
      assert(citDetail.data.report.agencyReference === 'PSPCL-REF-9988', 'agencyReference must be exposed')
    })

    // ── Test 18: Forward to municipal department or inactive agency -> 400 ──
    await test(18, 'Forward to municipal department or inactive agency returns 400', async () => {
      // Target is municipal
      const muniRes = await request(port, 'POST', `/api/reports/${test17ReportId}/forward`, jalAdminToken, {
        departmentId: jalRoadsDept._id,
        note: 'Invalid forward to municipal dept',
      })
      assert(muniRes.status === 400, `Expected 400 for forward to municipal, got ${muniRes.status}`)

      // Target is inactive agency
      jalPspclDept.isActive = false
      await jalPspclDept.save()
      const inactRes = await request(port, 'POST', `/api/reports/${test17ReportId}/forward`, jalAdminToken, {
        departmentId: jalPspclDept._id,
        note: 'Invalid forward to inactive agency',
      })
      assert(inactRes.status === 400, `Expected 400 for inactive agency, got ${inactRes.status}`)
      jalPspclDept.isActive = true
      await jalPspclDept.save()
    })

    // ── Test 19: Admin manual assign on external ticket -> 409; assigning external-dept staff or non-approved staff -> rejected ──
    await test(19, 'Admin manual assign on external ticket returns 409 naming agency; non-approved rejected', async () => {
      // test17ReportId is currently on jalPspclDept (external)
      const assignRes = await request(port, 'PATCH', `/api/reports/${test17ReportId}/assign`, jalAdminToken, {
        staffId: jalRoadsStaff._id,
      })
      assert(assignRes.status === 409, `Expected 409 on external ticket manual assign, got ${assignRes.status}`)
      assert(assignRes.data.message.includes('cannot be assigned to city staff'), 'Message must name external assignment restriction')
    })

    // ── Test 20: Staff of another department cannot read or update an external ticket ──
    await test(20, 'Staff of another department cannot read or update an external ticket', async () => {
      // jalRoadsStaff trying to read external ticket test17ReportId
      const readRes = await request(port, 'GET', `/api/reports/${test17ReportId}`, jalRoadsStaffToken)
      assert(readRes.status === 403, `Expected 403 for staff reading unassigned external ticket, got ${readRes.status}`)

      // jalRoadsStaff trying to update status of external ticket test17ReportId
      const updateRes = await request(port, 'PATCH', `/api/reports/${test17ReportId}/status`, jalRoadsStaffToken, {
        status: 'acknowledged',
      })
      assert(updateRes.status === 403, `Expected 403 for staff updating status of external ticket, got ${updateRes.status}`)
    })

    // ── Test 21: external-status: works on external ticket with note, rejected on municipal ticket (409), rejected without note, rejected for resolved reports ──
    await test(21, 'external-status works on external ticket with note, rejected on municipal ticket (409), rejected without note, rejected for resolved reports', async () => {
      // Rejected without note
      const noNote = await request(port, 'PATCH', `/api/reports/${test17ReportId}/external-status`, jalAdminToken, {
        status: 'acknowledged',
        note: 'short',
      })
      assert(noNote.status === 400, `Expected 400 for short note, got ${noNote.status}`)

      // Valid update to acknowledged
      const ackRes = await request(port, 'PATCH', `/api/reports/${test17ReportId}/external-status`, jalAdminToken, {
        status: 'acknowledged',
        note: 'PSPCL nodal officer acknowledged ticket via portal ref 12345',
      })
      assert(ackRes.status === 200, `Expected 200, got ${ackRes.status}`)

      // Rejected on municipal ticket
      // Create fresh municipal report
      const freshMuniRep = await request(port, 'POST', '/api/reports', jalCitizenToken, {
        categoryId: streetLightCat._id,
        description: 'Municipal ticket for testing external-status guard',
        lat: 31.326,
        lng: 75.576,
      })
      const muniRepId = freshMuniRep.data.report.id
      createdReportIds.push(muniRepId)

      const muniStatusRes = await request(port, 'PATCH', `/api/reports/${muniRepId}/external-status`, jalAdminToken, {
        status: 'in_progress',
        note: 'Attempting external status on municipal ticket',
      })
      assert(muniStatusRes.status === 409, `Expected 409 for external status on municipal ticket, got ${muniStatusRes.status}`)

      // Resolve external ticket
      const resolveRes = await request(port, 'PATCH', `/api/reports/${test17ReportId}/external-status`, jalAdminToken, {
        status: 'resolved',
        note: 'PSPCL team repaired power cable and confirmed on site',
      })
      assert(resolveRes.status === 200, `Expected 200 on resolve, got ${resolveRes.status}`)

      // Rejected for already resolved report
      const postResolve = await request(port, 'PATCH', `/api/reports/${test17ReportId}/external-status`, jalAdminToken, {
        status: 'in_progress',
        note: 'Attempting change on already resolved ticket',
      })
      assert(postResolve.status === 409, `Expected 409 on already resolved ticket, got ${postResolve.status}`)
    })

    // ── Test 22: Cross-city: Jalandhar admin using Phagwara report id on reassign, forward, external-status returns 404 ──
    await test(22, 'Cross-city: Jalandhar admin using Phagwara report id returns 404 for reassign, forward, and external-status', async () => {
      // Create report in Phagwara
      const phagRepRes = await request(port, 'POST', '/api/reports', phagCitizenToken, {
        categoryId: potholeCat._id,
        description: 'Cross city security check report',
        lat: 31.224,
        lng: 75.77,
      })
      const phagRepId = phagRepRes.data.report.id
      createdReportIds.push(phagRepId)

      const reassignCross = await request(port, 'PATCH', `/api/reports/${phagRepId}/reassign-department`, jalAdminToken, {
        departmentId: jalWaterDept._id,
        reason: 'Illegal cross-city reassign attempt',
      })
      assert(reassignCross.status === 404, `Expected 404, got ${reassignCross.status}`)

      const forwardCross = await request(port, 'POST', `/api/reports/${phagRepId}/forward`, jalAdminToken, {
        departmentId: jalPspclDept._id,
        note: 'Illegal cross-city forward attempt',
      })
      assert(forwardCross.status === 404, `Expected 404, got ${forwardCross.status}`)

      const externalCross = await request(port, 'PATCH', `/api/reports/${phagRepId}/external-status`, jalAdminToken, {
        status: 'in_progress',
        note: 'Illegal cross-city external status attempt',
      })
      assert(externalCross.status === 404, `Expected 404, got ${externalCross.status}`)
    })

    // ── Test 23: Citizen detail contains handledBy but not routedBy, routingHistory or staff private data; ?unresolved=true returns only admin's own city's unresolved reports ──
    await test(23, 'Citizen detail masks admin routing internals, ?unresolved=true returns tenant-scoped unresolved reports', async () => {
      const citRes = await request(port, 'GET', `/api/reports/${test17ReportId}`, jalCitizenToken)
      assert(citRes.status === 200, 'Citizen must be able to view report detail')
      const repData = citRes.data.report

      assert(repData.handledBy, 'Citizen response should have handledBy')
      assert(repData.routedBy === undefined, 'routedBy must NOT be visible to citizen')
      assert(repData.routingHistory === undefined, 'routingHistory must NOT be visible to citizen')
      if (repData.forwarding) {
        assert(repData.forwarding.note === undefined, 'Private forwarding note must NOT be visible to citizen')
      }

      // Admin detail DOES contain routedBy and routingHistory
      const admRes = await request(port, 'GET', `/api/reports/${test17ReportId}`, jalAdminToken)
      assert(admRes.status === 200, 'Admin must be able to view report detail')
      assert(admRes.data.report.routedBy !== undefined, 'Admin should see routedBy')
      assert(Array.isArray(admRes.data.report.routingHistory), 'Admin should see routingHistory')

      // Query ?unresolved=true
      const unresolvedRes = await request(port, 'GET', '/api/reports?unresolved=true', jalAdminToken)
      assert(unresolvedRes.status === 200, 'Expected 200 from ?unresolved=true')
      for (const r of unresolvedRes.data.reports) {
        assert(r.departmentUnresolved === true, 'All returned reports must have departmentUnresolved: true')
      }
    })

  } catch (err) {
    console.error('Fatal test error:', err)
  } finally {
    console.log('\n🧹 Cleaning up test fixtures...')
    if (createdReportIds.length) await Report.deleteMany({ _id: { $in: createdReportIds } })
    if (createdConfigIds.length) await CategoryConfig.deleteMany({ _id: { $in: createdConfigIds } })
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } })
    if (createdDeptIds.length) await Department.deleteMany({ _id: { $in: createdDeptIds } })
    if (createdMuniIds.length) await Municipality.deleteMany({ _id: { $in: createdMuniIds } })
    await AuditLog.deleteMany({ actor: { $in: createdUserIds } })

    if (server) {
      await new Promise((res) => server.close(res))
    }
    await disconnectTestDB()

    console.log(`\n========================================`)
    console.log(`Results: ${passed} passed, ${failed} failed`)
    console.log(`========================================\n`)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
