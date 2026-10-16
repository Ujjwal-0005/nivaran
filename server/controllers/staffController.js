import User from '../models/User.js'
import Report from '../models/Report.js'
import { scopeFilter, findInScope } from '../utils/scope.js'

// GET /api/staff (admin only)
// List staff users in the admin's municipality with stats
export const getAllStaff = async (req, res) => {
  try {
    const filter = scopeFilter(req)

    const staffMembers = await User.find({
      role: 'staff',
      municipality: filter.municipality,
    })
      .populate('department', 'name key')
      .select('-passwordHash -otp')
      .sort({ name: 1 })

    const staffStats = await Promise.all(
      staffMembers.map(async (staff) => {
        // Count open tickets currently assigned in same municipality
        const openTicketsCount = await Report.countDocuments({
          municipality: filter.municipality,
          assignedTo: staff._id,
          status: { $ne: 'resolved' },
        })

        // Find all resolved reports for stats
        const resolvedReports = await Report.find({
          municipality: filter.municipality,
          assignedTo: staff._id,
          status: 'resolved',
        }).select('rating')

        const totalResolved = resolvedReports.length

        // Average rating calculation
        const ratedReports = resolvedReports.filter(
          (r) => r.rating && typeof r.rating.score === 'number'
        )
        const averageRating =
          ratedReports.length > 0
            ? Number(
                (
                  ratedReports.reduce((acc, curr) => acc + curr.rating.score, 0) /
                  ratedReports.length
                ).toFixed(1)
              )
            : null

        return {
          _id: staff._id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          department: staff.department,
          isVerified: staff.isVerified,
          createdAt: staff.createdAt,
          openTicketsCount,
          totalResolved,
          ratedCount: ratedReports.length,
          averageRating,
        }
      })
    )

    res.status(200).json({ staff: staffStats })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching staff members' })
  }
}

// GET /api/staff/:id/tickets (admin only)
// Full ticket history for an individual staff member in the same municipality
export const getStaffTickets = async (req, res) => {
  try {
    const { id } = req.params
    const filter = scopeFilter(req)

    const staff = await findInScope(User, req, id, [
      { path: 'department', select: 'name key' },
    ])

    if (staff.role !== 'staff') {
      return res.status(404).json({ message: 'Staff member not found' })
    }

    const tickets = await Report.find({
      municipality: filter.municipality,
      assignedTo: id,
    })
      .populate('category', 'name severityWeight slaHours departmentKey')
      .populate('department', 'name key')
      .populate('citizen', 'name email')
      .sort({ createdAt: -1 })

    res.status(200).json({
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        department: staff.department,
        isVerified: staff.isVerified,
        createdAt: staff.createdAt,
      },
      tickets,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching staff ticket history' })
  }
}
