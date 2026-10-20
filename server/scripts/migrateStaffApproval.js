/**
 * Migration script: Set applicationStatus to 'approved' for existing staff users.
 * This is idempotent - running it multiple times is safe.
 *
 * Usage:
 *   node server/scripts/migrateStaffApproval.js
 *
 * Required env vars (loaded from server/.env):
 *   MONGO_URI
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import User from '../models/User.js'

// Load .env relative to the server/ directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const run = async () => {
  await connectDB()

  console.log('=== Staff Approval Migration ===')
  console.log('Setting applicationStatus to "approved" for existing staff users...')

  const result = await User.updateMany(
    { role: 'staff', applicationStatus: { $in: [null, undefined] } },
    { $set: { applicationStatus: 'approved' } }
  )

  console.log(`Updated ${result.modifiedCount} staff user(s) to applicationStatus: 'approved'`)

  if (result.modifiedCount === 0) {
    console.log('No staff users needed migration (all already have applicationStatus set).')
  }

  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
