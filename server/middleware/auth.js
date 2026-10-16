import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Load user from database to verify status, municipality, and tokenVersion
    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    // Check tokenVersion (defaults to 0 if missing in old tokens or db)
    const tokenVersionInToken = decoded.tokenVersion ?? 0
    const userTokenVersion = user.tokenVersion ?? 0
    if (tokenVersionInToken !== userTokenVersion) {
      return res.status(401).json({ message: 'Session expired, please login again' })
    }

    req.user = {
      _id: user._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      municipality: user.municipality || null,
      department: user.department || null,
    }

    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' })
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' })
    }
    console.error('Auth middleware error:', error)
    res.status(500).json({ message: 'Server error during authentication' })
  }
}
