/**
 * server/utils/resolveCityFromPoint.js
 *
 * Derives the target municipality from a geographic pin (lat, lng).
 *
 * Algorithm (nearest-centroid approximation):
 *  1. Validate lat/lng are numbers within [-90,90] and [-180,180].
 *  2. Fetch all municipalities whose isActive is true.
 *  3. Compute live status for every candidate in a single bulk query (no N+1).
 *  4. Compute Haversine distance from the pin to each city's centroid.
 *  5. Pick the nearest city within CITY_MATCH_RADIUS_KM.
 *  6. Border rule: if the citizen's home city is live, within radius,
 *     and its distance is within HOME_PREFER_MARGIN_KM (5 km) of the nearest
 *     city's distance, prefer the home city to avoid penalising citizens near a
 *     boundary.
 *  7. Return a result object or null if nothing is in range.
 *
 * Known limitation: centroid-based matching is an approximation.
 * A city polygon or ward-boundary dataset (e.g. GeoJSON from Survey of India)
 * would replace this with a proper point-in-polygon test.  Until that data is
 * available this is an acceptable proxy for city-level routing.
 *
 * Environment variables:
 *  CITY_MATCH_RADIUS_KM  – how far from a centroid a pin can be and still
 *                          count as belonging to that city (default 25, range 1-100).
 *  HOME_PREFER_MARGIN_KM – within this distance of the nearest centroid the
 *                          home city is preferred (default 5, not configurable
 *                          externally to keep the logic simple).
 */

import Municipality from '../models/Municipality.js'
import { getBulkCityStatus } from './cityStatus.js'
import { haversineDistance } from '../algorithms/duplicateDetection.js'

// ── Constants ───────────────────────────────────────────────────────────────

const HOME_PREFER_MARGIN_KM = 5 // border-rule margin, not env-configurable

/**
 * Read and validate CITY_MATCH_RADIUS_KM from env.
 * Returns a number in [1, 100].  Default 25.
 */
export function getCityMatchRadiusKm() {
  const raw = process.env.CITY_MATCH_RADIUS_KM
  if (!raw) return 25
  const n = parseFloat(raw)
  if (isNaN(n) || n < 1 || n > 100) {
    console.warn(`[resolveCityFromPoint] CITY_MATCH_RADIUS_KM="${raw}" is invalid (must be 1-100). Using 25.`)
    return 25
  }
  return n
}

/**
 * Read and validate CROSS_CITY_DAILY_LIMIT from env.
 * Returns a number >= 1. Default 3.
 */
export function getCrossCityDailyLimit() {
  const raw = process.env.CROSS_CITY_DAILY_LIMIT
  if (!raw) return 3
  const n = parseInt(raw, 10)
  if (isNaN(n) || n < 1) {
    console.warn(`[resolveCityFromPoint] CROSS_CITY_DAILY_LIMIT="${raw}" is invalid. Using default 3.`)
    return 3
  }
  return n
}

// ── Typed validation error ───────────────────────────────────────────────────

export class CoordinateValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CoordinateValidationError'
    this.statusCode = 400
  }
}

// ── haversine in km (wraps the existing meters function) ────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  return haversineDistance(lat1, lng1, lat2, lng2) / 1000
}

// ── Main resolver ────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {number} opts.lat   – pin latitude  (required, validated)
 * @param {number} opts.lng   – pin longitude (required, validated)
 * @param {string|mongoose.Types.ObjectId|null} opts.homeMunicipalityId
 *   – the citizen's registered municipality (null for unauthenticated callers)
 *
 * @returns {Promise<{
 *   municipality: mongoose.Document,   – the target municipality document
 *   distanceKm: number,
 *   homePreferred: boolean,            – true when the border rule fired
 *   method: 'nearest_centroid',
 * } | null>}  null = nothing live within radius
 *
 * Also attaches `.nearestNotLive: { name, state }` when the closest known city
 * is within radius but is not yet live, so the caller can give a precise message.
 *
 * @throws {CoordinateValidationError} for invalid lat/lng
 */
export async function resolveCityFromPoint({ lat, lng, homeMunicipalityId = null }) {
  // ── 1. Validate coordinates ────────────────────────────────────────────
  const latN = typeof lat === 'string' ? parseFloat(lat) : lat
  const lngN = typeof lng === 'string' ? parseFloat(lng) : lng

  if (!Number.isFinite(latN) || latN < -90 || latN > 90) {
    throw new CoordinateValidationError(
      `Invalid latitude "${lat}": must be a number between -90 and 90`
    )
  }
  if (!Number.isFinite(lngN) || lngN < -180 || lngN > 180) {
    throw new CoordinateValidationError(
      `Invalid longitude "${lng}": must be a number between -180 and 180`
    )
  }

  const radiusKm = getCityMatchRadiusKm()

  // ── 2. Fetch all municipalities that have centroid data ────────────────
  const allMunis = await Municipality.find({
    'centroid.lat': { $exists: true },
    'centroid.lng': { $exists: true },
  }).lean()

  if (allMunis.length === 0) return null

  // ── 3. Bulk live-status check (single query, no N+1) ──────────────────
  const statusMap = await getBulkCityStatus(allMunis.map((m) => m._id))

  // ── 4. Compute distance for every candidate ────────────────────────────
  const candidates = allMunis.map((m) => ({
    muni: m,
    distanceKm: haversineKm(latN, lngN, m.centroid.lat, m.centroid.lng),
    status: statusMap.get(m._id.toString()) || { isLive: false, reasons: ['inactive'] },
  }))

  // Sort by distance ascending
  candidates.sort((a, b) => a.distanceKm - b.distanceKm)

  // ── 4a. Identify the nearest candidate within radius (live or not) ─────
  const nearestInRadius = candidates.find((c) => c.distanceKm <= radiusKm)
  if (!nearestInRadius) return null // nothing at all within range

  // If the nearest is not live, return not_live with metadata
  if (!nearestInRadius.status.isLive) {
    return {
      municipality: null,
      isLive: false,
      nearestNotLive: { name: nearestInRadius.muni.name, state: nearestInRadius.muni.state },
      distanceKm: nearestInRadius.distanceKm,
      reasons: nearestInRadius.status.reasons || ['not_live'],
      method: 'nearest_centroid',
    }
  }

  // ── 5. Best live city in radius ────────────────────────────────────────
  const nearestLive = candidates.find((c) => c.distanceKm <= radiusKm && c.status.isLive)
  if (!nearestLive) {
    return null
  }

  // ── 6. Border rule: prefer home city if within margin ─────────────────
  let chosenCandidate = nearestLive
  let homePreferred = false

  if (homeMunicipalityId) {
    const homeId = homeMunicipalityId.toString()
    const homeCandidate = candidates.find((c) => c.muni._id.toString() === homeId)

    if (
      homeCandidate &&
      homeCandidate.status.isLive &&
      homeCandidate.distanceKm <= radiusKm &&
      homeCandidate.distanceKm - nearestLive.distanceKm <= HOME_PREFER_MARGIN_KM
    ) {
      chosenCandidate = homeCandidate
      homePreferred = true
    }
  }

  // ── 7. Return result ───────────────────────────────────────────────────
  return {
    municipality: await Municipality.findById(chosenCandidate.muni._id), // full doc
    isLive: true,
    distanceKm: chosenCandidate.distanceKm,
    homePreferred,
    method: 'nearest_centroid',
  }
}
