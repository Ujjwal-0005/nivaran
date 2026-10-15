import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  departmentKey: {
    type: String,
    required: true,
    trim: true,
  },
  severityWeight: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
  },
  slaHours: {
    type: Number,
    required: true,
    default: 48,
    min: 1,
  },
}, {
  timestamps: true,
})

export default mongoose.model('Category', categorySchema)
