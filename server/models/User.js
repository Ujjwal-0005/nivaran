import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['citizen', 'staff', 'admin', 'superadmin'],
    required: true,
  },
  municipality: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Municipality',
    required: function () {
      return this.role !== 'superadmin'
    },
    index: true,
  },
  homeAddress: {
    text: {
      type: String,
      default: '',
    },
    lat: {
      type: Number,
      default: null,
    },
    lng: {
      type: Number,
      default: null,
    },
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
  phone: {
    type: String,
  },
  city: {
    type: String,
  },
  state: {
    type: String,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
  },
  otpExpiry: {
    type: Date,
  },
  lastOtpSentAt: {
    type: Date,
  },
  // Used by the Super Admin invite flow to let a new city admin set their password
  passwordSetToken: {
    type: String,
    default: null,
  },
  passwordSetTokenExpiry: {
    type: Date,
    default: null,
  },
  // Allows super admin to soft-disable a city admin without deleting the user
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
})

userSchema.index({ passwordSetToken: 1 }, { sparse: true })

export default mongoose.model('User', userSchema)
