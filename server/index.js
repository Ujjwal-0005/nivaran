import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

// Connect to MongoDB
connectDB()

// Middleware
app.use(cors())
app.use(express.json())

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/categories', categoryRoutes)

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: 'Something went wrong!' })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
