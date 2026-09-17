import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  severityWeight: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
  },
}, {
  timestamps: true,
})

export default mongoose.model('Category', categorySchema)
