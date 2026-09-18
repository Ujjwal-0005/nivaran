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
    enum: ['citizen', 'staff', 'admin'],
    required: true,
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
}, {
  timestamps: true,
})

export default mongoose.model('User', userSchema)
