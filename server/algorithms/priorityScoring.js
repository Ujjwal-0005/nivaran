// Priority scoring algorithm for reports
// Calculates a weighted score based on multiple factors

function calculatePriorityScore({ reportCount, severityWeight, daysOpen, upvotes }) {
  const W1 = 8 // weight for report count (most important - community impact)
  const W2 = 5 // weight for category severity (some categories are more critical)
  const W3 = 2 // weight for age (days open - older issues need attention)
  const W4 = 1 // weight for upvotes (community validation)

  return reportCount * W1 + severityWeight * W2 + daysOpen * W3 + upvotes * W4
}

// Get priority level based on score
function getPriorityLevel(score) {
  if (score >= 50) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

// Calculate days open from creation date
function calculateDaysOpen(createdAt) {
  const now = new Date()
  const created = new Date(createdAt)
  const diffTime = Math.abs(now - created)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export { calculatePriorityScore, getPriorityLevel, calculateDaysOpen }
