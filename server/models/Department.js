import mongoose from 'mongoose'
import { SECTOR_KEYS } from '../constants/sectors.js'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const websiteRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i

const contactSchema = new mongoose.Schema({
  helplinePhone: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        if (!v || v.trim() === '') return true
        return emailRegex.test(v)
      },
      message: 'Invalid contact email format',
    },
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        if (!v || v.trim() === '') return true
        return websiteRegex.test(v)
      },
      message: 'Invalid contact website URL format',
    },
  },
  address: {
    type: String,
    trim: true,
  },
  officeHours: {
    type: String,
    trim: true,
  },
}, { _id: false })

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
  sector: {
    type: String,
    enum: SECTOR_KEYS,
    default: null,
  },
  agencyType: {
    type: String,
    enum: ['municipal', 'state_dept', 'utility', 'police', 'other'],
    default: 'municipal',
  },
  agencyCode: {
    type: String,
    trim: true,
    default: null,
  },
  isExternal: {
    type: Boolean,
    default: false,
  },
  isPrimary: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  notes: {
    type: String,
    default: '',
  },
  contact: {
    type: contactSchema,
    default: () => ({}),
  },
}, {
  timestamps: true,
})

departmentSchema.index({ municipality: 1, key: 1 }, { unique: true })
departmentSchema.index({ municipality: 1, name: 1 }, { unique: true })

// Partial unique index: at most one active primary department per { municipality, sector }
departmentSchema.index(
  { municipality: 1, sector: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isPrimary: true,
      isActive: true,
      sector: { $type: 'string' },
    },
  }
)

// Partial unique index: { municipality, agencyCode } when agencyCode is a non-empty string
departmentSchema.index(
  { municipality: 1, agencyCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      agencyCode: { $type: 'string', $gt: '' },
    },
  }
)

export default mongoose.model('Department', departmentSchema)
