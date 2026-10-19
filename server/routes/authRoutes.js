import express from 'express'
import { register, verifyOTP, resendOTP, login, setPassword } from '../controllers/authController.js'
import { authLimiter } from '../middleware/rateLimiters.js'

const router = express.Router()

router.post('/register', authLimiter, register)
router.post('/verify-otp', authLimiter, verifyOTP)
router.post('/resend-otp', authLimiter, resendOTP)
router.post('/login', authLimiter, login)
router.post('/set-password', authLimiter, setPassword)

export default router
