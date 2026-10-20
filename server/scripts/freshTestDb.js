/**
 * server/scripts/freshTestDb.js
 *
 * Safely clears all collections in the test database and re-runs seedDatabase()
 * against it. Refuses to run against the production database.
 *
 * Rules:
 * - MONGO_URI_TEST must be set.
 * - MONGO_URI_TEST must differ from MONGO_URI.
 * - Database name must contain "test".
 * - Never prints raw connection strings or secrets.
 */

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { seedDatabase } from '../seed.js'

dotenv.config()

const rawTestUri = process.env.MONGO_URI_TEST
const rawProdUri = process.env.MONGO_URI

if (!rawTestUri || !rawTestUri.trim()) {
  console.error('[freshTestDb] FATAL: MONGO_URI_TEST is not set.')
  process.exit(1)
}

const testUri = rawTestUri.trim()
const prodUri = rawProdUri ? rawProdUri.trim() : ''

// Normalize for comparison (remove trailing slashes, auth credentials)
const normalize = (u) => u.replace(/^mongodb(\+srv)?:\/\/[^@]+@/, '').replace(/\/$/, '')

if (prodUri && normalize(testUri) === normalize(prodUri)) {
  console.error('[freshTestDb] FATAL: MONGO_URI_TEST points to the same database as MONGO_URI.')
  process.exit(1)
}

// Extract database name
let dbName = ''
try {
  const parsed = new URL(testUri.replace(/^mongodb(\+srv)?:\/\//, 'http://'))
  dbName = parsed.pathname.replace(/^\//, '').split('?')[0]
} catch {
  const parts = testUri.split('?')[0].split('/')
  dbName = parts[parts.length - 1]
}

if (!dbName.toLowerCase().includes('test')) {
  console.error(`[freshTestDb] FATAL: Database name "${dbName}" does not contain "test". Refusing to run.`)
  process.exit(1)
}

console.log(`[freshTestDb] Resetting and seeding test database: "${dbName}"`)

// Override MONGO_URI so seedDatabase() connects to the test database
process.env.MONGO_URI = testUri

try {
  const conn = await mongoose.connect(testUri)

  const collections = await conn.connection.db.collections()
  for (const col of collections) {
    await col.deleteMany({})
    console.log(`  Cleared collection: ${col.collectionName}`)
  }

  await conn.disconnect()

  console.log(`[freshTestDb] Cleared all collections. Running seedDatabase()...`)
  await seedDatabase()

  console.log(`[freshTestDb] Test database "${dbName}" fresh seed complete.`)
  process.exit(0)
} catch (err) {
  console.error('[freshTestDb] Error during test database reset:', err.message)
  process.exit(1)
}
