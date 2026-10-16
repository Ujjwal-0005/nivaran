/**
 * Utility functions for multi-tenant scoping.
 * Each municipality is an isolated tenant.
 */

export class ScopeError extends Error {
  constructor(message, statusCode = 403) {
    super(message)
    this.name = 'ScopeError'
    this.statusCode = statusCode
  }
}

/**
 * Returns the query filter for the user's municipality.
 * Superadmin has no municipality and is rejected from reading/writing city-owned records.
 */
export const scopeFilter = (req) => {
  if (!req.user) {
    const error = new Error('Authentication required')
    error.statusCode = 401
    throw error
  }

  if (req.user.role === 'superadmin' || !req.user.municipality) {
    const error = new Error('Access denied: Tenant context required')
    error.statusCode = 403
    throw error
  }

  return { municipality: req.user.municipality }
}

/**
 * Finds a document by ID scoped to the caller's municipality.
 * Returns 404 (or throws an error with 404) if not found or belongs to another city.
 */
export const findInScope = async (Model, req, id, populateOptions = null) => {
  const filter = {
    _id: id,
    ...scopeFilter(req),
  }

  let query = Model.findOne(filter)
  if (populateOptions) {
    query = query.populate(populateOptions)
  }

  const doc = await query
  if (!doc) {
    const error = new Error(`${Model.modelName || 'Resource'} not found`)
    error.statusCode = 404
    throw error
  }

  return doc
}
