import mongoose from 'mongoose'

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
  description: {
    type: String,
    required: true,
  },
  photoUrl: {
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
    enum: ['reported', 'acknowledged', 'in_progress', 'resolved'],
    default: 'reported',
  },
  reportCount: {
    type: Number,
    default: 1,
  },
  reportedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
})

export default mongoose.model('Report', reportSchema)
