import Report from '../models/Report.js'

// Haversine formula to calculate distance between two lat/lng points
// Accounts for Earth's curvature - more accurate than simple coordinate subtraction
function haversineDistance(lat1, lon1, lat2, lon2) {
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

// Find possible duplicate report based on category, distance, and time
async function checkForDuplicate(newReportData) {
  const { category, location } = newReportData
  const thresholdMeters = 50 // 50 meters threshold
  const maxAgeDays = 30 // 30 days time window

  console.log('Checking for duplicate:', { category, location, thresholdMeters, maxAgeDays })

  // Fetch open reports of the same category within the time window
  const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
  console.log('Cutoff date:', cutoffDate)
  
  const openReports = await Report.find({
    category,
    status: { $in: ['reported', 'acknowledged', 'in_progress'] }, // Only open reports
    createdAt: { $gte: cutoffDate },
  })

  console.log('Found open reports:', openReports.length)

  const now = Date.now()

  // Find the first report that matches criteria
  for (const report of openReports) {
    const ageDays = (now - new Date(report.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    const distance = haversineDistance(
      location.lat,
      location.lng,
      report.location.lat,
      report.location.lng
    )

    console.log('Checking report:', {
      ticketId: report.ticketId,
      distance: distance.toFixed(2),
      ageDays: ageDays.toFixed(2),
      threshold: thresholdMeters
    })

    if (distance <= thresholdMeters) {
      console.log('Duplicate found:', report.ticketId)
      return report
    }
  }

  console.log('No duplicate found')
  return null
}

export { haversineDistance, checkForDuplicate }
