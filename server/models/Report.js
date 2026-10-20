import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  authorRole: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const reportSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true,
  },
  municipality: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Municipality',
    required: true,
    index: true,
  },
  citizen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null,
  },
  departmentUnresolved: {
    type: Boolean,
    default: false,
  },
  routedBy: {
    type: String,
    enum: ['category_override', 'sector_primary', 'sector_fallback', 'none', null],
    default: null,
  },
  routingHistory: [{
    at: {
      type: Date,
      default: Date.now,
    },
    action: {
      type: String,
      enum: ['auto', 'reassign', 'forward'],
      required: true,
    },
    fromDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    toDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    byUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      default: '',
    },
  }],
  forwarding: {
    forwardedAt: {
      type: Date,
      default: null,
    },
    forwardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    agencyReference: {
      type: String,
      default: '',
    },
    note: {
      type: String,
      default: '',
    },
  },
  description: {
    type: String,
    required: true,
  },
  photoUrl: {
    type: String,
  },
  resolutionPhotoUrl: {
    type: String,
  },
  location: {
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
  },
  // GeoJSON Point for 2dsphere duplicate-prefilter queries
  geoPoint: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]  — GeoJSON order
      default: [0, 0],
    },
  },
  status: {
    type: String,
    enum: ['reported', 'acknowledged', 'in_progress', 'resolved', 'disputed'],
    default: 'reported',
  },
  isAnonymous: {
    type: Boolean,
    default: false,
  },
  reportCount: {
    type: Number,
    default: 1,
  },
  reportedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  upvotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  priorityScore: {
    type: Number,
    default: 0,
  },
  comments: [commentSchema],
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
    },
  },
  isDisputed: {
    type: Boolean,
    default: false,
  },
  disputeReason: {
    type: String,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  resolutionNote: {
    type: String,
  },
  slaDeadline: {
    type: Date,
  },
  isEscalated: {
    type: Boolean,
    default: false,
  },
  escalatedAt: {
    type: Date,
  },
  resolvedAt: {
    type: Date,
  },
}, {
  timestamps: true,
})

// ── Indexes ─────────────────────────────────────────────────────────────────

// Existing
reportSchema.index({ municipality: 1, status: 1 })
reportSchema.index({ municipality: 1, createdAt: -1 })

// New compound indexes for frequent query patterns (municipality leads every compound index)
reportSchema.index({ municipality: 1, department: 1, status: 1 })
reportSchema.index({ municipality: 1, assignedTo: 1, status: 1 })
reportSchema.index({ municipality: 1, category: 1, status: 1 })
reportSchema.index({ municipality: 1, isEscalated: 1, slaDeadline: 1 }) // SLA cron
reportSchema.index({ municipality: 1, departmentUnresolved: 1, priorityScore: -1 })

// Citizen own-reports (cross-city: no municipality filter)
reportSchema.index({ citizen: 1, createdAt: -1 })

// 2dsphere index for geo prefilter in duplicate detection
reportSchema.index({ geoPoint: '2dsphere' })

export default mongoose.model('Report', reportSchema)

