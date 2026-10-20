import http from 'http'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './config/db.js'
import { initSocket } from './config/socket.js'
import authRoutes from './routes/authRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import staffRoutes from './routes/staffRoutes.js'
import departmentRoutes from './routes/departmentRoutes.js'
import analyticsRoutes from './routes/analyticsRoutes.js'
import publicRoutes from './routes/publicRoutes.js'
import municipalityRoutes from './routes/municipalityRoutes.js'
import superadminRoutes from './routes/superadminRoutes.js'
import adminCategoryConfigRoutes from './routes/adminCategoryConfigRoutes.js'
import adminDepartmentRoutes from './routes/adminDepartmentRoutes.js'
import setupStatusRoutes from './routes/setupStatusRoutes.js'
import cityRequestRoutes from './routes/cityRequestRoutes.js'
import { initSlaCron } from './services/slaCron.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

import helmet from 'helmet'
import compression from 'compression'
import mongoose from 'mongoose'
import { authLimiter, generalLimiter } from './middleware/rateLimiters.js'

const app = express()

// Trust first proxy (Render / Cloudflare / reverse proxy)
app.set('trust proxy', 1)

// HTTP compression
app.use(compression())

// Helmet security headers
app.use(helmet())

// Connect to MongoDB
connectDB()

// Initialize SLA Escalation Cron (Phase 7)
initSlaCron()

// CORS origins from CLIENT_URL (comma-separated, no wildcard)
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:5173']

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`))
    },
    credentials: true,
  })
)

// JSON parser with 10mb body limit (bounded against denial-of-service)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// General rate limiter across all /api endpoints
app.use('/api', generalLimiter)

// Cache-Control headers for static & public catalog/transparency endpoints only (max-age=60, stale-while-revalidate=120)
app.use(['/api/public', '/api/municipalities'], (req, res, next) => {
  if (req.method === 'GET' && !req.headers.authorization) {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
  }
  next()
})

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/municipalities', municipalityRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/public', publicRoutes)
app.use('/api/superadmin', superadminRoutes)
app.use('/api/admin/category-settings', adminCategoryConfigRoutes)
app.use('/api/admin/departments', adminDepartmentRoutes)
app.use('/api/admin/setup-status', setupStatusRoutes)
app.use('/api/city-requests', cityRequestRoutes)

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack || err.message)
  const status = err.statusCode || 500
  res.status(status).json({ message: err.message || 'Something went wrong!' })
})

const PORT = process.env.PORT || 5000

// Create HTTP server for Express and Socket.io
const httpServer = http.createServer(app)
initSocket(httpServer)

const serverInstance = httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (with Socket.io)`)
})

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`)
  serverInstance.close(async () => {
    console.log('HTTP server closed.')
    try {
      await mongoose.connection.close(false)
      console.log('MongoDB connection closed cleanly.')
      process.exit(0)
    } catch (err) {
      console.error('Error during shutdown:', err)
      process.exit(1)
    }
  })

  // Force close if graceful shutdown hangs
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down')
    process.exit(1)
  }, 10000).unref()
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

