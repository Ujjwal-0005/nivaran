/**
 * requireSuperAdmin middleware
 *
 * Must be used AFTER the `auth` middleware which sets req.user.
 * Returns 403 immediately if the authenticated user is not superadmin.
 *
 * Also rejects inactive super admin accounts (isActive check is done
 * in the auth middleware DB lookup; here we just check the role).
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' })
  }
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      message: 'Super Admin access required',
    })
  }
  next()
}
