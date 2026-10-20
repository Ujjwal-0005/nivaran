/**
 * server/scripts/syncIndexes.js
 *
 * Ensures all indexes defined across Mongoose models are synchronized with the database.
 */

import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import Report from '../models/Report.js'
import User from '../models/User.js'
import Department from '../models/Department.js'
import Category from '../models/Category.js'
import CategoryConfig from '../models/CategoryConfig.js'
import Municipality from '../models/Municipality.js'
import CityRequest from '../models/CityRequest.js'
import AuditLog from '../models/AuditLog.js'
import { connectTestDB, disconnectTestDB } from '../tests/helpers/testDb.js'
import connectDB from '../config/db.js'

async function syncAllIndexes() {
  if (process.env.NODE_ENV === 'test') {
    await connectTestDB()
  } else {
    await connectDB()
  }

  const models = [
    { name: 'Report', model: Report },
    { name: 'User', model: User },
    { name: 'Department', model: Department },
    { name: 'Category', model: Category },
    { name: 'CategoryConfig', model: CategoryConfig },
    { name: 'Municipality', model: Municipality },
    { name: 'CityRequest', model: CityRequest },
    { name: 'AuditLog', model: AuditLog },
  ]

  for (const { name, model } of models) {
    try {
      console.log(`Syncing indexes for collection: ${model.collection.name} (${name})...`)
      await model.syncIndexes()
      const indexes = await model.collection.indexes()
      console.log(`  ✓ Synced ${indexes.length} indexes for ${name}:`)
      indexes.forEach((idx) => {
        console.log(`    - ${idx.name}: ${JSON.stringify(idx.key)}`)
      })
    } catch (err) {
      console.error(`  ❌ Error syncing indexes for ${name}:`, err.message)
    }
  }

  if (process.env.NODE_ENV === 'test') {
    await disconnectTestDB()
  } else {
    await mongoose.disconnect()
  }
  console.log('\nAll model indexes synchronized successfully.')
}

syncAllIndexes().catch((err) => {
  console.error('Fatal syncIndexes error:', err)
  process.exit(1)
})
