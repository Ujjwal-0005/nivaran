import Department from '../models/Department.js'
import Category from '../models/Category.js'

// GET /api/departments (admin or authenticated)
export const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ name: 1 })
    res.status(200).json({ departments })
  } catch (error) {
    console.error('Get departments error:', error)
    res.status(500).json({ message: 'Server error fetching departments' })
  }
}

// POST /api/departments (admin only)
export const createDepartment = async (req, res) => {
  try {
    const { name, description } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Department name is required' })
    }

    const existing = await Department.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
    })
    if (existing) {
      return res.status(400).json({ message: 'Department with this name already exists' })
    }

    const department = await Department.create({
      name: name.trim(),
      description: description ? description.trim() : '',
    })

    res.status(201).json({
      message: 'Department created successfully',
      department,
    })
  } catch (error) {
    console.error('Create department error:', error)
    res.status(500).json({ message: 'Server error creating department' })
  }
}

// PATCH /api/departments/:id (admin only)
export const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description } = req.body

    const department = await Department.findById(id)
    if (!department) {
      return res.status(404).json({ message: 'Department not found' })
    }

    if (name && name.trim()) {
      const duplicate = await Department.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      })
      if (duplicate) {
        return res.status(400).json({ message: 'Another department with this name already exists' })
      }
      department.name = name.trim()
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
    console.error('Update department error:', error)
    res.status(500).json({ message: 'Server error updating department' })
  }
}
