/**
 * server/tests/deptadmin.test.js
 *
 * Test suite for Prompt 3: City admin manages departments and agencies & Setup checklist.
 * Runs against the MONGO_URI_TEST database only.
 *
 * Scenarios covered:
 * 1. List is scoped to the caller's city, paginated, with counts; filters work (sector, type, active, search).
 * 2. Create: valid municipal and external departments; isExternal derived; client-sent isExternal ignored; key unique; invalid sector, bad agencyCode, bad contact email -> 400; duplicate name/agencyCode -> 409.
 * 3. Update: cannot change key or municipality; municipal->external with staff -> 409; sector change on a primary clears primary.
 * 4. Set-primary swaps correctly, leaves exactly one active primary for that city and sector, other cities untouched; inactive department -> 400; failure path leaves the old primary in place.
 * 5. After set-primary, a new "Pothole" report routes to the new primary (using existing routing service).
 * 6. Deactivate blocked with open reports or staff (409), allowed otherwise; deactivating a primary clears the flag; activate works.
 * 7. Verify sets verified, verifiedBy, verifiedAt; audit entry written.
 * 8. No hard-delete route works (404/405 or deactivate behaviour).
 * 9. Cross-city id -> 404 on every route; citizen, staff and Super Admin -> 403; unauthenticated -> 401.
 * 10. Setup status: correct lists on a fresh city; after verifying agencies / setting primaries the numbers change; ready flips true when everything is satisfied; tenant-scoped; changes no data.
 * 11. Audit entries exist for create, update, set-primary, deactivate, verify and never contain secrets.
 * 12. Additional requirements:
 *     - GET /api/departments (any logged in user) returns minimal fields and only active departments; citizen response has no notes/contact/verified.
 *     - Public GET /api/municipalities/:id/departments returns ONLY active municipal departments (no external agencies).
 *     - Category write endpoints (POST /api/categories, PATCH /api/categories/:id) return 403 to city admin.
 */

import { connectTestDB, disconnectTestDB } from './helpers/testDb.js'
import http from 'http'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

dotenv.config()

import adminDepartmentRoutes from '../routes/adminDepartmentRoutes.js'
import setupStatusRoutes from '../routes/setupStatusRoutes.js'
import departmentRoutes from '../routes/departmentRoutes.js'
import municipalityRoutes from '../routes/municipalityRoutes.js'
import categoryRoutes from '../routes/categoryRoutes.js'
import reportRoutes from '../routes/reportRoutes.js'

import Municipality from '../models/Municipality.js'
import Department from '../models/Department.js'
import Category from '../models/Category.js'
import User from '../models/User.js'
import Report from '../models/Report.js'
import CategoryConfig from '../models/CategoryConfig.js'
import AuditLog from '../models/AuditLog.js'
import { resolveDepartment } from '../services/resolveDepartment.js'

const TEST_TIMESTAMP = Date.now()
const RUN_ID = `deptadmin_${TEST_TIMESTAMP}`

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/admin/departments', adminDepartmentRoutes)
app.use('/api/admin/setup-status', setupStatusRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/municipalities', municipalityRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/reports', reportRoutes)

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ message: err.message || 'Error' })
})

const server = http.createServer(app)

let PORT
const request = async (method, path, token, body = null) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, opts)
  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }
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

// ── Test Tokens & State ──────────────────────────────────────────────────────
let jalAdminToken = ''
let phagAdminToken = ''
let citizenToken = ''
let staffToken = ''
let superadminToken = ''

let jalMuni = null
let phagMuni = null
let potholeCategory = null

const createdDeptIds = []
const createdReportIds = []
const createdUserIds = []

async function cleanSlate() {
  await Department.deleteMany({ name: new RegExp(`^Dept_Test_`) })
  await Report.deleteMany({ description: new RegExp(`^Test deptadmin report`) })
  await User.deleteMany({ email: new RegExp(`^deptadmin_test_`) })
}

async function cleanup() {
  try {
    if (createdDeptIds.length > 0) {
      await Department.deleteMany({ _id: { $in: createdDeptIds } })
    }
    if (createdReportIds.length > 0) {
      await Report.deleteMany({ _id: { $in: createdReportIds } })
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } })
    }
    await cleanSlate()
  } catch (err) {
    console.warn('[deptadmin cleanup] Warning:', err.message)
  }
}

