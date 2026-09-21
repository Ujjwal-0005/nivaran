import { getIO } from '../config/socket.js'

/**
 * Send real-time notification to a specific user's personal room
 * @param {string|ObjectId} userId
 * @param {string} event
 * @param {object} payload
 */
export const notifyUser = async (userId, event, payload) => {
  try {
    const io = getIO()
    if (userId) {
      io.to(userId.toString()).emit(event, payload)
      console.log(`[Notification] Emitted '${event}' to user ${userId}`)
    }
  } catch (error) {
    console.warn(`[Notification Warning] Could not notify user ${userId}:`, error.message)
  }
}

/**
 * Send real-time notification to all active municipal administrators
 * @param {string} event
 * @param {object} payload
 */
export const notifyAdmins = async (event, payload) => {
  try {
    const io = getIO()
    io.to('admins').emit(event, payload)
    console.log(`[Notification] Emitted '${event}' to admins room`)
  } catch (error) {
    console.warn('[Notification Warning] Could not notify admins:', error.message)
  }
}
