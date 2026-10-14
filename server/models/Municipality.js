import mongoose from 'mongoose'

const subdivisionSchema = new mongoose.Schema({
  kind: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
}, { _id: false })

const municipalitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  nameLocal: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['corporation', 'council', 'nagar_panchayat'],
    required: true,
  },
  lgdCode: {
    type: String,
    default: null,
    sparse: true,
    unique: true,
  },
  centroid: {
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
  },
  defaultZoom: {
    type: Number,
    default: 13,
  },
  subdivisions: [subdivisionSchema],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
})

municipalitySchema.index({ state: 1, name: 1 }, { unique: true })

export default mongoose.model('Municipality', municipalitySchema)
