import mongoose from 'mongoose'

const cityRequestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    requestCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['open', 'planned', 'added', 'dismissed'],
      default: 'open',
    },
    firstRequestedAt: {
      type: Date,
      default: Date.now,
    },
    lastRequestedAt: {
      type: Date,
      default: Date.now,
    },
    requesters: [
      {
        emailHash: {
          type: String,
          required: true,
        },
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
)

cityRequestSchema.index({ name: 1, state: 1 }, { unique: true })
cityRequestSchema.index({ requestCount: -1, status: 1 })

export default mongoose.model('CityRequest', cityRequestSchema)
