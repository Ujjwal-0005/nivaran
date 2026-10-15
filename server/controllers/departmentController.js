import Department from '../models/Department.js'
import { scopeFilter, findInScope } from '../utils/scope.js'

// GET /api/departments (admin or authenticated)
export const getDepartments = async (req, res) => {
  try {
    const filter = scopeFilter(req)
    const departments = await Department.find(filter).sort({ name: 1 })
    res.status(200).json({ departments })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching departments' })
  }
}

// POST /api/departments (admin only)
export const createDepartment = async (req, res) => {
  try {
    const { name, key, description } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Department name is required' })
    }

    const deptKey = (key || name.trim().toLowerCase().replace(/\s+/g, '_')).trim()
    const filter = scopeFilter(req)

    const existing = await Department.findOne({
      municipality: filter.municipality,
      $or: [
        { name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } },
        { key: deptKey },
      ],
    })
    if (existing) {
      return res.status(400).json({ message: 'Department with this name or key already exists in this municipality' })
    }

    const department = await Department.create({
      name: name.trim(),
      key: deptKey,
      municipality: filter.municipality,
      description: description ? description.trim() : '',
    })

    res.status(201).json({
      message: 'Department created successfully',
      department,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error creating department' })
  }
}

// PATCH /api/departments/:id (admin only)
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params
    const { name, key, description } = req.body

    const department = await findInScope(Department, req, id)

    if (name && name.trim()) {
      const duplicate = await Department.findOne({
        _id: { $ne: id },
        municipality: department.municipality,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      })
      if (duplicate) {
        return res.status(400).json({ message: 'Another department with this name already exists' })
      }
      department.name = name.trim()
    }

    if (key && key.trim()) {
      const duplicateKey = await Department.findOne({
        _id: { $ne: id },
        municipality: department.municipality,
        key: key.trim(),
      })
      if (duplicateKey) {
        return res.status(400).json({ message: 'Another department with this key already exists' })
      }
      department.key = key.trim()
    }

    if (description !== undefined) {
      department.description = description.trim()
    }

    await department.save()

    res.status(200).json({
      message: 'Department updated successfully',
      department,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error updating department' })
  }
}
