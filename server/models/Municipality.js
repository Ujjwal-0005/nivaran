import mongoose from 'mongoose'

const municipalitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  state: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['corporation', 'council', 'panchayat'],
    required: true,
  },
}, {
  timestamps: true,
})

export default mongoose.model('Municipality', municipalitySchema)
