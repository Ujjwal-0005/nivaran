import mongoose from 'mongoose'

/**
 * Append-only audit log.
 * Documents are never updated or deleted – only inserted.
 * TTL index retains logs for 2 years (63072000 seconds).
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      // e.g. 'municipality.create', 'municipality.deactivate',
      //      'cityadmin.invite', 'cityadmin.revoke', 'cityadmin.reset_password'
    },
    targetMunicipality: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Municipality',
      default: null,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    // Never allow updates
    strict: true,
  }
)

// Compound index for common queries
auditLogSchema.index({ actor: 1, createdAt: -1 })
auditLogSchema.index({ targetMunicipality: 1, createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })

// TTL: keep audit logs for 2 years
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 })

export default mongoose.model('AuditLog', auditLogSchema)
