import crypto from 'crypto'
import CityRequest from '../models/CityRequest.js'
import Municipality from '../models/Municipality.js'
import { getCityStatus } from '../utils/cityStatus.js'

// Known states from seed files or "Other"
const ALLOWED_STATES = ['Punjab', 'Other']

/**
 * Normalise city name for matching (lowercase, trimmed, collapse internal whitespace)
 */
const normalizeCityName = (str) => {
  return str.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * POST /api/city-requests
 * Public route to request a city to be added to Nivaran.
 * Body: { cityName, state, email? }
 */
export const createCityRequest = async (req, res) => {
  try {
    const { cityName, state, email } = req.body

    // 1. Validation
    if (!cityName || typeof cityName !== 'string') {
      return res.status(400).json({ message: 'City name is required' })
    }

    const trimmedCity = cityName.trim()
    if (trimmedCity.length < 2 || trimmedCity.length > 80) {
      return res.status(400).json({ message: 'City name must be between 2 and 80 characters' })
    }

    // Letters, spaces, dots, hyphens (supports accented/unicode letters and standard names)
    const validCityRegex = /^[\p{L}\s.\-()]+$/u
    if (!validCityRegex.test(trimmedCity)) {
      return res.status(400).json({ message: 'City name contains invalid characters' })
    }

    if (!state || typeof state !== 'string' || !ALLOWED_STATES.includes(state.trim())) {
      return res.status(400).json({ message: 'State is required and must be a valid state' })
    }

    const cleanState = state.trim()
    let emailHash = null

    if (email !== undefined && email !== null && String(email).trim() !== '') {
      const emailStr = String(email).trim().toLowerCase()
      // Basic email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailStr)) {
        return res.status(400).json({ message: 'Invalid email address format' })
      }
      emailHash = crypto.createHash('sha256').update(emailStr).digest('hex')
    }

    // 2. Check if the city is a catalog city that is ALREADY LIVE
    const normalized = normalizeCityName(trimmedCity)
    const existingMuni = await Municipality.findOne({
      state: cleanState,
      name: { $regex: new RegExp(`^${normalized}$`, 'i') },
    })

    if (existingMuni) {
      const { isLive } = await getCityStatus(existingMuni._id)
      if (isLive) {
        return res.status(409).json({ message: 'This city is already live' })
      }
    }

    // 3. Upsert / update CityRequest
    const existingRequest = await CityRequest.findOne({
      name: normalized,
      state: cleanState,
    })

    const now = new Date()

    if (existingRequest) {
      // Check if this email already counted
      let alreadyCounted = false
      if (emailHash) {
        alreadyCounted = existingRequest.requesters.some((r) => r.emailHash === emailHash)
      }

      if (!alreadyCounted) {
        existingRequest.requestCount += 1
        existingRequest.lastRequestedAt = now
        if (emailHash) {
          existingRequest.requesters.push({ emailHash, at: now })
        }
        await existingRequest.save()
      }
    } else {
      // Create new request
      const requesters = emailHash ? [{ emailHash, at: now }] : []
      await CityRequest.create({
        name: normalized,
        displayName: trimmedCity,
        state: cleanState,
        requestCount: 1,
        status: 'open',
        firstRequestedAt: now,
        lastRequestedAt: now,
        requesters,
      })
    }

    // Generic success message - does not reveal counts or whether request already existed
    res.status(200).json({
      message: 'Thank you for your interest! We have recorded your request for this city.',
    })
  } catch (err) {
    console.error('createCityRequest error:', err)
    res.status(500).json({ message: 'Server error recording city request' })
  }
}
