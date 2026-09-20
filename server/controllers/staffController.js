import User from '../models/User.js'
import Report from '../models/Report.js'

// GET /api/staff (admin only)
// List all staff users with:
// - currently assigned open tickets count
// - total resolved tickets count
// - average rating from resolved tickets with rating.score
export const getAllStaff = async (req, res) => {
  try {
    const staffMembers = await User.find({ role: 'staff' })
      .populate('department', 'name')
      .select('-passwordHash -otp')
      .sort({ name: 1 })

    const staffStats = await Promise.all(
      staffMembers.map(async (staff) => {
        // Count open tickets currently assigned
        const openTicketsCount = await Report.countDocuments({
          assignedTo: staff._id,
          status: { $ne: 'resolved' },
        })

        // Find all resolved reports for stats
        const resolvedReports = await Report.find({
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
    console.error('Get all staff error:', error)
    res.status(500).json({ message: 'Server error fetching staff members' })
  }
}

// GET /api/staff/:id/tickets (admin only)
// Full ticket history for an individual staff member
export const getStaffTickets = async (req, res) => {
  try {
    const { id } = req.params

    const staff = await User.findOne({ _id: id, role: 'staff' })
      .populate('department', 'name')
      .select('-passwordHash -otp')

    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' })
    }

    const tickets = await Report.find({ assignedTo: id })
      .populate('category', 'name severityWeight slaHours')
      .populate('department', 'name')
      .populate('citizen', 'name email')
      .sort({ createdAt: -1 })

    res.status(200).json({
      staff,
      tickets,
    })
  } catch (error) {
    console.error('Get staff tickets error:', error)
    res.status(500).json({ message: 'Server error fetching staff ticket history' })
  }
}
