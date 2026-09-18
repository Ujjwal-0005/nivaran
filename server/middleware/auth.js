import jwt from 'jsonwebtoken'

export const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
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
