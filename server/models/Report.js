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
    required: true,
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
}, {
  timestamps: true,
})

export default mongoose.model('Report', reportSchema)
