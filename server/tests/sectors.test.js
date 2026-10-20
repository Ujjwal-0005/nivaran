/**
 * tests/sectors.test.js
 *
 * Comprehensive tests for Prompt 1 (v2):
 * - Sector constants and validation (11 national sectors including ENFORCEMENT)
 * - Category sector enum and seeded categories
 * - Department sector fields, contact sub-document validation, and partial indexes
 * - 10 default municipal departments and their sectors/primaries
 * - Punjab agency catalog: external, unverified, empty contact, primary flags, idempotency
 * - Rejection of staff creation AND staff approval for external agency departments
 * - CategoryConfig model: unique per city+category, pre-save cross-municipality / inactive checks
 * - resolveDepartment service: overrides, primary, fallback, unresolved when no active dept, disabled categories, cross-tenant isolation
 * - Encroachment resolves to municipal_enforcement department
 * - ENFORCEMENT has at most one active primary per city
 * - Migration idempotency
 *
 * Uses the shared test database helper (testDb.js).
 * Cleans up all test fixtures in a finally block.
 */

import { connectTestDB, disconnectTestDB } from './helpers/testDb.js'
import { SECTORS, SECTOR_KEYS, isValidSector } from '../constants/sectors.js'
import Category from '../models/Category.js'
import Department from '../models/Department.js'
import Municipality from '../models/Municipality.js'
import User from '../models/User.js'
import CategoryConfig from '../models/CategoryConfig.js'
import { seedAgenciesForCity, createDefaultDepartments } from '../utils/departments.js'
import { resolveDepartment } from '../services/resolveDepartment.js'
import { runMigration } from '../scripts/migrateSectors.js'

const RUN_ID = Date.now()
let passed = 0
let failed = 0

