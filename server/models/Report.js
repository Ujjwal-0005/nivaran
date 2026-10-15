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

reportSchema.index({ municipality: 1, status: 1 })
reportSchema.index({ municipality: 1, createdAt: -1 })

export default mongoose.model('Report', reportSchema)