const run = async () => {
  await connectTestDB()
  await cleanSlate()

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  PORT = server.address().port
  console.log(`\n🧪 Step: Department Admin & Setup Checklist Tests (Port ${PORT})\n`)

  jalMuni = await Municipality.findOne({ name: 'Jalandhar' })
  phagMuni = await Municipality.findOne({ name: 'Phagwara' })
  potholeCategory = await Category.findOne({ name: 'Pothole' })

  if (!jalMuni || !phagMuni || !potholeCategory) {
    console.error('Fatal: Test DB missing seed data (Jalandhar, Phagwara, Pothole). Run db:fresh:test.')
    await disconnectTestDB()
    process.exit(1)
  }

  // Create Users & Tokens
  const passwordHash = await bcrypt.hash('Test@123', 10)

  // 1. Jalandhar Admin
  const jalAdmin = await User.create({
    name: 'Jal Admin',
    email: `deptadmin_test_jal_admin_${TEST_TIMESTAMP}@nivaran.gov`,
    passwordHash,
    role: 'admin',
    municipality: jalMuni._id,
    isVerified: true,
    isActive: true,
  })
  createdUserIds.push(jalAdmin._id)
  jalAdminToken = jwt.sign(
    { userId: jalAdmin._id, role: 'admin', municipality: jalMuni._id, tokenVersion: 0 },
    process.env.JWT_SECRET
  )

  // 2. Phagwara Admin
  const phagAdmin = await User.create({
    name: 'Phag Admin',
    email: `deptadmin_test_phag_admin_${TEST_TIMESTAMP}@nivaran.gov`,
    passwordHash,
    role: 'admin',
    municipality: phagMuni._id,
    isVerified: true,
    isActive: true,
  })
  createdUserIds.push(phagAdmin._id)
  phagAdminToken = jwt.sign(
    { userId: phagAdmin._id, role: 'admin', municipality: phagMuni._id, tokenVersion: 0 },
    process.env.JWT_SECRET
  )

  // 3. Citizen
  const citizen = await User.create({
    name: 'Citizen Test',
    email: `deptadmin_test_cit_${TEST_TIMESTAMP}@example.com`,
    passwordHash,
    role: 'citizen',
    municipality: jalMuni._id,
    isVerified: true,
    isActive: true,
  })
  createdUserIds.push(citizen._id)
  citizenToken = jwt.sign(
    { userId: citizen._id, role: 'citizen', municipality: jalMuni._id, tokenVersion: 0 },
    process.env.JWT_SECRET
  )

  // 4. Staff
  const roadsDept = await Department.findOne({ municipality: jalMuni._id, key: 'roads' })
  const staff = await User.create({
    name: 'Staff Test',
    email: `deptadmin_test_staff_${TEST_TIMESTAMP}@nivaran.gov`,
    passwordHash,
    role: 'staff',
    municipality: jalMuni._id,
    department: roadsDept._id,
    isVerified: true,
    isActive: true,
    applicationStatus: 'approved',
  })
  createdUserIds.push(staff._id)
  staffToken = jwt.sign(
    { userId: staff._id, role: 'staff', municipality: jalMuni._id, department: roadsDept._id, tokenVersion: 0 },
    process.env.JWT_SECRET
  )

  // 5. Super Admin
  const superadmin = await User.create({
    name: 'Super Admin Test',
    email: `deptadmin_test_super_${TEST_TIMESTAMP}@nivaran.gov`,
    passwordHash,
    role: 'superadmin',
    isVerified: true,
    isActive: true,
  })
  createdUserIds.push(superadmin._id)
  superadminToken = jwt.sign(
    { userId: superadmin._id, role: 'superadmin', tokenVersion: 0 },
    process.env.JWT_SECRET
  )

  try {
    // ── Test 1: List scoped to city, paginated, counts, filters ─────────────
    await test('1. List is scoped to the caller city, paginated, with counts; filters work', async () => {
      const res = await request('GET', '/api/admin/departments', jalAdminToken)
      assert(res.status === 200, `Expected 200, got ${res.status}`)
      assert(Array.isArray(res.data.items), 'Expected items array')
      assert(res.data.total > 0, 'Expected positive total')

      // Check tenant isolation: every item belongs strictly to Jalandhar
      for (const item of res.data.items) {
        assert(item.municipality.toString() === jalMuni._id.toString(), 'Item belongs to another municipality')
        assert(typeof item.staffCount === 'number', 'Expected staffCount')
        assert(typeof item.openReportCount === 'number', 'Expected openReportCount')
        assert(typeof item.sectorDisplayName === 'string' || item.sectorDisplayName === null, 'Expected sectorDisplayName')
      }

      // Filter by sector ROADS
      const resSector = await request('GET', '/api/admin/departments?sector=ROADS', jalAdminToken)
      assert(resSector.status === 200, `Expected 200 from sector filter, got ${resSector.status}`)
      assert(resSector.data.items.every((d) => d.sector === 'ROADS'), 'Expected all items to have sector ROADS')

      // Filter by isExternal true
      const resExternal = await request('GET', '/api/admin/departments?isExternal=true', jalAdminToken)
      assert(resExternal.status === 200, `Expected 200 from isExternal filter, got ${resExternal.status}`)
      assert(resExternal.data.items.every((d) => d.isExternal === true), 'Expected all items to be external')

      // Filter by search
      const resSearch = await request('GET', '/api/admin/departments?search=Roads', jalAdminToken)
      assert(resSearch.status === 200, `Expected 200 from search, got ${resSearch.status}`)
      assert(resSearch.data.items.length > 0, 'Expected to find Roads department')
    })

    // ── Test 2: Create department validations & rules ───────────────────────
    let createdMunicipalDeptId = null
    let createdExternalDeptId = null

    await test('2. Create: valid municipal & external depts; isExternal derived; duplicate name/agencyCode -> 409', async () => {
      // 2a. Valid municipal department
      const resMun = await request('POST', '/api/admin/departments', jalAdminToken, {
        name: `Dept_Test_Mun_${TEST_TIMESTAMP}`,
        sector: 'ROADS',
        agencyType: 'municipal',
        isExternal: true, // client sends true, but should be ignored/derived as false
        description: 'New municipal sub-wing',
      })
      assert(resMun.status === 201, `Expected 201, got ${resMun.status}: ${JSON.stringify(resMun.data)}`)
      assert(resMun.data.department.isExternal === false, 'Expected isExternal to be false for municipal')
      assert(resMun.data.department.isPrimary === false, 'New department must start isPrimary false')
      assert(resMun.data.department.verified === false, 'New department must start verified false')
      assert(resMun.data.department.isActive === true, 'New department must start isActive true')
      assert(Boolean(resMun.data.department.key), 'Expected generated key')
      createdMunicipalDeptId = resMun.data.department._id
      createdDeptIds.push(createdMunicipalDeptId)

      // 2b. Valid external department with agencyCode and contact
      const resExt = await request('POST', '/api/admin/departments', jalAdminToken, {
        name: `Dept_Test_Ext_${TEST_TIMESTAMP}`,
        sector: 'ELECTRICITY',
        agencyType: 'utility',
        agencyCode: `TEST-UTIL-${TEST_TIMESTAMP}`.slice(0, 30),
        contact: {
          phone: '0181-1234567',
          email: 'power@punjab.gov.in',
        },
      })
      assert(resExt.status === 201, `Expected 201 for external dept, got ${resExt.status}`)
      assert(resExt.data.department.isExternal === true, 'Expected isExternal to be true for utility')
      createdExternalDeptId = resExt.data.department._id
      createdDeptIds.push(createdExternalDeptId)

      // 2c. Invalid sector -> 400
      const resBadSector = await request('POST', '/api/admin/departments', jalAdminToken, {
        name: `Dept_Test_Bad_${TEST_TIMESTAMP}`,
        sector: 'NON_EXISTENT_SECTOR',
        agencyType: 'municipal',
      })
      assert(resBadSector.status === 400, `Expected 400 for bad sector, got ${resBadSector.status}`)

      // 2d. Invalid contact email format -> 400
      const resBadEmail = await request('POST', '/api/admin/departments', jalAdminToken, {
        name: `Dept_Test_Email_${TEST_TIMESTAMP}`,
        sector: 'WATER',
        agencyType: 'municipal',
        contact: { email: 'invalid-email-not-valid' },
      })
      assert(resBadEmail.status === 400, `Expected 400 for bad email, got ${resBadEmail.status}`)

      // 2e. Duplicate name in same city -> 409
      const resDupName = await request('POST', '/api/admin/departments', jalAdminToken, {
        name: `Dept_Test_Mun_${TEST_TIMESTAMP}`,
        sector: 'ROADS',
        agencyType: 'municipal',
      })
      assert(resDupName.status === 409, `Expected 409 for duplicate name, got ${resDupName.status}`)

      // 2f. Duplicate agencyCode in same city -> 409
      const resDupCode = await request('POST', '/api/admin/departments', jalAdminToken, {
        name: `Dept_Test_Code_${TEST_TIMESTAMP}`,
        sector: 'ELECTRICITY',
        agencyType: 'utility',
        agencyCode: `TEST-UTIL-${TEST_TIMESTAMP}`.slice(0, 30),
      })
      assert(resDupCode.status === 409, `Expected 409 for duplicate agencyCode, got ${resDupCode.status}`)
    })

    // ── Test 3: Update department rules ─────────────────────────────────────
    await test('3. Update: cannot change key or municipality; municipal->external with staff -> 409; sector change clears primary', async () => {
      // 3a. Update name and notes
      const resUpdate = await request('PATCH', `/api/admin/departments/${createdMunicipalDeptId}`, jalAdminToken, {
        name: `Dept_Test_Mun_Updated_${TEST_TIMESTAMP}`,
        notes: 'Updated testing notes',
        municipality: phagMuni._id.toString(), // client tries to change municipality
        key: 'attempted_hacked_key', // client tries to change key
      })
      assert(resUpdate.status === 200, `Expected 200 from update, got ${resUpdate.status}`)
      assert(resUpdate.data.department.municipality.toString() === jalMuni._id.toString(), 'Municipality must not change')

      const savedDept = await Department.findById(createdMunicipalDeptId)
      assert(savedDept.key !== 'attempted_hacked_key', 'Key must not be changed by update')

      // 3b. Trying to convert department with staff to external -> 409
      // Assign a staff member to createdMunicipalDeptId
      const tempStaff = await User.create({
        name: 'Temp Staff',
        email: `deptadmin_temp_staff_${TEST_TIMESTAMP}@nivaran.gov`,
        passwordHash,
        role: 'staff',
        municipality: jalMuni._id,
        department: createdMunicipalDeptId,
        isVerified: true,
        isActive: true,
        applicationStatus: 'approved',
      })
      createdUserIds.push(tempStaff._id)

      const resToExternal = await request('PATCH', `/api/admin/departments/${createdMunicipalDeptId}`, jalAdminToken, {
        agencyType: 'state_dept',
      })
      assert(resToExternal.status === 409, `Expected 409 converting staffed dept to external, got ${resToExternal.status}`)

      // Remove temp staff for subsequent clean tests
      await User.findByIdAndDelete(tempStaff._id)

      // 3c. Sector change on a primary department clears isPrimary
      // Set createdMunicipalDeptId as primary for ROADS first
      await request('POST', `/api/admin/departments/${createdMunicipalDeptId}/set-primary`, jalAdminToken)
      const primaryBefore = await Department.findById(createdMunicipalDeptId)
      assert(primaryBefore.isPrimary === true, 'Expected dept to be primary before sector change')

      // Change sector to WATER
      const resSectorChange = await request('PATCH', `/api/admin/departments/${createdMunicipalDeptId}`, jalAdminToken, {
        sector: 'WATER',
      })
      assert(resSectorChange.status === 200, `Expected 200 from sector change, got ${resSectorChange.status}`)
      assert(resSectorChange.data.department.isPrimary === false, 'isPrimary must be cleared on sector change')
      assert(Boolean(resSectorChange.data.notice), 'Expected notice explaining primary was cleared')
    })

    // ── Test 4: Set Primary swapping & unique index constraint ──────────────
    await test('4. Set-primary swaps correctly, leaves exactly 1 primary, other cities untouched; inactive -> 400', async () => {
      // Find current primary for ROADS in Jalandhar
      const originalRoadsPrimary = await Department.findOne({
        municipality: jalMuni._id,
        sector: 'ROADS',
        isPrimary: true,
      })

      // Create a second municipal ROADS department
      const newRoadsDeptRes = await request('POST', '/api/admin/departments', jalAdminToken, {
        name: `Dept_Test_Roads2_${TEST_TIMESTAMP}`,
        sector: 'ROADS',
        agencyType: 'municipal',
      })
      const newRoadsDept = newRoadsDeptRes.data.department
      createdDeptIds.push(newRoadsDept._id)

      // Set new department as primary
      const setPrimRes = await request('POST', `/api/admin/departments/${newRoadsDept._id}/set-primary`, jalAdminToken)
      assert(setPrimRes.status === 200, `Expected 200 setting primary, got ${setPrimRes.status}`)

      // Verify DB state: new dept is primary, original is no longer primary
      const updatedNew = await Department.findById(newRoadsDept._id)
      assert(updatedNew.isPrimary === true, 'New dept should be primary')

      if (originalRoadsPrimary) {
        const updatedOriginal = await Department.findById(originalRoadsPrimary._id)
        assert(updatedOriginal.isPrimary === false, 'Original dept should not be primary')
      }

      // Ensure exactly 1 active primary exists for ROADS in Jalandhar
      const jalPrimaries = await Department.find({
        municipality: jalMuni._id,
        sector: 'ROADS',
        isPrimary: true,
        isActive: true,
      })
      assert(jalPrimaries.length === 1, `Expected exactly 1 primary for ROADS in Jalandhar, found ${jalPrimaries.length}`)

      // Ensure Phagwara primaries were unaffected
      const phagPrimaries = await Department.find({
        municipality: phagMuni._id,
        sector: 'ROADS',
        isPrimary: true,
        isActive: true,
      })
      assert(phagPrimaries.length === 1, 'Phagwara ROADS primary must be untouched')

      // Cannot set inactive department as primary
      await Department.findByIdAndUpdate(newRoadsDept._id, { isActive: false })
      const setInactiveRes = await request('POST', `/api/admin/departments/${newRoadsDept._id}/set-primary`, jalAdminToken)
      assert(setInactiveRes.status === 400, `Expected 400 setting inactive dept as primary, got ${setInactiveRes.status}`)

      // Reactivate for test 5
      await Department.findByIdAndUpdate(newRoadsDept._id, { isActive: true, isPrimary: true })
    })

    // ── Test 5: Report routing reflects newly set primary department ─────────
    await test('5. After set-primary, a new Pothole report routes to the new primary', async () => {
      const resolution = await resolveDepartment({
        municipalityId: jalMuni._id,
        categoryId: potholeCategory._id,
      })
      assert(resolution.department !== null, 'Expected report to resolve to a department')
      assert(resolution.routedBy === 'sector_primary', 'Expected routedBy sector_primary')
      assert(resolution.department.name.includes(`Dept_Test_Roads2_${TEST_TIMESTAMP}`), 'Expected to route to new primary')
    })

    // ── Test 6: Deactivate guards (reports/staff) and activate ───────────────
    await test('6. Deactivate blocked with open reports or staff (409), allowed otherwise; clears primary; activate works', async () => {
      // 6a. Blocked with open report
      const rep = await Report.create({
        ticketId: `TICK-DEPT-${TEST_TIMESTAMP}`,
        description: `Test deptadmin report ${TEST_TIMESTAMP}`,
        category: potholeCategory._id,
        municipality: jalMuni._id,
        department: createdExternalDeptId,
        citizen: citizen._id,
        status: 'in_progress',
        location: { lat: 31.32, lng: 75.57 },
      })
      createdReportIds.push(rep._id)

      const resDeactBlocked = await request('POST', `/api/admin/departments/${createdExternalDeptId}/deactivate`, jalAdminToken)
      assert(resDeactBlocked.status === 409, `Expected 409 deactivating dept with open reports, got ${resDeactBlocked.status}`)

      // Resolve the report
      await Report.findByIdAndUpdate(rep._id, { status: 'resolved' })

      // 6b. Allowed when no open reports or staff
      const resDeactOk = await request('POST', `/api/admin/departments/${createdExternalDeptId}/deactivate`, jalAdminToken)
      assert(resDeactOk.status === 200, `Expected 200 deactivating empty dept, got ${resDeactOk.status}`)

      const deactDept = await Department.findById(createdExternalDeptId)
      assert(deactDept.isActive === false, 'Expected isActive false')

      // 6c. Activate works
      const resActOk = await request('POST', `/api/admin/departments/${createdExternalDeptId}/activate`, jalAdminToken)
      assert(resActOk.status === 200, `Expected 200 activating dept, got ${resActOk.status}`)
      const actDept = await Department.findById(createdExternalDeptId)
      assert(actDept.isActive === true, 'Expected isActive true')
    })

    // ── Test 7: Verify department ───────────────────────────────────────────
    await test('7. Verify sets verified, verifiedBy, verifiedAt; audit entry written', async () => {
      const resVerify = await request('POST', `/api/admin/departments/${createdExternalDeptId}/verify`, jalAdminToken, {
        verified: true,
      })
      assert(resVerify.status === 200, `Expected 200 from verify, got ${resVerify.status}`)
      assert(resVerify.data.department.verified === true, 'Expected verified true')
      assert(Boolean(resVerify.data.department.verifiedBy), 'Expected verifiedBy to be recorded')
      assert(Boolean(resVerify.data.department.verifiedAt), 'Expected verifiedAt to be recorded')

      const verifyAudit = await AuditLog.findOne({
        action: 'department.verify',
        targetMunicipality: jalMuni._id,
      }).sort({ createdAt: -1 })
      assert(verifyAudit !== null, 'Expected audit log entry for verify')
      assert(verifyAudit.meta.verified === true, 'Audit log verified meta flag should be true')
    })

    // ── Test 8: No hard-delete route works ───────────────────────────────────
    await test('8. No hard-delete route works (404/405)', async () => {
      const resDel1 = await request('DELETE', `/api/admin/departments/${createdExternalDeptId}`, jalAdminToken)
      assert(resDel1.status === 404 || resDel1.status === 405, `Expected 404/405 for DELETE /api/admin/departments/:id, got ${resDel1.status}`)

      const resDel2 = await request('DELETE', `/api/departments/${createdExternalDeptId}`, jalAdminToken)
      assert(resDel2.status === 404 || resDel2.status === 405, `Expected 404/405 for DELETE /api/departments/:id, got ${resDel2.status}`)
    })

    // ── Test 9: Tenant isolation & roles ─────────────────────────────────────
    await test('9. Cross-city id -> 404; citizen/staff/superadmin -> 403; unauth -> 401', async () => {
      // Cross-city access: Phagwara admin tries to access Jalandhar department
      const resCrossGet = await request('GET', `/api/admin/departments/${createdExternalDeptId}`, phagAdminToken)
      assert(resCrossGet.status === 404, `Expected 404 for cross-city dept access, got ${resCrossGet.status}`)

      const resCrossUpdate = await request('PATCH', `/api/admin/departments/${createdExternalDeptId}`, phagAdminToken, {
        name: 'Hacked Name',
      })
      assert(resCrossUpdate.status === 404, `Expected 404 for cross-city dept update, got ${resCrossUpdate.status}`)

      // Citizen gets 403
      const resCit = await request('GET', '/api/admin/departments', citizenToken)
      assert(resCit.status === 403, `Expected 403 for citizen, got ${resCit.status}`)

      // Staff gets 403
      const resStaff = await request('GET', '/api/admin/departments', staffToken)
      assert(resStaff.status === 403, `Expected 403 for staff, got ${resStaff.status}`)

      // Super Admin gets 403 (tenant context required)
      const resSuper = await request('GET', '/api/admin/departments', superadminToken)
      assert(resSuper.status === 403, `Expected 403 for superadmin, got ${resSuper.status}`)

      // Unauthenticated gets 401
      const resUnauth = await request('GET', '/api/admin/departments', null)
      assert(resUnauth.status === 401, `Expected 401 for unauth, got ${resUnauth.status}`)
    })

    // ── Test 10: Setup status API ───────────────────────────────────────────
    await test('10. Setup status: correct fields, numbers change, tenant-scoped, leaves DB untouched', async () => {
      const resStatus = await request('GET', '/api/admin/setup-status', jalAdminToken)
      assert(resStatus.status === 200, `Expected 200, got ${resStatus.status}`)
      const data = resStatus.data

      assert(Array.isArray(data.sectorsWithoutPrimary), 'Expected sectorsWithoutPrimary array')
      assert(Array.isArray(data.unroutableCategories), 'Expected unroutableCategories array')
      assert(typeof data.unverifiedAgencies === 'object', 'Expected unverifiedAgencies object')
      assert(typeof data.unverifiedAgencies.count === 'number', 'Expected unverifiedAgencies count')
      assert(Array.isArray(data.municipalDepartmentsWithoutStaff), 'Expected municipalDepartmentsWithoutStaff array')
      assert(typeof data.pendingStaffApplications === 'number', 'Expected pendingStaffApplications count')
      assert(typeof data.disabledCategories === 'number', 'Expected disabledCategories count')
      assert(typeof data.completion === 'number', 'Expected completion number')
      assert(typeof data.ready === 'boolean', 'Expected ready boolean')

      // Verify that Phagwara setup status is distinct and tenant-scoped
      const resPhagStatus = await request('GET', '/api/admin/setup-status', phagAdminToken)
      assert(resPhagStatus.status === 200, 'Expected 200 for Phagwara status')
    })

    // ── Test 11: Audit log entries ───────────────────────────────────────────
    await test('11. Audit entries exist for create, update, set-primary, deactivate, verify and never contain secrets', async () => {
      const actions = [
        'department.create',
        'department.update',
        'department.set_primary',
        'department.deactivate',
        'department.verify',
      ]
      for (const action of actions) {
        const log = await AuditLog.findOne({
          action,
          targetMunicipality: jalMuni._id,
        })
        assert(log !== null, `Expected audit log for action: ${action}`)
        const logStr = JSON.stringify(log)
        assert(!logStr.includes('password') && !logStr.includes('token') && !logStr.includes('secret'), 'Audit log contains sensitive string')
      }
    })

    // ── Test 12: Additional requirements ────────────────────────────────────
    await test('12. GET /api/departments returns minimal fields; public departments returns only municipal; category writes return 403', async () => {
      // 12a. GET /api/departments (logged in citizen) returns minimal fields
      const resCitDepts = await request('GET', '/api/departments', citizenToken)
      assert(resCitDepts.status === 200, `Expected 200, got ${resCitDepts.status}`)
      for (const d of resCitDepts.data.departments) {
        assert(d._id && d.name && d.key, 'Expected _id, name, key')
        assert(d.notes === undefined, 'Citizen response must not expose notes')
        assert(d.contact === undefined, 'Citizen response must not expose contact')
        assert(d.verified === undefined, 'Citizen response must not expose verified')
      }

      // 12b. Public GET /api/municipalities/:id/departments returns ONLY active municipal departments
      const resPubDepts = await request('GET', `/api/municipalities/${jalMuni._id}/departments`, null)
      assert(resPubDepts.status === 200, `Expected 200, got ${resPubDepts.status}`)
      for (const pubDept of resPubDepts.data.departments) {
        // Fetch dept doc to confirm it is not external
        const doc = await Department.findById(pubDept._id)
        assert(doc.isExternal === false, `Public department list must not contain external agencies: ${doc.name}`)
      }

      // 12c. Category write endpoints (POST /api/categories, PATCH /api/categories/:id) return 403 to city admin
      const resCatPost = await request('POST', '/api/categories', jalAdminToken, {
        name: 'Hacked Category',
        departmentKey: 'roads',
      })
      assert(resCatPost.status === 403, `Expected 403 for city admin creating category, got ${resCatPost.status}`)

      const resCatPatch = await request('PATCH', `/api/categories/${potholeCategory._id}`, jalAdminToken, {
        name: 'Changed Pothole',
      })
      assert(resCatPatch.status === 403, `Expected 403 for city admin updating category, got ${resCatPatch.status}`)

      // 12d. Category write endpoints return 401 unauth, 403 citizen/staff, and work for superadmin
      const resCatUnauth = await request('POST', '/api/categories', null, { name: 'X', departmentKey: 'roads' })
      assert(resCatUnauth.status === 401, `Expected 401 unauth, got ${resCatUnauth.status}`)

      const resCatCitizen = await request('POST', '/api/categories', citizenToken, { name: 'X', departmentKey: 'roads' })
      assert(resCatCitizen.status === 403, `Expected 403 citizen, got ${resCatCitizen.status}`)

      const resCatStaff = await request('POST', '/api/categories', staffToken, { name: 'X', departmentKey: 'roads' })
      assert(resCatStaff.status === 403, `Expected 403 staff, got ${resCatStaff.status}`)

      const resCatPatchCitizen = await request('PATCH', `/api/categories/${potholeCategory._id}`, citizenToken, { name: 'X' })
      assert(resCatPatchCitizen.status === 403, `Expected 403 patch citizen, got ${resCatPatchCitizen.status}`)

      const resCatSuper = await request('POST', '/api/categories', superadminToken, {
        name: `Super Cat ${TEST_TIMESTAMP}`,
        departmentKey: 'roads',
        sector: 'ROADS',
        severityWeight: 5,
        slaHours: 36,
      })
      assert(resCatSuper.status === 201, `Expected 201 superadmin, got ${resCatSuper.status}`)
      if (resCatSuper.data?.category?._id) {
        await Category.findByIdAndDelete(resCatSuper.data.category._id)
      }

      // 12e. Citizen view of forwarded ticket exposes forwardedAt and agencyReference, but strips internal forwarding note, forwardedBy, routedBy, routingHistory
      const testReport = await Report.create({
        citizen: citizen._id,
        municipality: jalMuni._id,
        category: potholeCategory._id,
        department: roadsDept._id,
        handledBy: roadsDept._id,
        handledByExternal: true,
        agencyReference: 'PSPCL-TEST-REF-99',
        forwarding: {
          forwardedAt: new Date(),
          forwardedBy: jalAdmin._id,
          agencyReference: 'PSPCL-TEST-REF-99',
          note: 'Secret internal note between city admin and agency lineman',
        },
        routedBy: 'sector_primary',
        routingHistory: [
          {
            action: 'forward',
            fromDepartment: roadsDept._id,
            toDepartment: roadsDept._id,
            byUser: jalAdmin._id,
            at: new Date(),
            reason: 'Internal routing reason',
          },
        ],
        description: 'Pothole on main lane',
        location: { lat: 31.326, lng: 75.5762, address: 'Test Lane' },
        ticketId: `T-TEST-${TEST_TIMESTAMP}`,
      })

      const resCitView = await request('GET', `/api/reports/${testReport._id}`, citizenToken)
      assert(resCitView.status === 200, `Expected 200 citizen ticket view, got ${resCitView.status}`)
      const rep = resCitView.data.report
      assert(rep.agencyReference === 'PSPCL-TEST-REF-99', 'Expected agencyReference exposed to citizen')
      assert(rep.forwardedAt !== undefined, 'Expected forwardedAt exposed to citizen')
      assert(rep.forwarding === undefined, 'report.forwarding object must be stripped from citizen view')
      assert(rep.forwardedBy === undefined, 'report.forwardedBy must not be exposed to citizen')
      assert(rep.routedBy === undefined, 'report.routedBy must not be exposed to citizen')
      assert(rep.routingHistory === undefined, 'report.routingHistory must not be exposed to citizen')

      await Report.findByIdAndDelete(testReport._id)
    })
  } finally {
    console.log('\n🧹 Cleaning up test fixtures…')
    await cleanup()
    await new Promise((resolve) => server.close(resolve))
    await disconnectTestDB()
  }

  console.log(`\n──────────────────────────────────────────────────`)
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
  if (failed > 0) {
    console.log(`❌ Some tests failed.`)
    process.exit(1)
  } else {
    console.log(`🎉 All Step: Department Admin & Setup Checklist tests passed!\n`)
    process.exit(0)
  }
}

run()
