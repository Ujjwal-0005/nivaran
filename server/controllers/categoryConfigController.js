import Category from '../models/Category.js'
import CategoryConfig from '../models/CategoryConfig.js'
import Department from '../models/Department.js'
import AuditLog from '../models/AuditLog.js'

/**
 * GET /api/admin/category-settings
 * Returns all national categories with the city admin's effective settings.
 * Role: admin of that city only.
 */
export const getAdminCategorySettings = async (req, res) => {
  try {
    const muniId = req.user.municipality
    if (!muniId) {
      return res.status(403).json({ message: 'Admin does not belong to any municipality' })
    }

    const categories = await Category.find().sort({ name: 1 })
    const configs = await CategoryConfig.find({ municipality: muniId })
      .populate('routeToDepartment', 'name agencyCode isExternal isActive')

    const configMap = new Map()
    for (const c of configs) {
      configMap.set(c.category.toString(), c)
    }

    const result = categories.map((cat) => {
      const cfg = configMap.get(cat._id.toString())
      return {
        categoryId: cat._id,
        name: cat.name,
        sector: cat.sector,
        defaultSeverity: cat.severityWeight,
        defaultSlaHours: cat.slaHours,
        departmentKey: cat.departmentKey,
        // Effective settings
        isEnabled: cfg ? cfg.isEnabled : true,
        severityOverride: cfg?.severityOverride ?? null,
        slaHoursOverride: cfg?.slaHoursOverride ?? null,
        effectiveSeverity: cfg?.severityOverride ?? cat.severityWeight,
        effectiveSlaHours: cfg?.slaHoursOverride ?? cat.slaHours,
        routeToDepartment: cfg?.routeToDepartment
          ? {
              _id: cfg.routeToDepartment._id,
              name: cfg.routeToDepartment.name,
              agencyCode: cfg.routeToDepartment.agencyCode || null,
              isExternal: Boolean(cfg.routeToDepartment.isExternal),
              isActive: Boolean(cfg.routeToDepartment.isActive),
            }
          : null,
      }
    })

    res.status(200).json({ settings: result })
  } catch (err) {
    console.error('getAdminCategorySettings error:', err)
    res.status(500).json({ message: 'Server error fetching category settings' })
  }
}

/**
 * PUT /api/admin/category-settings/:categoryId
 * Upserts CategoryConfig for the city admin's municipality.
 * Role: admin of that city only.
 */
export const updateAdminCategorySettings = async (req, res) => {
  try {
    const muniId = req.user.municipality
    if (!muniId) {
      return res.status(403).json({ message: 'Admin does not belong to any municipality' })
    }

    const { categoryId } = req.params
    const { isEnabled, severityOverride, slaHoursOverride, routeToDepartment } = req.body

    const category = await Category.findById(categoryId)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    const updateFields = {
      updatedBy: req.user.userId,
    }

    if (isEnabled !== undefined) {
      if (typeof isEnabled !== 'boolean') {
        return res.status(400).json({ message: 'isEnabled must be a boolean' })
      }
      updateFields.isEnabled = isEnabled
    }

    if (severityOverride !== undefined && severityOverride !== null) {
      const numSev = Number(severityOverride)
      if (!Number.isInteger(numSev) || numSev < 1 || numSev > 10) {
        return res.status(400).json({ message: 'severityOverride must be an integer between 1 and 10' })
      }
      updateFields.severityOverride = numSev
    } else if (severityOverride === null) {
      updateFields.severityOverride = null
    }

    if (slaHoursOverride !== undefined && slaHoursOverride !== null) {
      const numSla = Number(slaHoursOverride)
      if (!Number.isInteger(numSla) || numSla < 1 || numSla > 720) {
        return res.status(400).json({ message: 'slaHoursOverride must be a positive integer up to 720' })
      }
      updateFields.slaHoursOverride = numSla
    } else if (slaHoursOverride === null) {
      updateFields.slaHoursOverride = null
    }

    if (routeToDepartment) {
      const dept = await Department.findOne({
        _id: routeToDepartment,
        municipality: muniId,
      })
      if (!dept) {
        return res.status(400).json({ message: 'routeToDepartment does not exist or belongs to another municipality' })
      }
      if (!dept.isActive) {
        return res.status(400).json({ message: 'routeToDepartment must be an active department' })
      }
      updateFields.routeToDepartment = dept._id
    } else if (routeToDepartment === null) {
      updateFields.routeToDepartment = null
    }

    const config = await CategoryConfig.findOneAndUpdate(
      { municipality: muniId, category: categoryId },
      { $set: updateFields },
      { upsert: true, new: true, runValidators: true }
    ).populate('routeToDepartment', 'name agencyCode isExternal')

    // Audit log
    await AuditLog.create({
      actor: req.user.userId,
      actorEmail: req.user.email,
      action: 'category_config.update',
      targetMunicipality: muniId,
      meta: {
        categoryId,
        categoryName: category.name,
        isEnabled: config.isEnabled,
        severityOverride: config.severityOverride,
        slaHoursOverride: config.slaHoursOverride,
        routeToDepartment: config.routeToDepartment?.name || null,
      },
    })

    res.status(200).json({
      message: 'Category settings updated successfully',
      config,
    })
  } catch (err) {
    console.error('updateAdminCategorySettings error:', err)
    res.status(err.statusCode || 500).json({ message: err.message || 'Server error updating category settings' })
  }
}

/**
 * DELETE /api/admin/category-settings/:categoryId
 * Removes city-specific config (resets to defaults).
 * Role: admin of that city only.
 */
export const deleteAdminCategorySettings = async (req, res) => {
  try {
    const muniId = req.user.municipality
    if (!muniId) {
      return res.status(403).json({ message: 'Admin does not belong to any municipality' })
    }

    const { categoryId } = req.params
    const category = await Category.findById(categoryId)
    if (!category) {
      return res.status(404).json({ message: 'Category not found' })
    }

    const deleted = await CategoryConfig.findOneAndDelete({
      municipality: muniId,
      category: categoryId,
    })

    await AuditLog.create({
      actor: req.user.userId,
      actorEmail: req.user.email,
      action: 'category_config.delete',
      targetMunicipality: muniId,
      meta: {
        categoryId,
        categoryName: category.name,
      },
    })

    res.status(200).json({
      message: 'Category settings reset to defaults',
      deleted: Boolean(deleted),
    })
  } catch (err) {
    console.error('deleteAdminCategorySettings error:', err)
    res.status(500).json({ message: 'Server error deleting category settings' })
  }
}
