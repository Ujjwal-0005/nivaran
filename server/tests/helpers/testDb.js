/**
 * testDb.js — Safe test-database guard and connection helper
 *
 * Rules enforced BEFORE any connection is made:
 *  1. MONGO_URI_TEST must be present and non-empty.
 *  2. MONGO_URI_TEST must NOT equal MONGO_URI (prevents running against the real DB).
 *  3. The database name portion of MONGO_URI_TEST must contain "test" (case-insensitive).
 *
 * The URI itself is NEVER logged. Only the database name is printed.
 *
 * This helper also overrides process.env.MONGO_URI with MONGO_URI_TEST so that
 * existing code (connectDB, models) transparently uses the test database when
 * tests import this helper first.
 *
 * Usage (call BEFORE any other import that touches mongoose):
 *   import { connectTestDB, disconnectTestDB } from './helpers/testDb.js'
 *   await connectTestDB()    // call once in suite setup
 *   await disconnectTestDB() // call in finally / after-all hook
 */

import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

// ── Load server/.env the same way the app does ──────────────────────────────
// File lives at server/tests/helpers/testDb.js; server/.env is two dirs up.
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const envPath    = path.resolve(__dirname, '..', '..', '.env')

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts the database name from a MongoDB URI.
 * Works for both mongodb:// and mongodb+srv:// schemes.
 */
function extractDbName(uri) {
  try {
    const withoutQuery = uri.split('?')[0]
    const parts = withoutQuery.split('/')
    // For srv:  ['', '', 'cluster.host', 'dbname']
    // Standard: ['', '', 'host:port',   'dbname']
    const dbName = parts[parts.length - 1]
    return dbName || null
  } catch {
    return null
  }
}

// ── Guard ─────────────────────────────────────────────────────────────────────
function validateAndOverride() {
  const testUri = process.env.MONGO_URI_TEST
  const realUri = process.env.MONGO_URI

  // 1. Must be set and non-empty
  if (!testUri || testUri.trim() === '') {
    console.error(
      '\n❌ TEST GUARD: MONGO_URI_TEST is not set or is empty.\n' +
      '   Add MONGO_URI_TEST=<your-test-db-uri> to server/.env\n' +
      '   or export it in the current shell session before running tests.\n' +
      '   The test database URI must be DIFFERENT from MONGO_URI.\n'
    )
    process.exit(1)
  }

  const trimmedTestUri = testUri.trim()

  // 2. Must not equal the real MONGO_URI
  if (realUri && trimmedTestUri === realUri.trim()) {
    const dbName = extractDbName(trimmedTestUri) || '(unknown)'
    console.error(
      '\n❌ TEST GUARD: MONGO_URI_TEST is identical to MONGO_URI.\n' +
      `   Both point to the same database: "${dbName}"\n` +
      '   Tests MUST use a separate test database — never the real one.\n' +
      '   Set MONGO_URI_TEST to a different URI (e.g. with a "_test" suffix on the DB name).\n'
    )
    process.exit(1)
  }

  // 3. The database name must include "test" (case-insensitive)
  const dbName = extractDbName(trimmedTestUri)
  if (!dbName || !dbName.toLowerCase().includes('test')) {
    console.error(
      '\n❌ TEST GUARD: The database name in MONGO_URI_TEST does not contain "test".\n' +
      `   Detected database name: "${dbName || '(none)'}"\n` +
      '   Rename your test database so its name includes "test"\n' +
      '   (e.g. "nivaran_test", "testdb", "myapp-test").\n'
    )
    process.exit(1)
  }

  // ── Override MONGO_URI so that connectDB() and any imported model ──────────
  // transparently connects to the test database without touching the real one.
  process.env.MONGO_URI = trimmedTestUri

  return { uri: trimmedTestUri, dbName }
}

// ── Exported state ────────────────────────────────────────────────────────────
let _dbName = null

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validates MONGO_URI_TEST, overrides process.env.MONGO_URI with it, and
 * connects Mongoose to the test database.
 * Exits the process with a clear message if any guard condition fails.
 * Logs only the database name — NEVER the URI.
 */
export async function connectTestDB() {
  const { uri, dbName } = validateAndOverride()
  _dbName = dbName

  if (mongoose.connection.readyState === 1) {
    // Already connected (e.g. connectDB() was called before us via an import)
    return
  }

  try {
    await mongoose.connect(uri)
    console.log(`[testDb] Connected to test database: "${dbName}"`)
  } catch (err) {
    console.error(`[testDb] Failed to connect to test database "${dbName}": ${err.message}`)
    process.exit(1)
  }
}

/**
 * Disconnects Mongoose from the test database.
 * Safe to call even if not connected.
 */
export async function disconnectTestDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
    console.log('[testDb] Disconnected from test database.')
  }
}

/**
 * Returns the database name that was validated (for logging purposes only).
 */
export function getTestDbName() {
  return _dbName
}