const test = async (name, fn) => {
  try {
    await fn()
    passed++
    console.log(`  ✅ ${name}`)
  } catch (err) {
    failed++
    console.log(`  ❌ ${name}`)
    console.log(`     ${err.message}`)
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

async function run() {
  await connectTestDB()

  let testMuni1 = null
  let testMuni2 = null

  try {
    console.log('\n🧪 Step: Sectors, Agencies & Routing Tests\n')

    // Clean-slate
    await CategoryConfig.deleteMany({ municipality: { $in: [testMuni1?._id, testMuni2?._id].filter(Boolean) } })

    // Setup fixtures
    testMuni1 = await Municipality.create({
      name: `TestCityA_${RUN_ID}`,
      state: 'Punjab',
      type: 'corporation',
      lgdCode: `LGD_A_${RUN_ID}`,
      centroid: { lat: 31.326, lng: 75.576 },
    })

    testMuni2 = await Municipality.create({
      name: `TestCityB_${RUN_ID}`,
      state: 'Punjab',
      type: 'corporation',
      lgdCode: `LGD_B_${RUN_ID}`,
      centroid: { lat: 30.901, lng: 75.857 },
    })

    // 1. Sector constants
    await test('1. Sector constants export 11 valid keys and isValidSector behaves correctly', async () => {
      assert(SECTOR_KEYS.length === 11, `Expected 11 sector keys, got ${SECTOR_KEYS.length}`)
      assert(isValidSector('ROADS'), 'ROADS should be valid')
      assert(isValidSector('WATER'), 'WATER should be valid')
      assert(isValidSector('ELECTRICITY'), 'ELECTRICITY should be valid')
      assert(isValidSector('ENFORCEMENT'), 'ENFORCEMENT should be valid')
      assert(!isValidSector('INVALID_SECTOR'), 'INVALID_SECTOR should be invalid')
      assert(!isValidSector(null), 'null should be invalid')
      assert(SECTORS.ROADS.displayName === 'Roads & Footpaths', 'Incorrect display name')
      assert(SECTORS.ENFORCEMENT.displayName === 'Municipal Enforcement', 'Incorrect ENFORCEMENT display name')
    })

    // 2. Category sector enum
    await test('2. Every seeded category has a valid sector', async () => {
      const categories = await Category.find()
      assert(categories.length > 0, 'No categories found in database')
      for (const cat of categories) {
        assert(cat.sector, `Category ${cat.name} missing sector`)
        assert(isValidSector(cat.sector), `Category ${cat.name} has invalid sector: ${cat.sector}`)
      }
    })

    await test('2b. Category model rejects invalid sector', async () => {
      let threw = false
      try {
        await Category.create({
          name: `InvalidCat_${RUN_ID}`,
          departmentKey: 'roads',
          sector: 'NOT_A_SECTOR',
          severityWeight: 5,
          slaHours: 24,
        })
      } catch {
        threw = true
      }
      assert(threw, 'Category.create should have thrown on invalid sector')
    })

    // 3. Department model and default municipal departments
    await test('3. Default departments created for a city each have valid sectors and no two active primaries in same sector', async () => {
      const depts = await createDefaultDepartments(testMuni1._id, 'punjab')
      assert(depts.length === 10, `Expected 10 default departments, got ${depts.length}`)

      const municipalDepts = await Department.find({ municipality: testMuni1._id, isExternal: false })
      assert(municipalDepts.length === 10, `Expected 10 municipal depts, got ${municipalDepts.length}`)

      const primarySectors = new Set()
      for (const d of municipalDepts) {
        if (d.sector) {
          assert(isValidSector(d.sector), `Department ${d.name} has invalid sector: ${d.sector}`)
        }
        if (d.isPrimary && d.sector) {
          assert(!primarySectors.has(d.sector), `Duplicate primary sector: ${d.sector}`)
          primarySectors.add(d.sector)
        }
      }
    })

    // 4. Partial unique index on primary departments
    await test('4. A second active primary department for the same city and sector is rejected by database index', async () => {
      let threw = false
      try {
        await Department.create({
          name: `Duplicate Roads Primary ${RUN_ID}`,
          key: `dup_roads_${RUN_ID}`,
          municipality: testMuni1._id,
          sector: 'ROADS',
          isPrimary: true,
          isActive: true,
        })
      } catch {
        threw = true
      }
      assert(threw, 'Should have thrown duplicate key on second active primary department')
    })

    await test('4b. Two different cities can each have a primary department for the same sector', async () => {
      await createDefaultDepartments(testMuni2._id, 'punjab')
      const roadsMuni1 = await Department.findOne({ municipality: testMuni1._id, sector: 'ROADS', isPrimary: true })
      const roadsMuni2 = await Department.findOne({ municipality: testMuni2._id, sector: 'ROADS', isPrimary: true })

      assert(roadsMuni1, 'Muni1 primary roads dept missing')
      assert(roadsMuni2, 'Muni2 primary roads dept missing')
      assert(roadsMuni1.municipality.toString() !== roadsMuni2.municipality.toString(), 'Municipalities must differ')
    })

    await test('4c. ENFORCEMENT sector has at most one active primary per city', async () => {
      const enfDept = await Department.findOne({ municipality: testMuni1._id, sector: 'ENFORCEMENT', isPrimary: true })
      assert(enfDept, 'Expected primary ENFORCEMENT department in testMuni1')
      assert(enfDept.key === 'municipal_enforcement', 'Expected municipal_enforcement key')

      let threw = false
      try {
        await Department.create({
          name: `Second Enforcement Primary ${RUN_ID}`,
          key: `dup_enf_${RUN_ID}`,
          municipality: testMuni1._id,
          sector: 'ENFORCEMENT',
          isPrimary: true,
          isActive: true,
        })
      } catch {
        threw = true
      }
      assert(threw, 'Should reject second active primary for ENFORCEMENT in same municipality')
    })

    // 5. Contact validation on Department
    await test('5. Department contact email and website formats are validated', async () => {
      let threw = false
      try {
        await Department.create({
          name: `Bad Contact Dept ${RUN_ID}`,
          key: `bad_contact_${RUN_ID}`,
          municipality: testMuni1._id,
          contact: { email: 'not-an-email' },
        })
      } catch {
        threw = true
      }
      assert(threw, 'Should reject invalid contact email format')

      const goodDept = await Department.create({
        name: `Good Contact Dept ${RUN_ID}`,
        key: `good_contact_${RUN_ID}`,
        municipality: testMuni1._id,
        contact: {
          email: 'help@punjab.gov.in',
          website: 'https://punjab.gov.in',
          phone: '1800-180-1551',
        },
      })
      assert(goodDept.contact.email === 'help@punjab.gov.in', 'Contact email was not saved')
    })

    // 6. Punjab agencies catalog
    await test('6. A city gets 5 Punjab agencies; re-running seedAgenciesForCity adds 0 (idempotent)', async () => {
      const agenciesBefore = await Department.find({ municipality: testMuni1._id, isExternal: true })
      assert(agenciesBefore.length === 5, `Expected 5 external agencies, got ${agenciesBefore.length}`)

      const secondCall = await seedAgenciesForCity(testMuni1._id, 'punjab')
      assert(secondCall.length === 5, `Expected 5 agencies returned, got ${secondCall.length}`)

      const agenciesAfter = await Department.find({ municipality: testMuni1._id, isExternal: true })
      assert(agenciesAfter.length === 5, `Agencies count changed from 5 to ${agenciesAfter.length}`)

      const pspcl = await Department.findOne({ municipality: testMuni1._id, agencyCode: 'PSPCL' })
      const pwd = await Department.findOne({ municipality: testMuni1._id, agencyCode: 'PUNJAB-PWD-BR' })
      const police = await Department.findOne({ municipality: testMuni1._id, agencyCode: 'PUNJAB-POLICE-TRAFFIC' })
      const pwssbWater = await Department.findOne({ municipality: testMuni1._id, agencyCode: 'PWSSB-WATER' })

      assert(pspcl.isExternal === true, 'PSPCL must be external')
      assert(pspcl.verified === false, 'PSPCL must be unverified')
      assert(pspcl.isPrimary === true, 'PSPCL must be primary')
      assert(pspcl.sector === 'ELECTRICITY', 'PSPCL sector must be ELECTRICITY')
      assert(pspcl.notes && pspcl.notes.startsWith('_verify:'), 'PSPCL notes must start with _verify:')
      assert(!pspcl.contact?.phone, 'PSPCL contact must be empty')

      assert(pwd.isExternal === true, 'PWD must be external')
      assert(pwd.isPrimary === false, 'PWD must not be primary')
      assert(pwd.sector === 'ROADS', 'PWD sector must be ROADS')

      assert(police.isPrimary === true, 'Police must be primary')
      assert(police.sector === 'TRAFFIC_ENFORCEMENT', 'Police sector must be TRAFFIC_ENFORCEMENT')

      assert(pwssbWater.isPrimary === false, 'PWSSB Water must not be primary')
      assert(pwssbWater.sector === 'WATER', 'PWSSB Water sector must be WATER')
    })

    // 7. Staff cannot be assigned to or approved for an external agency
    await test('7. Model pre-save rejects creating staff for an external agency department', async () => {
      const pspcl = await Department.findOne({ municipality: testMuni1._id, agencyCode: 'PSPCL' })

      const staffUser = new User({
        name: `External Staff ${RUN_ID}`,
        email: `ext_staff_${RUN_ID}@example.com`,
        passwordHash: 'dummyhash',
        role: 'staff',
        municipality: testMuni1._id,
        department: pspcl._id,
        employeeId: `EMP_${RUN_ID}`,
      })

      let threw = false
      try {
        await staffUser.save()
      } catch (err) {
        threw = true
        assert(err.message.includes('external agency'), `Expected external agency error, got: ${err.message}`)
      }
      assert(threw, 'Should throw error when creating staff assigned to external agency')
    })

    await test('7b. Model pre-save rejects approving staff when assigned to an external agency department', async () => {
      const municipalRoads = await Department.findOne({ municipality: testMuni1._id, key: 'roads' })
      const pspcl = await Department.findOne({ municipality: testMuni1._id, agencyCode: 'PSPCL' })

      // Create a pending staff user with a municipal department
      const staffUser = await User.create({
        name: `Pending Staff ${RUN_ID}`,
        email: `pending_staff_${RUN_ID}@example.com`,
        passwordHash: 'dummyhash',
        role: 'staff',
        municipality: testMuni1._id,
        department: municipalRoads._id,
        applicationStatus: 'pending',
        employeeId: `EMP_PENDING_${RUN_ID}`,
      })

      // Attempt to change department to external pspcl and approve
      staffUser.department = pspcl._id
      staffUser.applicationStatus = 'approved'

      let threw = false
      try {
        await staffUser.save()
      } catch (err) {
        threw = true
        assert(err.message.includes('external agency'), `Expected external agency error, got: ${err.message}`)
      }
      assert(threw, 'Should throw error when approving staff assigned to external agency')
    })

    // 8. CategoryConfig model
    await test('8. CategoryConfig enforces uniqueness, cross-municipality check, and active status check', async () => {
      const cat = await Category.findOne({ sector: 'ROADS' })
      const roadsDeptMuni1 = await Department.findOne({ municipality: testMuni1._id, key: 'roads' })
      const roadsDeptMuni2 = await Department.findOne({ municipality: testMuni2._id, key: 'roads' })

      const config = await CategoryConfig.create({
        municipality: testMuni1._id,
        category: cat._id,
        routeToDepartment: roadsDeptMuni1._id,
        isEnabled: true,
        severityOverride: 8,
        slaHoursOverride: 36,
      })
      assert(config.severityOverride === 8, 'Severity override not saved')

      // Duplicate
      let threwDup = false
      try {
        await CategoryConfig.create({
          municipality: testMuni1._id,
          category: cat._id,
        })
      } catch {
        threwDup = true
      }
      assert(threwDup, 'Should reject duplicate CategoryConfig for same muni+category')

      // Cross-municipality routeToDepartment
      const otherCat = await Category.findOne({ sector: 'WATER' })
      let threwCross = false
      try {
        await CategoryConfig.create({
          municipality: testMuni1._id,
          category: otherCat._id,
          routeToDepartment: roadsDeptMuni2._id,
        })
      } catch (err) {
        threwCross = true
        assert(err.message.includes('different municipality'), err.message)
      }
      assert(threwCross, 'Should reject routeToDepartment from different municipality')

      // Inactive routeToDepartment
      const inactiveDept = await Department.create({
        name: `Inactive Dept ${RUN_ID}`,
        key: `inactive_${RUN_ID}`,
        municipality: testMuni1._id,
        isActive: false,
      })

      let threwInactive = false
      try {
        await CategoryConfig.create({
          municipality: testMuni1._id,
          category: otherCat._id,
          routeToDepartment: inactiveDept._id,
        })
      } catch (err) {
        threwInactive = true
        assert(err.message.includes('inactive'), err.message)
      }
      assert(threwInactive, 'Should reject inactive routeToDepartment')

      // Clean up CategoryConfig created in test 8 so test 9 starts fresh
      await CategoryConfig.deleteMany({ municipality: testMuni1._id })
    })

    // 9. resolveDepartment service
    await test('9. resolveDepartment routing order: category override -> sector primary -> fallback -> none', async () => {
      const electricityCat = await Category.findOne({ sector: 'ELECTRICITY' })
      const potholeCat = await Category.findOne({ name: 'Pothole' })

      // Electricity resolves to PSPCL (sector primary)
      const elecResolution = await resolveDepartment({
        municipalityId: testMuni1._id,
        categoryId: electricityCat._id,
      })
      assert(elecResolution.routedBy === 'sector_primary', `Expected sector_primary, got ${elecResolution.routedBy}`)
      assert(elecResolution.department.agencyCode === 'PSPCL', 'Expected PSPCL')
      assert(elecResolution.unresolved === false, 'Expected unresolved === false')

      // Pothole resolves to Municipal Roads wing (not PWD)
      const potholeResolution = await resolveDepartment({
        municipalityId: testMuni1._id,
        categoryId: potholeCat._id,
      })
      assert(potholeResolution.routedBy === 'sector_primary', `Expected sector_primary, got ${potholeResolution.routedBy}`)
      assert(potholeResolution.department.key === 'roads', 'Expected roads dept')
      assert(potholeResolution.department.isExternal === false, 'Expected municipal dept, not external')

      // Category override
      const customDept = await Department.create({
        name: `Express Road Repair ${RUN_ID}`,
        key: `express_road_${RUN_ID}`,
        municipality: testMuni1._id,
        sector: 'ROADS',
        isActive: true,
        isPrimary: false,
      })

      await CategoryConfig.findOneAndUpdate(
        { municipality: testMuni1._id, category: potholeCat._id },
        { $set: { routeToDepartment: customDept._id, isEnabled: true } },
        { upsert: true }
      )

      const overrideResolution = await resolveDepartment({
        municipalityId: testMuni1._id,
        categoryId: potholeCat._id,
      })
      assert(overrideResolution.routedBy === 'category_override', `Expected category_override, got ${overrideResolution.routedBy}`)
      assert(overrideResolution.department._id.toString() === customDept._id.toString(), 'Override did not route to customDept')

      // Disabled category
      await CategoryConfig.findOneAndUpdate(
        { municipality: testMuni1._id, category: potholeCat._id },
        { $set: { isEnabled: false } }
      )
      const disabledResolution = await resolveDepartment({
        municipalityId: testMuni1._id,
        categoryId: potholeCat._id,
      })
      assert(disabledResolution.disabled === true, 'Disabled category should return disabled: true')
      assert(disabledResolution.department === null, 'Disabled category department must be null')
      assert(disabledResolution.unresolved === false, 'Disabled category unresolved must be false')

      // Sector fallback when primary is inactive
      const municipalRoads = await Department.findOne({ municipality: testMuni1._id, key: 'roads' })
      municipalRoads.isActive = false
      await municipalRoads.save()

      await CategoryConfig.deleteOne({ municipality: testMuni1._id, category: potholeCat._id })

      const fallbackResolution = await resolveDepartment({
        municipalityId: testMuni1._id,
        categoryId: potholeCat._id,
      })
      assert(fallbackResolution.routedBy === 'sector_fallback', `Expected sector_fallback, got ${fallbackResolution.routedBy}`)
      assert(fallbackResolution.department.agencyCode === 'PUNJAB-PWD-BR', 'Expected PWD as fallback')

      // Tenant isolation: resolving for testMuni2 returns testMuni2 department
      const muni2Resolution = await resolveDepartment({
        municipalityId: testMuni2._id,
        categoryId: potholeCat._id,
      })
      assert(muni2Resolution.department.municipality.toString() === testMuni2._id.toString(), 'Cross-tenant leak detected')
    })

    await test('9b. Encroachment resolves to municipal_enforcement department', async () => {
      const encroachmentCat = await Category.findOne({ name: 'Encroachment' })
      assert(encroachmentCat, 'Encroachment category missing')
      assert(encroachmentCat.sector === 'ENFORCEMENT', `Expected ENFORCEMENT, got ${encroachmentCat.sector}`)

      const resolution = await resolveDepartment({
        municipalityId: testMuni1._id,
        categoryId: encroachmentCat._id,
      })
      assert(resolution.routedBy === 'sector_primary', `Expected sector_primary, got ${resolution.routedBy}`)
      assert(resolution.department.key === 'municipal_enforcement', `Expected municipal_enforcement, got ${resolution.department.key}`)
      assert(resolution.unresolved === false, 'Expected unresolved === false')
    })

    await test('9c. resolveDepartment when sector has no active department returns unresolved', async () => {
      // Create a temporary category with a sector whose departments are deactivated
      const testSectorCat = await Category.create({
        name: `TempSectorCat_${RUN_ID}`,
        departmentKey: 'animal_husbandry',
        sector: 'ANIMAL',
        severityWeight: 5,
        slaHours: 24,
      })

      // Deactivate all ANIMAL departments for testMuni1
      await Department.updateMany({ municipality: testMuni1._id, sector: 'ANIMAL' }, { $set: { isActive: false } })

      const resolution = await resolveDepartment({
        municipalityId: testMuni1._id,
        categoryId: testSectorCat._id,
      })

      assert(resolution.department === null, 'Department should be null when no active dept in sector')
      assert(resolution.routedBy === 'none', 'routedBy should be "none"')
      assert(resolution.unresolved === true, 'unresolved should be true')

      // Restore ANIMAL departments
      await Department.updateMany({ municipality: testMuni1._id, sector: 'ANIMAL' }, { $set: { isActive: true } })
    })

    // 10. Migration idempotency
    await test('10. Migration runs cleanly and second run makes 0 changes', async () => {
      const firstRun = await runMigration({ dryRun: false })
      assert(firstRun !== undefined, 'Migration first run returned undefined')

      const secondRun = await runMigration({ dryRun: false })
      assert(secondRun.categoriesUpdated === 0, `Expected 0 categories, got ${secondRun.categoriesUpdated}`)
      assert(secondRun.departmentsUpdated === 0, `Expected 0 departments, got ${secondRun.departmentsUpdated}`)
      assert(secondRun.agenciesAdded === 0, `Expected 0 agencies, got ${secondRun.agenciesAdded}`)
    })

  } finally {
    console.log('\n🧹 Cleaning up test fixtures…')
    if (testMuni1) {
      await CategoryConfig.deleteMany({ municipality: testMuni1._id })
      await Department.deleteMany({ municipality: testMuni1._id })
      await User.deleteMany({ municipality: testMuni1._id })
      await Municipality.findByIdAndDelete(testMuni1._id)
    }
    if (testMuni2) {
      await CategoryConfig.deleteMany({ municipality: testMuni2._id })
      await Department.deleteMany({ municipality: testMuni2._id })
      await User.deleteMany({ municipality: testMuni2._id })
      await Municipality.findByIdAndDelete(testMuni2._id)
    }
    await Category.deleteMany({ name: { $regex: new RegExp(RUN_ID.toString()) } })
    await User.deleteMany({ email: { $regex: new RegExp(RUN_ID.toString()) } })

    console.log(`\n──────────────────────────────────────────────────`)
    console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`)
    await disconnectTestDB()
  }

  if (failed > 0) {
    process.exit(1)
  }
}

run()
