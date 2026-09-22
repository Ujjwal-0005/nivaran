import Category from '../models/Category.js'
import Department from '../models/Department.js'

// GET /api/categories (public/all authenticated)
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .populate('department', 'name')
      .sort({ name: 1 })

    res.status(200).json({ categories })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ message: 'Server error fetching categories' })
  }
}

// POST /api/categories (admin only)
export const createCategory = async (req, res) => {
  try {
    const { name, department, severityWeight, slaHours } = req.body

    if (!name || !department || !severityWeight) {
      return res.status(400).json({ message: 'Name, department, and severityWeight are required' })
    }

    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } })
    if (existing) {
      return res.status(400).json({ message: 'Category with this name already exists' })
    }

    const deptDoc = await Department.findById(department)
    if (!deptDoc) {
      return res.status(404).json({ message: 'Department not found' })
    }

    const newCategory = await Category.create({
      name: name.trim(),
      department,
      severityWeight: Number(severityWeight),
      slaHours: Number(slaHours) || 48,
    })

    const populated = await Category.findById(newCategory._id).populate('department', 'name')

    res.status(201).json({
      message: 'Category created successfully',
      category: populated,
    })
  } catch (error) {
    console.error('Create category error:', error)
    res.status(500).json({ message: 'Server error creating category' })
  }
}

// PATCH /api/categories/:id (admin only)
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params
    const { name, department, severityWeight, slaHours } = req.body

    const category = await Category.findById(id)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    if (name && name.trim()) {
      // Check duplicate name
      const duplicate = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      })
      if (duplicate) {
        return res.status(400).json({ message: 'Another category with this name already exists' })
      }
      category.name = name.trim()
    }

    if (department) {
      const deptDoc = await Department.findById(department)
      if (!deptDoc) {
        return res.status(404).json({ message: 'Department not found' })
      }
      category.department = department
    }

    if (severityWeight !== undefined) {
      const sw = Number(severityWeight)
      if (sw < 1 || sw > 10) {
        return res.status(400).json({ message: 'Severity weight must be between 1 and 10' })
      }
      category.severityWeight = sw
    }

    if (slaHours !== undefined) {
      const sh = Number(slaHours)
      if (sh < 1) {
        return res.status(400).json({ message: 'SLA hours must be at least 1' })
      }
      category.slaHours = sh
    }

    await category.save()

    const populated = await Category.findById(id).populate('department', 'name')

    res.status(200).json({
      message: 'Category updated successfully',
      category: populated,
    })
  } catch (error) {
    console.error('Update category error:', error)
    res.status(500).json({ message: 'Server error updating category' })
  }
}
