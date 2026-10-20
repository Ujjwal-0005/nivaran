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
  designation: {
    type: String,
    trim: true,
    default: '',
  },
  // Staff application approval fields (Step 3)
  applicationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: null,
  },
  appliedAt: {
    type: Date,
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  rejectionReason: {
    type: String,
    default: null,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  revokedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  revocationReason: {
    type: String,
    default: null,
  },
  employeeId: {
    type: String,
    trim: true,
    default: null,
  },
  isPrimaryAdmin: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  deactivatedAt: {
    type: Date,
    default: null,
  },
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  deactivationReason: {
    type: String,
    default: null,
  },
  isDemo: {
    type: Boolean,
    default: false,
    index: true,
  },
}, {
  timestamps: true,
})

userSchema.index({ passwordSetToken: 1 }, { sparse: true })
// At most one active primary admin per municipality
userSchema.index(
  { municipality: 1, isPrimaryAdmin: 1 },
  {
    unique: true,
    partialFilterExpression: { role: 'admin', isPrimaryAdmin: true, isActive: true },
  }
)
// Step 3: Index for staff application queries
userSchema.index({ municipality: 1, role: 1, applicationStatus: 1 })
// Step 3: employeeId is unique per municipality (only when set to non-empty string)
userSchema.index(
  { municipality: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: { employeeId: { $type: 'string', $gt: '' } },
  }
)

// Agencies must not receive staff: reject creating or approving a staff user whose department has isExternal: true
userSchema.pre('save', async function (next) {
  if (this.role === 'staff' && this.department && (this.isModified('department') || this.isModified('role') || this.isModified('applicationStatus'))) {
    const Department = mongoose.model('Department')
    const dept = await Department.findById(this.department)
    if (dept && dept.isExternal) {
      return next(new Error('Staff users cannot be assigned to an external agency department.'))
    }
  }
  next()
})

export default mongoose.model('User', userSchema)
