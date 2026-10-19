import rateLimit from 'express-rate-limit'

/**
 * Express rate limiters for Nivaran API
 * Configurable via environment variables with production-ready defaults.
 */

// 1. Strict limit for sensitive auth endpoints: login, verify-otp, register, set-password
// Default: 10 requests per 15 minutes per IP (keyed by IP + email if provided)
const authWindowMs = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000
const authMax = parseInt(process.env.RATE_LIMIT_AUTH_MAX) || 10

export const authLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : ''
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    return email ? `${ip}_${email}` : ip
  },
  message: {
    message: 'Too many requests to this endpoint. Please try again after 15 minutes.',
  },
})

// 2. Moderate limit for SuperAdmin mutating requests
// Default: 60 requests per 15 minutes
const superadminWindowMs = parseInt(process.env.RATE_LIMIT_SUPERADMIN_WINDOW_MS) || 15 * 60 * 1000
const superadminMax = parseInt(process.env.RATE_LIMIT_SUPERADMIN_MAX) || 60

export const superadminWriteLimiter = rateLimit({
  windowMs: superadminWindowMs,
  max: superadminMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many administrative requests. Please slow down.',
  },
})

// 3. General limit across remaining API endpoints
// Default: 300 requests per 15 minutes
const generalWindowMs = parseInt(process.env.RATE_LIMIT_GENERAL_WINDOW_MS) || 15 * 60 * 1000
const generalMax = parseInt(process.env.RATE_LIMIT_GENERAL_MAX) || 300

export const generalLimiter = rateLimit({
  windowMs: generalWindowMs,
  max: generalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests from this IP. Please try again later.',
  },
})
