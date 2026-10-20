import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Municipality from '../models/Municipality.js'
import Department from '../models/Department.js'
import AuditLog from '../models/AuditLog.js'
import { sendOTPEmail, sendWelcomeEmail } from '../utils/sendEmail.js'
import { notifyAdmins } from '../utils/notify.js'
import { getCityStatus } from '../utils/cityStatus.js'

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

// Register (Citizen or Staff only - Step 3)
export const register = async (req, res) => {
  try {
    const { name, email, password, phone, state, city, municipality, homeAddress, role, department, employeeId, designation } = req.body

    // Validate role - only citizen or staff allowed
    if (!role || !['citizen', 'staff'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Only citizen or staff registration is allowed.' })
    }

    // Validate municipality is required
    if (!municipality) {
      return res.status(400).json({ message: 'City/Municipality selection is required' })
    }

    const muniDoc = await Municipality.findOne({ _id: municipality })
    if (!muniDoc) {
      return res.status(400).json({ message: 'Invalid or inactive municipality selected' })
    }

    const { isLive } = await getCityStatus(muniDoc._id)
    if (!isLive) {
      return res.status(403).json({ message: 'This city is not live on Nivaran yet' })
    }

    // Staff-specific validations
    let deptDoc = null
    if (role === 'staff') {
      // Department is required for staff
      if (!department) {
        return res.status(400).json({ message: 'Department selection is required for staff registration' })
      }

      // Validate department belongs to the chosen municipality
      deptDoc = await Department.findOne({ _id: department, municipality: muniDoc._id })
      if (!deptDoc) {
        return res.status(400).json({ message: 'Invalid department for the selected municipality' })
      }
      if (deptDoc.isExternal) {
        return res.status(400).json({ message: 'Staff cannot be registered for an external agency department' })
      }

      // employeeId is required for staff
      if (!employeeId || !employeeId.trim()) {
        return res.status(400).json({ message: 'Employee ID is required for staff registration' })
      }

      // designation is required for staff
      if (!designation || !designation.trim()) {
        return res.status(400).json({ message: 'Designation is required for staff registration' })
      }

      // Check for duplicate employeeId in the same municipality
      const existingEmployeeId = await User.findOne({
        municipality: muniDoc._id,
        employeeId: employeeId.trim(),
      })
      if (existingEmployeeId) {
        return res.status(409).json({ message: 'Employee ID already exists in this municipality' })
      }
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
      return res.status(409).json({ message: 'Email already registered' })
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
      role,
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

    // Staff-specific fields
    if (role === 'staff') {
      userData.department = department
      userData.employeeId = employeeId.trim()
      userData.designation = designation.trim()
      userData.applicationStatus = 'pending'
      userData.appliedAt = new Date()
    }

    const user = await User.create(userData)

    // Send OTP email
    await sendOTPEmail(email, otp)

    // Step 3: Emit real-time notification to admins for new staff application
    if (role === 'staff') {
      await notifyAdmins(muniDoc._id, 'staff_application', {
        applicantId: user._id,
        name: user.name,
        email: user.email,
        department: deptDoc?.name || 'Department',
        employeeId: user.employeeId,
        municipality: muniDoc.name,
        message: `New staff application from ${user.name} (${user.employeeId})`,
      })

      // Write audit log for staff application
      await AuditLog.create({
        actor: user._id,
        actorEmail: user.email,
        action: 'staff.apply',
        targetMunicipality: muniDoc._id,
        targetUser: user._id,
        meta: {
          email: user.email,
          employeeId: user.employeeId,
          department: deptDoc?.name,
        },
      })
    }

    res.status(201).json({
      message: 'Registration successful. Please verify your email with the OTP sent to your email address.',
      email: user.email,
      role: user.role,
    })
  } catch (error) {
    console.error('Register error:', error)
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email or Employee ID already exists' })
    }
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

    // Step 3: For staff, do NOT issue token if status is pending or rejected
    if (user.role === 'staff') {
      if (user.applicationStatus === 'pending') {
        return res.status(200).json({
          message: 'Email verified successfully. Your application is waiting for approval by the city administration.',
          requiresApproval: true,
          applicationStatus: 'pending',
        })
      }
      if (user.applicationStatus === 'rejected') {
        return res.status(403).json({
          message: `Your application has been rejected. ${user.rejectionReason || 'Contact the city administration for more information.'}`,
          applicationStatus: 'rejected',
          rejectionReason: user.rejectionReason,
        })
      }
    }

    // Generate JWT for citizens and approved staff
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

    // Reject inactive accounts
    if (user.isActive === false) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact the Super Admin.' })
    }

    // Step 3: Check staff application status
    if (user.role === 'staff') {
      if (user.applicationStatus === 'pending') {
        const cityName = user.municipality?.name || 'your city'
        return res.status(403).json({
          message: `Your application is waiting for approval by the ${cityName} administration.`,
          applicationStatus: 'pending',
        })
      }
      if (user.applicationStatus === 'rejected') {
        return res.status(403).json({
          message: user.rejectionReason || 'Your application has been rejected. Contact the city administration for more information.',
          applicationStatus: 'rejected',
          rejectionReason: user.rejectionReason,
        })
      }
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

// Set Password (city admin invite flow – token-based, no old password needed)
export const setPassword = async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token) return res.status(400).json({ message: 'token is required' })
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters' })
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
    const user = await User.findOne({
      passwordSetToken: hashedToken,
      passwordSetTokenExpiry: { $gt: new Date() },
    }).populate('municipality')

    if (!user || !user.passwordSetToken) {
      return res.status(400).json({ message: 'Invalid or expired set-password link' })
    }

    const storedBuf = Buffer.from(user.passwordSetToken, 'hex')
    const providedBuf = Buffer.from(hashedToken, 'hex')
    if (storedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(storedBuf, providedBuf)) {
      return res.status(400).json({ message: 'Invalid or expired set-password link' })
    }

    // Set new password
    user.passwordHash = await bcrypt.hash(password, 12)
    user.passwordSetToken = null
    user.passwordSetTokenExpiry = null
    user.isVerified = true
    user.tokenVersion = (user.tokenVersion ?? 0) + 1
    await user.save()

    const jwtToken = generateToken(user)

    res.status(200).json({
      message: 'Password set successfully. You are now logged in.',
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        municipality: user.municipality,
      },
    })
  } catch (error) {
    console.error('setPassword error:', error)
    res.status(500).json({ message: 'Server error during password setup' })
  }
}

