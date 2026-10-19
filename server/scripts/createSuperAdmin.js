/**
 * One-time bootstrap script: create the platform Super Admin account.
 *
 * Usage:
 *   node scripts/createSuperAdmin.js
 *
 * Required env vars (loaded from server/.env):
 *   MONGO_URI, JWT_SECRET
 *
 * Optional env vars:
 *   SUPERADMIN_EMAIL   (default: superadmin@nivaran.gov)
 *   SUPERADMIN_NAME    (default: Super Admin)
 *   SUPERADMIN_PASS    (default: SuperAdmin@123)
 *
 * The script is idempotent: running it again only updates the name/password.
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import User from '../models/User.js'

// Load .env relative to the server/ directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const EMAIL = (process.env.SUPERADMIN_EMAIL || 'superadmin@nivaran.gov').toLowerCase().trim()
const NAME = process.env.SUPERADMIN_NAME || 'Super Admin'
const PASS = process.env.SUPERADMIN_PASS || 'SuperAdmin@123'

const run = async () => {
  await connectDB()

  const existing = await User.findOne({ email: EMAIL })
  const passwordHash = await bcrypt.hash(PASS, 12)

  if (existing) {
    if (existing.role !== 'superadmin') {
      console.error(`ERROR: ${EMAIL} already exists with role "${existing.role}". Aborting.`)
      process.exit(1)
    }
    existing.name = NAME
    existing.passwordHash = passwordHash
    existing.isVerified = true
    existing.isActive = true
    existing.tokenVersion = (existing.tokenVersion ?? 0) + 1
    await existing.save()
    console.log(`Super Admin updated: ${EMAIL}`)
  } else {
    await User.create({
      name: NAME,
      email: EMAIL,
      passwordHash,
      role: 'superadmin',
      municipality: null,
      isVerified: true,
      isActive: true,
      tokenVersion: 0,
    })
    console.log(`Super Admin created: ${EMAIL}`)
  }

  console.log(`\nCredentials`)
  console.log(`  Email   : ${EMAIL}`)
  console.log(`  Password: ${PASS}`)
  console.log(`\nKEEP THESE CREDENTIALS SECURE AND CHANGE THE PASSWORD AFTER FIRST LOGIN.`)

  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error('createSuperAdmin failed:', err.message)
  process.exit(1)
})
