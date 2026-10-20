import Category from '../models/Category.js'
import Department from '../models/Department.js'
import CategoryConfig from '../models/CategoryConfig.js'

/**
 * Resolves which department should handle a report for a given municipality and category.
 *
 * Evaluation order:
 * 1. CategoryConfig for (municipalityId, categoryId):
 *    - if isEnabled === false -> { department: null, routedBy: 'none', unresolved: false, disabled: true }
 *    - if routeToDepartment is set: verify it exists, belongs to same municipality, and isActive === true.
 *      If valid -> { department, routedBy: 'category_override', unresolved: false }
 * 2. Active primary department for the category's sector in this municipality:
 *    -> { department, routedBy: 'sector_primary', unresolved: false }
 * 3. Active fallback department in that sector (oldest first, createdAt: 1):
 *    -> { department, routedBy: 'sector_fallback', unresolved: false }
 * 4. None found:
 *    -> { department: null, routedBy: 'none', unresolved: true }
 *
 * Rules:
 * - Always filters by municipality.
 * - Never throws because nothing matched.
 * - Does not change any existing code path.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.municipalityId
 * @param {string|mongoose.Types.ObjectId} params.categoryId
 * @returns {Promise<{ department: Department|null, routedBy: string, unresolved: boolean, disabled?: boolean }>}
 */
export async function resolveDepartment({ municipalityId, categoryId }) {
  if (!municipalityId || !categoryId) {
    return { department: null, routedBy: 'none', unresolved: true }
  }

  try {
    // 0. Check CategoryConfig override / disabled flag
    const config = await CategoryConfig.findOne({
      municipality: municipalityId,
      category: categoryId,
    }).populate('routeToDepartment')

    if (config) {
      if (config.isEnabled === false) {
        return {
          department: null,
          routedBy: 'none',
          unresolved: false,
          disabled: true,
        }
      }

      if (config.routeToDepartment) {
        const dept = config.routeToDepartment
        const sameMuni = dept.municipality && dept.municipality.toString() === municipalityId.toString()
        if (sameMuni && dept.isActive) {
          return {
            department: dept,
            routedBy: 'category_override',
            unresolved: false,
          }
        }
      }
    }

    // Look up category to find its sector
    const categoryDoc = await Category.findById(categoryId)
    if (!categoryDoc || !categoryDoc.sector) {
      return { department: null, routedBy: 'none', unresolved: true }
    }

    const sector = categoryDoc.sector

    // 1. Check active primary department for sector in this municipality
    const primaryDept = await Department.findOne({
      municipality: municipalityId,
      sector,
      isPrimary: true,
      isActive: true,
    })

    if (primaryDept) {
      return {
        department: primaryDept,
        routedBy: 'sector_primary',
        unresolved: false,
      }
    }

    // 2. Check active fallback department in that sector (oldest first)
    const fallbackDept = await Department.findOne({
      municipality: municipalityId,
      sector,
      isActive: true,
    }).sort({ createdAt: 1 })

    if (fallbackDept) {
      return {
        department: fallbackDept,
        routedBy: 'sector_fallback',
        unresolved: false,
      }
    }

    // 3. None found
    return {
      department: null,
      routedBy: 'none',
      unresolved: true,
    }
  } catch (err) {
    // Never crash caller
    console.error('[resolveDepartment] Error during resolution:', err.message)
    return {
      department: null,
      routedBy: 'none',
      unresolved: true,
    }
  }
}
