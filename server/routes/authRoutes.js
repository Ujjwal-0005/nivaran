import express from 'express'
import { register, verifyOTP, resendOTP, login, setPassword } from '../controllers/authController.js'

const router = express.Router()

router.post('/register', register)
router.post('/verify-otp', verifyOTP)
router.post('/resend-otp', resendOTP)
router.post('/login', login)
router.post('/set-password', setPassword)

export default router
