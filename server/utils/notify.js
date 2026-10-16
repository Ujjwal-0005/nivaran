import { getIO } from '../config/socket.js'

/**
 * Send real-time notification to a specific user's personal room
 * Room format: user:<userId>
 * @param {string|ObjectId} userId
 * @param {string} event
 * @param {object} payload
 */
export const notifyUser = async (userId, event, payload) => {
  try {
    const io = getIO()
    if (userId) {
      const room = `user:${userId.toString()}`
      io.to(room).emit(event, payload)
      console.log(`[Notification] Emitted '${event}' to ${room}`)
    }
  } catch (error) {
    console.warn(`[Notification Warning] Could not notify user ${userId}:`, error.message)
  }
}

/**
 * Send real-time notification to municipal administrators of a specific municipality
 * Room format: muni:<municipalityId>:admins
 * @param {string|ObjectId} municipalityId
 * @param {string} event
 * @param {object} payload
 */
export const notifyAdmins = async (municipalityId, event, payload) => {
  try {
    if (!municipalityId) {
      console.warn('[Notification Warning] notifyAdmins called without municipalityId')
      return
    }
    const io = getIO()
    const room = `muni:${municipalityId.toString()}:admins`
    io.to(room).emit(event, payload)
    console.log(`[Notification] Emitted '${event}' to ${room}`)
  } catch (error) {
    console.warn('[Notification Warning] Could not notify admins:', error.message)
  }
}
