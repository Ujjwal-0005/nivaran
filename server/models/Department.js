import mongoose from 'mongoose'

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  key: {
    type: String,
    required: true,
    trim: true,
  },
  municipality: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Municipality',
    required: true,
    index: true,
  },
  description: {
    type: String,
  },
}, {
  timestamps: true,
})

departmentSchema.index({ municipality: 1, key: 1 }, { unique: true })
departmentSchema.index({ municipality: 1, name: 1 }, { unique: true })

export default mongoose.model('Department', departmentSchema)
