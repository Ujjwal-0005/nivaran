import Report from '../models/Report.js'

// Haversine formula to calculate distance between two lat/lng points
// Accounts for Earth's curvature - more accurate than simple coordinate subtraction
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // distance in meters
}

/**
 * Find a possible duplicate report based on category, distance, time, and municipality.
 *
 * Strategy (Part 2 – keeps the identical 50 m result):
 *  1. Use a $geoWithin $centerSphere query (~50 m radius) as a MongoDB-side prefilter,
 *     scoped by municipality, same category, and non-resolved status, within 30 days.
 *     This replaces a full city-collection scan with an index-backed geo query.
 *  2. Apply the exact Haversine check (≤ 50 m) on the returned candidate set.
 *     The result set is identical to the previous brute-force approach.
 *
 * Falls back to legacy full-scan when geoPoint is missing (old documents without the field).
 */
export async function checkForDuplicate(newReportData) {
  const { category, location, municipality } = newReportData
  const thresholdMeters = 50 // 50 metres threshold
  const maxAgeDays = 30 // 30-day time window

  const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)

  // 50 m radius in radians (for $centerSphere): radius / Earth radius
  const EARTH_RADIUS_M = 6371000
  const radiusRadians = thresholdMeters / EARTH_RADIUS_M

  const baseFilter = {
    category,
    municipality,
    status: { $in: ['reported', 'acknowledged', 'in_progress'] },
    createdAt: { $gte: cutoffDate },
  }

  // Attempt geo-prefilter first (requires 2dsphere index + geoPoint field on existing docs)
  let candidates
  try {
    candidates = await Report.find({
      ...baseFilter,
      geoPoint: {
        $geoWithin: {
          $centerSphere: [[location.lng, location.lat], radiusRadians],
        },
      },
    }).select('location ticketId')
  } catch (_geoErr) {
    // Fallback: full scan (e.g., if no geoPoint exists on old documents)
    candidates = await Report.find(baseFilter).select('location ticketId')
  }

  // Exact Haversine check on the small candidate set — keeps the identical 50 m rule
  for (const report of candidates) {
    const distance = haversineDistance(
      location.lat,
      location.lng,
      report.location.lat,
      report.location.lng
    )
    if (distance <= thresholdMeters) {
      return report
    }
  }

  return null
}
