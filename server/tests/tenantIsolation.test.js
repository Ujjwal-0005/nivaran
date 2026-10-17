import http from 'http'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { io as ClientIO } from 'socket.io-client'

import connectDB from '../config/db.js'
import { initSocket, getIO } from '../config/socket.js'
import { notifyAdmins } from '../utils/notify.js'

import authRoutes from '../routes/authRoutes.js'
import reportRoutes from '../routes/reportRoutes.js'
import categoryRoutes from '../routes/categoryRoutes.js'
import staffRoutes from '../routes/staffRoutes.js'
import departmentRoutes from '../routes/departmentRoutes.js'
import analyticsRoutes from '../routes/analyticsRoutes.js'
import publicRoutes from '../routes/publicRoutes.js'
import municipalityRoutes from '../routes/municipalityRoutes.js'

import Municipality from '../models/Municipality.js'
import Department from '../models/Department.js'
import Category from '../models/Category.js'
import User from '../models/User.js'
import Report from '../models/Report.js'

dotenv.config()

// Create test express app
const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/municipalities', municipalityRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/public', publicRoutes)

app.use((err, req, res, next) => {
  const status = err.statusCode || 500
  res.status(status).json({ message: err.message || 'Error' })
})

const server = http.createServer(app)
const ioServer = initSocket(server)

// Simple fetch wrapper
const request = async (port, method, path, token, body = null) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const options = { method, headers }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(`http://127.0.0.1:${port}${path}`, options)
  let data = null
  try {
    data = await res.json()
  } catch (e) {
    data = null
  }
  return { status: res.status, data }
}

