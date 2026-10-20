import Category from '../models/Category.js'
import CategoryConfig from '../models/CategoryConfig.js'
import { isValidSector } from '../constants/sectors.js'

// GET /api/categories (public/all authenticated)
// If caller has a municipality in req.user, filters out categories disabled for that city
export const getCategories = async (req, res) => {
  try {
    let categories = await Category.find().sort({ name: 1 })

    // If lat & lng provided, derive target municipality for category availability
    let targetMuni = null
    const { lat, lng } = req.query
    if (lat !== undefined && lng !== undefined) {
      try {
        const { resolveCityFromPoint } = await import('../utils/resolveCityFromPoint.js')
        const resolved = await resolveCityFromPoint({
          lat,
          lng,
          homeMunicipalityId: req.user?.municipality || null,
        })
        if (resolved && resolved.municipality) {
          targetMuni = resolved.municipality._id
        }
      } catch (err) {
        // If invalid coords provided, fall back to user's registered municipality
      }
    }

    if (!targetMuni) {
      targetMuni = req.user?.municipality || null
    }

    if (targetMuni) {
      const disabledConfigs = await CategoryConfig.find({
        municipality: targetMuni,
        isEnabled: false,
      }).select('category')

      const disabledCatIds = new Set(disabledConfigs.map((c) => c.category.toString()))
      categories = categories.filter((c) => !disabledCatIds.has(c._id.toString()))
    }

    res.status(200).json({ categories })
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ message: 'Server error fetching categories' })
  }
}

// POST /api/categories (admin only - national shared taxonomy)
export const createCategory = async (req, res) => {
  try {
    const { name, departmentKey, department, severityWeight, slaHours, sector } = req.body

    const key = (departmentKey || department || '').toString().trim()
    if (!name || !key || !severityWeight) {
      return res.status(400).json({ message: 'Name, departmentKey, and severityWeight are required' })
    }

    if (sector && !isValidSector(sector)) {
      return res.status(400).json({ message: 'Invalid sector' })
    }

    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } })
    if (existing) {
      return res.status(400).json({ message: 'Category with this name already exists' })
    }

    const newCategory = await Category.create({
      name: name.trim(),
      departmentKey: key,
      severityWeight: Number(severityWeight),
      slaHours: Number(slaHours) || 48,
      sector: sector || 'ROADS',
    })

    res.status(201).json({
      message: 'Category created successfully',
      category: newCategory,
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
    const { name, departmentKey, department, severityWeight, slaHours } = req.body

    const category = await Category.findById(id)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    if (name && name.trim()) {
      const duplicate = await Category.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      })
      if (duplicate) {
        return res.status(400).json({ message: 'Another category with this name already exists' })
      }
      category.name = name.trim()
    }

    const key = (departmentKey || department)
    if (key !== undefined && key !== null) {
      category.departmentKey = key.toString().trim()
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

    if (req.body.sector !== undefined) {
      if (!isValidSector(req.body.sector)) {
        return res.status(400).json({ message: 'Invalid sector' })
      }
      category.sector = req.body.sector
    }

    await category.save()

    res.status(200).json({
      message: 'Category updated successfully',
      category,
    })
  } catch (error) {
    console.error('Update category error:', error)
    res.status(500).json({ message: 'Server error updating category' })
  }
}
