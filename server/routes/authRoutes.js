import express from 'express'
import { register, verifyOTP, resendOTP, login } from '../controllers/authController.js'

const router = express.Router()

router.post('/register', register)
router.post('/verify-otp', verifyOTP)
router.post('/resend-otp', resendOTP)
router.post('/login', login)

export default router
