import cron from 'node-cron'
import Report from '../models/Report.js'
import Category from '../models/Category.js'

/**
 * SLA Escalation Cron Job
 * Runs every hour (or configurable interval).
 * Checks reports where:
 *   - status !== 'resolved'
 *   - slaDeadline < new Date()
 *   - isEscalated === false
 *
 * For each match:
 *   - sets isEscalated: true
 *   - sets escalatedAt: new Date()
 *   - boosts priorityScore by +50 flat points to ensure breach reports
 *     visibly rise to the top of staff & admin queues immediately.
 *   - logs the escalation
 */
export const checkSlaEscalations = async () => {
  try {
    const now = new Date()
    const breachedReports = await Report.find({
      status: { $ne: 'resolved' },
      slaDeadline: { $lt: now },
      isEscalated: false,
    }).populate('category')

    if (breachedReports.length === 0) {
      return
    }

    console.log(`[SLA Escalation] Found ${breachedReports.length} reports breaching SLA deadline.`)

    for (const report of breachedReports) {
      report.isEscalated = true
      report.escalatedAt = now
      // Boost priority score by flat +50 points so escalated tickets immediately surface at the top
      report.priorityScore = (report.priorityScore || 0) + 50
      await report.save()

      console.log(`[SLA Escalation] Escalated ticket ${report.ticketId} (Category: ${report.category?.name || 'N/A'}, New Priority: ${report.priorityScore})`)

      // TODO: Phase 8 — notify admin when a ticket auto-escalates
    }
  } catch (error) {
    console.error('[SLA Escalation] Error checking SLA escalations:', error)
  }
}

export const initSlaCron = () => {
  // Run once every hour at minute 0: '0 * * * *'
  // Also runs an immediate check at server startup
  console.log('[SLA Escalation] Initializing hourly SLA escalation cron job...')
  
  // Run startup check after a brief 5s delay so DB connection is established
  setTimeout(() => {
    checkSlaEscalations()
  }, 5000)

  cron.schedule('0 * * * *', () => {
    console.log('[SLA Escalation] Running scheduled hourly SLA escalation check...')
    checkSlaEscalations()
  })
}
