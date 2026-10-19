import Department from '../models/Department.js'

/**
 * 10 standard department templates shared across all municipalities.
 * Identical to the templates in seed.js – kept in sync here as the
 * authoritative source for runtime use (Super Admin city creation).
 */
export const DEPARTMENT_TEMPLATES = [
  { name: 'Roads', key: 'roads', description: 'Road maintenance and infrastructure' },
  { name: 'Electrical', key: 'electrical', description: 'Electrical infrastructure and streetlights' },
  { name: 'Water Supply', key: 'water_supply', description: 'Water supply and pipeline maintenance' },
  { name: 'Sewerage', key: 'sewerage', description: 'Sewerage and drainage systems' },
  { name: 'Sanitation', key: 'sanitation', description: 'Waste management and sanitation' },
  { name: 'Parks', key: 'parks', description: 'Public parks and green spaces' },
  { name: 'Traffic Police', key: 'traffic_police', description: 'Traffic management and signals' },
  { name: 'Municipal Enforcement', key: 'municipal_enforcement', description: 'Municipal regulations enforcement' },
  { name: 'Health', key: 'health', description: 'Public health services' },
  { name: 'Animal Husbandry', key: 'animal_husbandry', description: 'Animal control and welfare' },
]

/**
 * Idempotently create the 10 standard departments for a municipality.
 * Safe to call multiple times – uses upsert on (municipality, key).
 *
 * @param {mongoose.Types.ObjectId|string} municipalityId
 * @returns {Promise<Department[]>} Array of created/updated department documents
 */
export const createDefaultDepartments = async (municipalityId) => {
  const departments = []
  for (const tpl of DEPARTMENT_TEMPLATES) {
    const dept = await Department.findOneAndUpdate(
      { municipality: municipalityId, key: tpl.key },
      {
        $set: {
          name: tpl.name,
          key: tpl.key,
          municipality: municipalityId,
          description: tpl.description,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    departments.push(dept)
  }
  return departments
}
