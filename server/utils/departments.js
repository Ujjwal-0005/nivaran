import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Department from '../models/Department.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 10 standard municipal department templates shared across all municipalities.
 * Each has an appropriate sector and isPrimary: true where it is clearly that
 * sector's municipal wing.
 * Note: ELECTRICITY and TRAFFIC_ENFORCEMENT are not municipal departments.
 * Note: 'municipal_enforcement' does not have a primary municipal sector wing.
 */
export const DEPARTMENT_TEMPLATES = [
  {
    name: 'Roads',
    key: 'roads',
    description: 'Road maintenance and infrastructure',
    sector: 'ROADS',
    agencyType: 'municipal',
    isPrimary: true,
    isExternal: false,
    verified: false,
  },
  {
    name: 'Electrical',
    key: 'electrical',
    description: 'Electrical infrastructure and streetlights',
    sector: 'STREET_LIGHTING',
    agencyType: 'municipal',
    isPrimary: true,
    isExternal: false,
    verified: false,
  },
  {
    name: 'Water Supply',
    key: 'water_supply',
    description: 'Water supply and pipeline maintenance',
    sector: 'WATER',
    agencyType: 'municipal',
    isPrimary: true,
    isExternal: false,
    verified: false,
  },
  {
    name: 'Sewerage',
    key: 'sewerage',
    description: 'Sewerage and drainage systems',
    sector: 'SEWERAGE',
    agencyType: 'municipal',
    isPrimary: true,
    isExternal: false,
    verified: false,
  },
  {
    name: 'Sanitation',
    key: 'sanitation',
    description: 'Waste management and sanitation',
    sector: 'SOLID_WASTE',
    agencyType: 'municipal',
    isPrimary: true,
    isExternal: false,
    verified: false,
  },
  {
    name: 'Parks',
    key: 'parks',
    description: 'Public parks and green spaces',
    sector: 'PARKS',
    agencyType: 'municipal',
    isPrimary: true,
    isExternal: false,
    verified: false,
  },
  {
    name: 'Traffic Police',
    key: 'traffic_police',
    description: 'Traffic management and signals',
    // Sector is left null: traffic enforcement inside municipal limits is handled by the
    // state Punjab Police agency (PUNJAB-POLICE-TRAFFIC); keep this department unassigned for now to review later.
    sector: null,
    agencyType: 'municipal',
    isPrimary: false,
    isExternal: false,
    verified: false,
  },
  {
    name: 'Municipal Enforcement',
    key: 'municipal_enforcement',
    description: 'Municipal regulations enforcement',
    sector: 'ENFORCEMENT',
    agencyType: 'municipal',
    isPrimary: true,
    isExternal: false,
    verified: false,
  },
  {
    name: 'Health',
    key: 'health',
    description: 'Public health services',
    sector: 'PUBLIC_HEALTH',
    agencyType: 'municipal',
    isPrimary: true,
    isExternal: false,
    verified: false,
  },
  {
    name: 'Animal Husbandry',
    key: 'animal_husbandry',
    description: 'Animal control and welfare',
    sector: 'ANIMAL',
    agencyType: 'municipal',
    isPrimary: true,
    isExternal: false,
    verified: false,
  },
]

/**
 * Seeds external state agencies for a given city idempotently.
 * Matches on { municipality: municipalityId, agencyCode }.
 * If document exists, it does NOT overwrite any admin edits.
 *
 * @param {mongoose.Types.ObjectId|string} municipalityId
 * @param {string} stateKey e.g. 'punjab'
 * @returns {Promise<Department[]>} Created agency documents
 */
export const seedAgenciesForCity = async (municipalityId, stateKey = 'punjab') => {
  const normState = (stateKey || 'punjab').toString().toLowerCase().trim().replace(/\s+/g, '_')
  const catalogPath = path.join(__dirname, '..', 'seed-data', 'agencies', `${normState}.json`)

  if (!fs.existsSync(catalogPath)) {
    return []
  }

  const raw = fs.readFileSync(catalogPath, 'utf-8')
  const agencies = JSON.parse(raw)
  const createdOrFound = []

  for (const agency of agencies) {
    let existing = await Department.findOne({
      municipality: municipalityId,
      agencyCode: agency.agencyCode,
    })

    if (!existing) {
      // Fallback check: maybe an earlier version created it with the key or name but without agencyCode
      existing = await Department.findOne({
        municipality: municipalityId,
        $or: [
          { key: agency.key },
          { name: agency.name },
          { key: agency.agencyCode },
        ],
      })

      if (existing) {
        // Adopt the agencyCode and external flag without overwriting other admin edits
        if (!existing.agencyCode) existing.agencyCode = agency.agencyCode
        if (existing.isExternal === undefined || existing.isExternal === false) existing.isExternal = true
        if (!existing.sector) existing.sector = agency.sector
        if (agency.isPrimary && !existing.isPrimary) existing.isPrimary = true
        await existing.save()
      }
    }

    if (!existing) {
      const doc = await Department.create({
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
        municipality: municipalityId,
        contact: {},
      })
      createdOrFound.push(doc)
    } else {
      createdOrFound.push(existing)
    }
  }

  return createdOrFound
}

/**
 * Idempotently create the 10 standard departments for a municipality and seeds
 * state agencies.
 * Safe to call multiple times – uses upsert on (municipality, key).
 *
 * @param {mongoose.Types.ObjectId|string} municipalityId
 * @param {string} [stateKey='punjab']
 * @returns {Promise<Department[]>} Array of created/updated department documents
 */
export const createDefaultDepartments = async (municipalityId, stateKey = 'punjab') => {
  const departments = []
  for (const tpl of DEPARTMENT_TEMPLATES) {
    const setOnInsertFields = {
      name: tpl.name,
      key: tpl.key,
      municipality: municipalityId,
      description: tpl.description,
      sector: tpl.sector,
      agencyType: tpl.agencyType || 'municipal',
      isPrimary: Boolean(tpl.isPrimary),
      isExternal: false,
      verified: false,
    }

    const dept = await Department.findOneAndUpdate(
      { municipality: municipalityId, key: tpl.key },
      {
        $setOnInsert: setOnInsertFields,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    departments.push(dept)
  }

  // Seed external state agencies for the city
  await seedAgenciesForCity(municipalityId, stateKey)

  return departments
}