const signToken = (user, customTokenVersion = null) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      municipality: user.municipality || null,
      tokenVersion: customTokenVersion !== null ? customTokenVersion : (user.tokenVersion ?? 0),
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${message}`)
  }
}

async function runTests() {
  console.log('=== Starting Tenant Isolation Test Suite ===\n')

  await connectDB()

  const port = 5055
  await new Promise((resolve) => server.listen(port, resolve))
  console.log(`Test server running on port ${port}`)

  try {
    // 1. Fetch the two seeded municipalities: Jalandhar & Phagwara
    const jalandhar = await Municipality.findOne({ name: 'Jalandhar' })
    const phagwara = await Municipality.findOne({ name: 'Phagwara' })
    assert(jalandhar && phagwara, 'Found seeded Jalandhar and Phagwara municipalities')

    // 2. Fetch users for each municipality
    const jAdmin = await User.findOne({ email: 'admin.jalandhar@nivaran.gov' })
    const pAdmin = await User.findOne({ email: 'admin.phagwara@nivaran.gov' })
    const jStaff = await User.findOne({ email: 'staff.roads.jalandhar@nivaran.gov' })
    const pStaff = await User.findOne({ email: 'staff.roads.phagwara@nivaran.gov' })
    const jCitizen = await User.findOne({ email: 'citizen1.jalandhar@example.com' })
    const pCitizen = await User.findOne({ email: 'citizen1.phagwara@example.com' })

    assert(jAdmin && pAdmin, 'Found admin users for both cities')
    assert(jStaff && pStaff, 'Found staff users for both cities')
    assert(jCitizen && pCitizen, 'Found citizen users for both cities')

    // 3. Create Superadmin user without municipality
    let superAdmin = await User.findOne({ email: 'superadmin.test@nivaran.gov' })
    if (!superAdmin) {
      superAdmin = await User.create({
        name: 'Super Admin',
        email: 'superadmin.test@nivaran.gov',
        passwordHash: 'dummyhash',
        role: 'superadmin',
        isVerified: true,
      })
    }

    const jAdminToken = signToken(jAdmin)
    const pAdminToken = signToken(pAdmin)
    const jStaffToken = signToken(jStaff)
    const pStaffToken = signToken(pStaff)
    const jCitizenToken = signToken(jCitizen)
    const pCitizenToken = signToken(pCitizen)
    const superAdminToken = signToken(superAdmin)

    // 4. Fetch reports from each municipality
    const jReport = await Report.findOne({ municipality: jalandhar._id })
    const pReport = await Report.findOne({ municipality: phagwara._id })
    assert(jReport && pReport, 'Found sample report for both cities')

    console.log('\n--- 1. Cross-City Report Isolation (:id endpoints) ---')
    // Jalandhar citizen / admin attempting to read Phagwara report detail
    const resGetPByJCitizen = await request(port, 'GET', `/api/reports/${pReport._id}`, jCitizenToken)
    assert(resGetPByJCitizen.status === 404, 'Jalandhar citizen reading Phagwara report returns 404')

    const resGetPByJAdmin = await request(port, 'GET', `/api/reports/${pReport._id}`, jAdminToken)
    assert(resGetPByJAdmin.status === 404, 'Jalandhar admin reading Phagwara report returns 404')

    // Jalandhar citizen attempting to upvote / join Phagwara report
    const resUpvoteCross = await request(port, 'POST', `/api/reports/${pReport._id}/upvote`, jCitizenToken)
    assert(resUpvoteCross.status === 404, 'Jalandhar citizen upvoting Phagwara report returns 404')

    const resJoinCross = await request(port, 'POST', `/api/reports/${pReport._id}/join`, jCitizenToken)
    assert(resJoinCross.status === 404, 'Jalandhar citizen joining Phagwara report returns 404')

    // Cross-city comments
    const resCommentCross = await request(port, 'POST', `/api/reports/${pReport._id}/comments`, jCitizenToken, {
      text: 'Cross city comment attempt',
    })
    assert(resCommentCross.status === 404, 'Cross-city comment attempt returns 404')

    // Cross-city dispute
    const resDisputeCross = await request(port, 'POST', `/api/reports/${pReport._id}/dispute`, jCitizenToken, {
      reason: 'Cross city dispute attempt',
    })
    assert(resDisputeCross.status === 404, 'Cross-city dispute attempt returns 404')

    // Cross-city admin assign
    const resAssignCross = await request(port, 'PATCH', `/api/reports/${pReport._id}/assign`, jAdminToken, {
      staffId: jStaff._id,
    })
    assert(resAssignCross.status === 404, 'Jalandhar admin assigning Phagwara report returns 404')

    // Cross-city admin resolve dispute
    const resResolveDispCross = await request(port, 'PATCH', `/api/reports/${pReport._id}/resolve-dispute`, jAdminToken, {
      action: 'mark_resolved',
      note: 'Illegal override',
    })
    assert(resResolveDispCross.status === 404, 'Jalandhar admin resolving Phagwara dispute returns 404')

    // Cross-city staff status update
    const resStatusCross = await request(port, 'PATCH', `/api/reports/${pReport._id}/status`, jStaffToken, {
      status: 'acknowledged',
    })
    assert(resStatusCross.status === 404, 'Jalandhar staff updating Phagwara report status returns 404')

    console.log('\n--- 2. List & Query Scoping (Reports, Staff, Departments, Analytics) ---')
    // Admin list of reports
    const resJReports = await request(port, 'GET', '/api/reports', jAdminToken)
    assert(resJReports.status === 200, 'Jalandhar admin successfully gets reports')
    const allJalandhar = resJReports.data.reports.every(
      (r) => r.municipality.toString() === jalandhar._id.toString()
    )
    assert(allJalandhar && resJReports.data.reports.length > 0, 'All reports returned to Jalandhar admin belong strictly to Jalandhar')

    // Staff list
    const resJStaff = await request(port, 'GET', '/api/staff', jAdminToken)
    assert(resJStaff.status === 200, 'Jalandhar admin successfully gets staff')
    const allJStaff = resJStaff.data.staff.every((s) => s.email.includes('jalandhar'))
    assert(allJStaff, 'All staff returned belong strictly to Jalandhar')

    // Cross-city staff history
    const resCrossStaffTickets = await request(port, 'GET', `/api/staff/${pStaff._id}/tickets`, jAdminToken)
    assert(resCrossStaffTickets.status === 404, 'Jalandhar admin requesting Phagwara staff tickets returns 404')

    // Departments list
    const resJDepts = await request(port, 'GET', '/api/departments', jAdminToken)
    const allJDepts = resJDepts.data.departments.every(
      (d) => d.municipality.toString() === jalandhar._id.toString()
    )
    assert(allJDepts, 'All departments returned belong strictly to caller municipality')

    // Analytics overview
    const resOverview = await request(port, 'GET', '/api/analytics/overview', jAdminToken)
    const countInJalandharDb = await Report.countDocuments({ municipality: jalandhar._id })
    assert(resOverview.data.totalReports === countInJalandharDb, 'Analytics overview total matches exactly Jalandhar report count')

    console.log('\n--- 3. Nearby & Duplicate Isolation ---')
    // Jalandhar user nearby query at Jalandhar centroid should NEVER return Phagwara reports
    const resNearby = await request(
      port,
      'GET',
      `/api/reports/nearby?lat=${jalandhar.centroid.lat}&lng=${jalandhar.centroid.lng}&radius=50000`,
      jCitizenToken
    )
    const anyPhagwaraNearby = resNearby.data.reports.some(
      (r) => r.ticketId.includes('PHA')
    )
    assert(!anyPhagwaraNearby, 'Nearby reports query for Jalandhar citizen never includes Phagwara reports')

    console.log('\n--- 4. Token Version & Superadmin Restrictions ---')
    // Token with old tokenVersion rejected
    const expiredToken = signToken(jCitizen, 999)
    const resExpired = await request(port, 'GET', '/api/reports/mine', expiredToken)
    assert(resExpired.status === 401, 'Token with old/mismatched tokenVersion is rejected (401)')

    // Superadmin has no municipality and is refused by report routes
    const resSuperAdminReports = await request(port, 'GET', '/api/reports', superAdminToken)
    assert(resSuperAdminReports.status === 403, 'Superadmin token is refused (403) by report routes')

    const resSuperAdminMine = await request(port, 'GET', '/api/reports/mine', superAdminToken)
    assert(resSuperAdminMine.status === 403, 'Superadmin token is refused (403) by citizen report routes')

    console.log('\n--- 5. Socket.io Authentication & Tenant Room Isolation ---')
    const socketUrl = `http://127.0.0.1:${port}`

    // 5a. Socket without token rejected
    const noTokenSocket = ClientIO(socketUrl, {
      transports: ['websocket'],
      autoConnect: false,
    })
    const noTokenErr = await new Promise((resolve) => {
      noTokenSocket.on('connect_error', (err) => resolve(err.message))
      noTokenSocket.connect()
    })
    assert(noTokenErr.includes('Authentication error'), 'Socket without valid token is rejected')
    noTokenSocket.close()

    // 5b. Socket with wrong tokenVersion rejected
    const badVerSocket = ClientIO(socketUrl, {
      auth: { token: expiredToken },
      transports: ['websocket'],
      autoConnect: false,
    })
    const badVerErr = await new Promise((resolve) => {
      badVerSocket.on('connect_error', (err) => resolve(err.message))
      badVerSocket.connect()
    })
    assert(badVerErr.includes('Authentication error'), 'Socket with bad tokenVersion is rejected')
    badVerSocket.close()

    // 5c. Jalandhar Admin socket connects and joins muni:<jalandharId>:admins room
    const jAdminSocket = ClientIO(socketUrl, {
      auth: { token: jAdminToken },
      transports: ['websocket'],
    })
    await new Promise((resolve) => jAdminSocket.on('connect', resolve))

    // Phagwara Admin socket connects
    const pAdminSocket = ClientIO(socketUrl, {
      auth: { token: pAdminToken },
      transports: ['websocket'],
    })
    await new Promise((resolve) => pAdminSocket.on('connect', resolve))

    let jReceived = false
    let pReceived = false

    jAdminSocket.on('test_tenant_alert', () => { jReceived = true })
    pAdminSocket.on('test_tenant_alert', () => { pReceived = true })

    // Emit event specifically to Jalandhar admins
    await notifyAdmins(jalandhar._id, 'test_tenant_alert', { msg: 'Jalandhar Alert Only' })

    // Wait 400ms for websocket delivery
    await new Promise((r) => setTimeout(r, 400))

    assert(jReceived === true, 'Jalandhar admin received event targeted to Jalandhar')
    assert(pReceived === false, 'Phagwara admin NEVER received Jalandhar event (Room isolation verified)')

    jAdminSocket.close()
    pAdminSocket.close()

    console.log(`\n========================================`)
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`)
    console.log(`========================================\n`)

    if (failed > 0) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (err) {
    console.error('Test execution error:', err)
    process.exit(1)
  }
}

runTests()
