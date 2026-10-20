import Department from '../models/Department.js'
import { scopeFilter } from '../utils/scope.js'

// GET /api/departments (any logged-in user: citizen, staff, admin)
// Returns ONLY active departments with minimal fields: _id, name, key, sector, isExternal
export const getDepartments = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const departments = await Department.find(
      { municipality: filter.municipality, isActive: true },
      '_id name key sector isExternal municipality'
    ).sort({ name: 1 })

    res.status(200).json({ departments })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching departments' })
  }
}
