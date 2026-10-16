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
import { initSlaCron } from './services/slaCron.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

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
app.use(express.json())

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

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (with Socket.io)`)
})
