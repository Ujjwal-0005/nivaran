import mongoose from 'mongoose'

const categoryConfigSchema = new mongoose.Schema({
  municipality: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Municipality',
    required: true,
    index: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  },
  isEnabled: {
    type: Boolean,
    default: true,
  },
  severityOverride: {
    type: Number,
    min: 1,
    max: 10,
    default: null,
  },
  slaHoursOverride: {
    type: Number,
    min: 1,
    default: null,
  },
  routeToDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
})

// Unique per municipality and category
categoryConfigSchema.index({ municipality: 1, category: 1 }, { unique: true })

// Pre-save check: reject routeToDepartment if it belongs to a different municipality or is inactive
categoryConfigSchema.pre('save', async function (next) {
  if (this.routeToDepartment && (this.isModified('routeToDepartment') || this.isModified('municipality'))) {
    const Department = mongoose.model('Department')
    const dept = await Department.findById(this.routeToDepartment)

    if (!dept) {
      return next(new Error('Target department does not exist'))
    }

    if (dept.municipality.toString() !== this.municipality.toString()) {
      return next(new Error('Target department belongs to a different municipality'))
    }

    if (!dept.isActive) {
      return next(new Error('Target department is inactive'))
    }
  }

  next()
})

export default mongoose.model('CategoryConfig', categoryConfigSchema)
