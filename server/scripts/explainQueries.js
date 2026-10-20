/**
 * server/scripts/explainQueries.js
 *
 * Prompt 7 Part 2:
 * Seeds 3,000 synthetic reports into the test database (isolated namespace),
 * then executes MongoDB explain('executionStats') on all frequent query patterns:
 *   1. Admin reports list: { municipality, status }
 *   2. Department reports list: { municipality, department, status }
 *   3. Citizen own reports list: { citizen, createdAt }
 *   4. Nearby spatial prefilter: { geoPoint: '2dsphere' }
 *   5. SLA cron scan: { municipality, isEscalated, slaDeadline }
 *
 * Verifies winningPlan stage is IXSCAN (no COLLSCAN) and logs execution stats.
 * Automatically cleans up the 3,000 synthetic test reports at the end.
 */

import dotenv from 'dotenv'
dotenv.config()

import { connectTestDB, disconnectTestDB } from '../tests/helpers/testDb.js'
import mongoose from 'mongoose'
import Report from '../models/Report.js'
import Municipality from '../models/Municipality.js'
import User from '../models/User.js'
import Category from '../models/Category.js'
import Department from '../models/Department.js'

async function runExplainQueries() {
  console.log(`\n==================================================`)
  console.log(`🚀 Starting Query Explain Benchmarks (Prompt 7 Part 2)`)
  console.log(`==================================================\n`)

  await connectTestDB()

  const muni = await Municipality.findOne({ isActive: true })
  if (!muni) throw new Error('Active municipality required. Run npm run db:fresh:test first.')

  const citizen = await User.findOne({ municipality: muni._id, role: 'citizen' })
  const category = await Category.findOne({ isActive: true })
  const department = await Department.findOne({ municipality: muni._id, isActive: true })

  console.log(`[Seed] Generating 3,000 synthetic test reports...`)
  const BATCH_SIZE = 500
  const TOTAL_REPORTS = 3000
  const syntheticMarker = 'SYNTHETIC_SCALE_TEST'

  for (let b = 0; b < TOTAL_REPORTS; b += BATCH_SIZE) {
    const batch = []
    for (let i = 0; i < BATCH_SIZE; i++) {
      const idx = b + i
      batch.push({
        ticketId: `SYN-${idx}-${Date.now()}`,
        municipality: muni._id,
        citizen: citizen ? citizen._id : new mongoose.Types.ObjectId(),
        category: category ? category._id : new mongoose.Types.ObjectId(),
        department: department ? department._id : new mongoose.Types.ObjectId(),
        description: `${syntheticMarker} civic report #${idx}`,
        status: idx % 3 === 0 ? 'resolved' : idx % 3 === 1 ? 'in_progress' : 'reported',
        location: {
          lat: 31.326 + (Math.random() - 0.5) * 0.1,
          lng: 75.576 + (Math.random() - 0.5) * 0.1,
        },
        geoPoint: {
          type: 'Point',
          coordinates: [
            75.576 + (Math.random() - 0.5) * 0.1,
            31.326 + (Math.random() - 0.5) * 0.1,
          ],
        },
        priorityScore: Math.floor(Math.random() * 80),
        reportCount: 1,
        isEscalated: idx % 10 === 0,
        slaDeadline: new Date(Date.now() + (idx % 5) * 3600000),
        createdAt: new Date(Date.now() - idx * 60000),
      })
    }
    await Report.insertMany(batch)
  }

  const seededCount = await Report.countDocuments({ description: new RegExp(syntheticMarker) })
  console.log(`[Seed] Successfully inserted ${seededCount} synthetic reports in test DB.\n`)

  const testQueries = [
    {
      name: 'Admin All Reports Filter (municipality + status)',
      fn: () => Report.find({ municipality: muni._id, status: 'reported' }).sort({ createdAt: -1 }),
    },
    {
      name: 'Department Queue Filter (municipality + department + status)',
      fn: () => Report.find({ municipality: muni._id, department: department?._id, status: 'in_progress' }),
    },
    {
      name: 'Citizen Own Reports (citizen + createdAt)',
      fn: () => Report.find({ citizen: citizen?._id }).sort({ createdAt: -1 }),
    },
    {
      name: 'SLA Escalation Cron Query (municipality + isEscalated + slaDeadline)',
      fn: () => Report.find({ municipality: muni._id, isEscalated: false, slaDeadline: { $lte: new Date() } }),
    },
    {
      name: 'Geo duplicate prefilter (geoPoint 2dsphere $nearSphere)',
      fn: () => Report.find({
        geoPoint: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [75.576, 31.326] },
            $maxDistance: 100,
          },
        },
      }),
    },
  ]

  let allIndexesUsed = true

  console.log('─────────────────────────────────────────────────────────────────────────────')
  console.log('Query Performance & Explain Plans')
  console.log('─────────────────────────────────────────────────────────────────────────────')

  for (const q of testQueries) {
    const explainResult = await q.fn().explain('executionStats')
    const winningPlan = explainResult.queryPlanner?.winningPlan || {}
    const stats = explainResult.executionStats || {}

    // Find deepest stage
    let stage = winningPlan.stage
    let inputStage = winningPlan.inputStage
    while (inputStage) {
      if (inputStage.stage) stage = `${inputStage.stage} -> ${stage}`
      inputStage = inputStage.inputStage
    }

    const isIndexScan = stage.includes('IXSCAN') || stage.includes('GEO_NEAR_2DSPHERE')
    const hasCollScan = stage.includes('COLLSCAN')

    console.log(`\n🔍 ${q.name}`)
    console.log(`   Stage Plan:             ${stage}`)
    console.log(`   Index Backed:           ${isIndexScan ? '✅ YES' : '❌ NO'}`)
    console.log(`   No Full CollScan:       ${!hasCollScan ? '✅ PASS' : '❌ FAIL (COLLSCAN)'}`)
    console.log(`   Docs Examined:          ${stats.totalDocsExamined}`)
    console.log(`   Docs Returned:          ${stats.nReturned}`)
    console.log(`   Execution Time:         ${stats.executionTimeMillis} ms`)

    if (hasCollScan || !isIndexScan) {
      allIndexesUsed = false
    }
  }

  console.log('\n[Cleanup] Removing 3,000 synthetic test reports...')
  await Report.deleteMany({ description: new RegExp(syntheticMarker) })
  console.log('[Cleanup] Cleanup complete.')

  await disconnectTestDB()

  console.log('\n─────────────────────────────────────────────────────────────────────────────')
  if (!allIndexesUsed) {
    console.error('❌ One or more queries did not use indexes!')
    process.exit(1)
  } else {
    console.log('🎉 ALL QUERIES PROVEN BACKED BY INDEXES (0 COLLSCANS)')
    console.log('─────────────────────────────────────────────────────────────────────────────\n')
  }
}

runExplainQueries().catch((err) => {
  console.error('Fatal explainQueries error:', err)
  process.exit(1)
})
