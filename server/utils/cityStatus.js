import User from '../models/User.js'
import Municipality from '../models/Municipality.js'

/**
 * Computes the live status of a municipality.
 * Rule: A city is live if and only if:
 * 1. municipality.isActive is true (not 'inactive')
 * 2. It has at least one active admin user (role === 'admin' && isActive === true) (not 'no_active_admin')
 * 3. At least one active admin has a password set (passwordHash is not null/empty) (not 'admin_password_not_set')
 *
 * @param {string|mongoose.Types.ObjectId} municipalityId
 * @returns {Promise<{ isLive: boolean, reasons: string[] }>}
 */
export const getCityStatus = async (municipalityId) => {
  if (!municipalityId) {
    return { isLive: false, reasons: ['inactive'] }
  }

  const muni = await Municipality.findById(municipalityId).lean()
  if (!muni) {
    return { isLive: false, reasons: ['inactive'] }
  }

  const reasons = []

  if (!muni.isActive) {
    reasons.push('inactive')
  }

  // Find admins for this municipality
  const admins = await User.find({
    municipality: muni._id,
    role: 'admin',
    isActive: true,
  }).lean()

  if (admins.length === 0) {
    reasons.push('no_active_admin')
  } else {
    // An admin has set their password if they have a non-empty passwordHash and NO active passwordSetToken
    const hasPasswordSet = admins.some(
      (a) => a.passwordHash && a.passwordHash.length > 0 && !a.passwordSetToken
    )
    if (!hasPasswordSet) {
      reasons.push('admin_password_not_set')
    }
  }

  return {
    isLive: reasons.length === 0,
    reasons,
  }
}

/**
 * Bulk version to compute live status for multiple municipalities in a single query (avoids N+1).
 *
 * @param {Array<string|mongoose.Types.ObjectId>} municipalityIds - Array of municipality ObjectIds or strings. If empty, checks all municipalities.
 * @returns {Promise<Map<string, { isLive: boolean, reasons: string[] }>>}
 */
export const getBulkCityStatus = async (municipalityIds = null) => {
  const muniFilter = municipalityIds && municipalityIds.length > 0 ? { _id: { $in: municipalityIds } } : {}
  const munis = await Municipality.find(muniFilter).lean()

  const allMuniIds = munis.map((m) => m._id)

  // Single query for all active admins across these municipalities
  const activeAdmins = await User.find({
    municipality: { $in: allMuniIds },
    role: 'admin',
    isActive: true,
  }).select('_id municipality passwordHash passwordSetToken').lean()

  // Group active admins by municipality id string
  const muniAdminsMap = new Map()
  for (const admin of activeAdmins) {
    if (!admin.municipality) continue
    const mIdStr = admin.municipality.toString()
    if (!muniAdminsMap.has(mIdStr)) {
      muniAdminsMap.set(mIdStr, [])
    }
    muniAdminsMap.get(mIdStr).push(admin)
  }

  const statusMap = new Map()

  for (const muni of munis) {
    const mIdStr = muni._id.toString()
    const reasons = []

    if (!muni.isActive) {
      reasons.push('inactive')
    }

    const admins = muniAdminsMap.get(mIdStr) || []
    if (admins.length === 0) {
      reasons.push('no_active_admin')
    } else {
      const hasPassword = admins.some(
        (a) => a.passwordHash && a.passwordHash.length > 0 && !a.passwordSetToken
      )
      if (!hasPassword) {
        reasons.push('admin_password_not_set')
      }
    }

    statusMap.set(mIdStr, {
      isLive: reasons.length === 0,
      reasons,
    })
  }

  return statusMap
}
