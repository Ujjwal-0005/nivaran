/**
 * server/scripts/migrateSectors.js
 *
 * Migration script for sectors, agency catalogs, and department sector mappings.
 *
 * Features:
 * - Sets sector on existing Category documents.
 * - Sets sector, agencyType, isPrimary, and isExternal on existing default municipal departments.
 * - Seeds missing external agencies for all municipalities in the database.
 * - Distinguishes between brand-new agencies to add vs existing agency records to adopt.
 * - Never crashes on conflicting legacy documents: skips them, counts them, and prints a "conflicts" line.
 * - Supports --dry-run flag that accurately predicts what the real run would do.
 * - Idempotent: repeated runs result in 0 changes.
 * - Never prints connection strings or credentials.
 *
 * Run with: npm run migrate:sectors [-- --dry-run]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Category from '../models/Category.js'
import Department from '../models/Department.js'
import Municipality from '../models/Municipality.js'
import { DEPARTMENT_TEMPLATES } from '../utils/departments.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Mapping of category names to their designated sector
const CATEGORY_SECTOR_MAP = {
  'Pothole': 'ROADS',
  'Damaged footpath': 'ROADS',
  'Missing road signage': 'ROADS',
  'Water pipeline leak': 'WATER',
  'Low water pressure': 'WATER',
  'Open manhole': 'SEWERAGE',
  'Blocked drain': 'SEWERAGE',
  'Stagnant water': 'SEWERAGE',
  'Streetlight not working': 'STREET_LIGHTING',
  'Exposed electrical wires': 'ELECTRICITY',
  'Garbage overflow': 'SOLID_WASTE',
  'Illegal dumping': 'SOLID_WASTE',
  'Public toilet issue': 'SOLID_WASTE',
  'Fallen tree/branch': 'PARKS',
  'Damaged park equipment': 'PARKS',
  'Broken traffic signal': 'TRAFFIC_ENFORCEMENT',
  'Stray animal issue': 'ANIMAL',
  'Encroachment': 'ENFORCEMENT',
  'Noise pollution': 'ENFORCEMENT',
}

export async function runMigration({ dryRun = false } = {}) {
  const isDryRun = Boolean(dryRun)
  console.log(`=== Starting Sectors & Agencies Migration (dryRun: ${isDryRun}) ===`)

  let categoriesUpdated = 0
  let departmentsUpdated = 0
  let agenciesAdded = 0
  let agenciesAdopted = 0
  const conflicts = []

  // 1. Migrate Categories
  const categories = await Category.find()
  for (const cat of categories) {
    const targetSector = CATEGORY_SECTOR_MAP[cat.name] || (cat.name.toLowerCase().includes('road') ? 'ROADS' : null)
    if (targetSector && cat.sector !== targetSector) {
      categoriesUpdated++
      if (!isDryRun) {
        try {
          cat.sector = targetSector
          await cat.save()
        } catch (err) {
          conflicts.push({ id: cat._id.toString(), type: 'Category', reason: err.message })
        }
      }
    }
  }

  // 2. Sanitize any legacy non-string / ObjectId sector values in Department documents
  if (!isDryRun) {
    try {
      await Department.collection.updateMany(
        { sector: { $type: 'objectId' } },
        { $set: { sector: null } }
      )
    } catch (err) {
      conflicts.push({ id: 'legacy-sectors', type: 'DepartmentCollection', reason: err.message })
    }
  }

  // 3. Migrate Default Departments by stable key
  const templateMap = new Map()
  for (const tpl of DEPARTMENT_TEMPLATES) {
    templateMap.set(tpl.key, tpl)
  }

  const allDepts = await Department.find({ isExternal: { $ne: true } })
  for (const dept of allDepts) {
    const tpl = templateMap.get(dept.key)
    if (tpl) {
      let needsUpdate = false
      if (dept.sector !== tpl.sector) needsUpdate = true
      if (Boolean(dept.isPrimary) !== Boolean(tpl.isPrimary)) needsUpdate = true
      if (dept.agencyType !== (tpl.agencyType || 'municipal')) needsUpdate = true

      if (needsUpdate) {
        departmentsUpdated++
        if (!isDryRun) {
          try {
            dept.sector = tpl.sector
            dept.isPrimary = Boolean(tpl.isPrimary)
            dept.agencyType = tpl.agencyType || 'municipal'
            dept.isExternal = false
            await dept.save()
          } catch (err) {
            conflicts.push({ id: dept._id.toString(), type: 'Department', reason: err.message })
          }
        }
      }
    }
  }

  // 4. Seed / Adopt External Agencies per Municipality
  const municipalities = await Municipality.find()
  for (const muni of municipalities) {
    const stateKey = (muni.state || 'punjab').toString().toLowerCase().trim().replace(/\s+/g, '_')
    const catalogPath = path.join(__dirname, '..', 'seed-data', 'agencies', `${stateKey}.json`)
    if (!fs.existsSync(catalogPath)) continue

    const catalogRaw = fs.readFileSync(catalogPath, 'utf-8')
    const agencies = JSON.parse(catalogRaw)

    for (const agency of agencies) {
      // Check 1: Already exists with agencyCode
      const withCode = await Department.findOne({
        municipality: muni._id,
        agencyCode: agency.agencyCode,
      })

      if (withCode) {
        // Already fully configured with agencyCode
        continue
      }

      // Check 2: Exists as a legacy document without agencyCode (matched by key, name, or code)
      const legacyDoc = await Department.findOne({
        municipality: muni._id,
        $or: [
          { key: agency.key },
          { name: agency.name },
          { key: agency.agencyCode },
        ],
      })

      if (legacyDoc) {
        // Can be adopted
        agenciesAdopted++
        if (!isDryRun) {
          try {
            if (!legacyDoc.agencyCode) legacyDoc.agencyCode = agency.agencyCode
            if (legacyDoc.isExternal === undefined || legacyDoc.isExternal === false) legacyDoc.isExternal = true
            if (!legacyDoc.sector) legacyDoc.sector = agency.sector
            if (agency.isPrimary && !legacyDoc.isPrimary) legacyDoc.isPrimary = true
            await legacyDoc.save()
          } catch (err) {
            conflicts.push({ id: legacyDoc._id.toString(), type: 'DepartmentLegacyAgency', reason: err.message })
          }
        }
      } else {
        // Truly missing: brand-new agency to add
        agenciesAdded++
        if (!isDryRun) {
          try {
            await Department.create({
              name: agency.name,
              key: agency.key,
              agencyCode: agency.agencyCode,
              agencyType: agency.agencyType || 'state_dept',
              sector: agency.sector,
              isPrimary: Boolean(agency.isPrimary),
              isExternal: true,
              verified: false,
              notes: agency.notes || '',
              description: agency.description || '',
              municipality: muni._id,
              contact: {},
            })
          } catch (err) {
            conflicts.push({ id: `new-${agency.agencyCode}`, type: 'DepartmentCreateAgency', reason: err.message })
          }
        }
      }
    }
  }

  console.log(`Migration Summary:`)
  console.log(`  Categories to update: ${categoriesUpdated}`)
  console.log(`  Default departments to update: ${departmentsUpdated}`)
  console.log(`  Agencies to add: ${agenciesAdded}`)
  console.log(`  Agencies to adopt: ${agenciesAdopted}`)
  console.log(`  Conflicts: ${conflicts.length}${conflicts.length > 0 ? ' -> ' + JSON.stringify(conflicts) : ''}`)
  console.log(`=== Migration Finished ===`)

  return { categoriesUpdated, departmentsUpdated, agenciesAdded, agenciesAdopted, conflicts }
}

// If executed directly from command line
if (process.argv[1] && process.argv[1].endsWith('migrateSectors.js')) {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI
  if (!mongoUri) {
    console.error('No database URI configured.')
    process.exit(1)
  }

  const maskedDbName = mongoUri.split('?')[0].split('/').pop() || 'unknown'
  console.log(`[migrateSectors] Connecting to database: "${maskedDbName}"`)

  try {
    await mongoose.connect(mongoUri)
    await runMigration({ dryRun })
    await mongoose.disconnect()
    process.exit(0)
  } catch (err) {
    console.error('[migrateSectors] Error:', err.message)
    process.exit(1)
  }
}
