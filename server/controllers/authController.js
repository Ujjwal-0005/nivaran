import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Municipality from '../models/Municipality.js'
import { sendOTPEmail, sendWelcomeEmail } from '../utils/sendEmail.js'

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Generate JWT token with tokenVersion
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      municipality: user.municipality || null,
      tokenVersion: user.tokenVersion ?? 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Register (Citizen only)
export const register = async (req, res) => {
  try {
    const { name, email, password, phone, state, city, municipality, homeAddress } = req.body

    // Validate municipality is required for citizen
    if (!municipality) {
      return res.status(400).json({ message: 'City/Municipality selection is required' })
    }

    const muniDoc = await Municipality.findOne({ _id: municipality, isActive: true })
    if (!muniDoc) {
      return res.status(400).json({ message: 'Invalid or inactive municipality selected' })
    }

    // Validate phone format (Indian format: +91XXXXXXXXXX) if provided
    if (phone && phone.trim() !== '') {
      const phoneRegex = /^\+91[0-9]{10}$/
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({ message: 'Invalid phone format. Use +91XXXXXXXXXX' })
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Generate OTP
    const otp = generateOTP()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    const lastOtpSentAt = new Date()

    // Create user - only include phone if provided
    const userData = {
      name,
      email,
      passwordHash,
      role: 'citizen',
      municipality: muniDoc._id,
      state: muniDoc.state || state,
      city: muniDoc.name || city,
      otp,
      otpExpiry,
      lastOtpSentAt,
      isVerified: false,
    }

    if (homeAddress && typeof homeAddress === 'object') {
      userData.homeAddress = {
        text: homeAddress.text || '',
        lat: typeof homeAddress.lat === 'number' ? homeAddress.lat : null,
        lng: typeof homeAddress.lng === 'number' ? homeAddress.lng : null,
      }
    }

    if (phone && phone.trim() !== '') {
      userData.phone = phone
    }

    const user = await User.create(userData)

    // Send OTP email
    await sendOTPEmail(email, otp)

    res.status(201).json({
      message: 'Registration successful. Please verify your email with the OTP sent to your email address.',
      email: user.email,
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Server error during registration' })
  }
}

// Verify OTP
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body

    const user = await User.findOne({ email }).populate('municipality')
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' })
    }

    // Check if OTP expired
    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired' })
    }

    // Verify user
    user.isVerified = true
    user.otp = undefined
    user.otpExpiry = undefined
    user.lastOtpSentAt = undefined
    await user.save()

    // Send welcome email
    await sendWelcomeEmail(email, user.name)

    // Generate JWT
    const token = generateToken(user)

    res.status(200).json({
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        municipality: user.municipality,
        homeAddress: user.homeAddress,
      },
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    res.status(500).json({ message: 'Server error during OTP verification' })
  }
}

// Resend OTP
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Rate limit: check if last OTP was sent less than 60 seconds ago
    if (user.lastOtpSentAt) {
      const timeSinceLastOtp = (new Date() - user.lastOtpSentAt) / 1000 // seconds
      if (timeSinceLastOtp < 60) {
        const remainingTime = Math.ceil(60 - timeSinceLastOtp)
        return res.status(429).json({
          message: `Please wait ${remainingTime} seconds before requesting another OTP`,
        })
      }
    }

    // Generate new OTP
    const otp = generateOTP()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    const lastOtpSentAt = new Date()

    user.otp = otp
    user.otpExpiry = otpExpiry
    user.lastOtpSentAt = lastOtpSentAt
    await user.save()

    // Send OTP email
    await sendOTPEmail(email, otp)

    res.status(200).json({ message: 'OTP sent successfully' })
  } catch (error) {
    console.error('Resend OTP error:', error)
    res.status(500).json({ message: 'Server error during OTP resend' })
  }
}

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email }).populate('municipality')
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in',
        requiresVerification: true,
      })
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    // Generate JWT
    const token = generateToken(user)

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        municipality: user.municipality,
        homeAddress: user.homeAddress,
        department: user.department,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error during login' })
  }
}
