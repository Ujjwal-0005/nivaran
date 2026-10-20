/**
 * server/utils/pagination.js
 *
 * Shared pagination utilities used by every list endpoint.
 * No throws – invalid values are always clamped silently.
 */

/**
 * Parse pagination parameters from a request query string.
 *
 * @param {object} req   Express request (uses req.query.page and req.query.limit)
 * @param {object} opts
 * @param {number} [opts.defaultLimit=20]  Default page size
 * @param {number} [opts.maxLimit=100]     Hard ceiling on page size
 * @returns {{ page: number, limit: number, skip: number }}
 */
export function parsePagination(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const rawPage = parseInt(req.query?.page, 10)
  const rawLimit = parseInt(req.query?.limit, 10)

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), maxLimit)
    : Math.min(defaultLimit, maxLimit)

  return { page, limit, skip: (page - 1) * limit }
}

/**
 * Build a standard pagination envelope to attach to every paginated response.
 *
 * @param {{ page: number, limit: number, total: number }} params
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
export function buildPagination({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}
