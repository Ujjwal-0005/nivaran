import User from '../models/User.js'
import Report from '../models/Report.js'
import Department from '../models/Department.js'
import AuditLog from '../models/AuditLog.js'
import { scopeFilter, findInScope } from '../utils/scope.js'
import { notifyAdmins } from '../utils/notify.js'
import {
  sendStaffApprovedEmail,
  sendStaffRejectedEmail,
  sendStaffRevokedEmail,
} from '../utils/sendEmail.js'

// GET /api/staff (admin only)
// List staff users in the admin's municipality with stats
export const getAllStaff = async (req, res) => {
  try {
    const filter = scopeFilter(req)

    const staffMembers = await User.find({
      role: 'staff',
      municipality: filter.municipality,
      applicationStatus: 'approved', // Step 4: Only approved staff
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

    const { parsePagination, buildPagination } = await import('../utils/pagination.js')
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 })

    const queryFilter = {
      municipality: filter.municipality,
      assignedTo: id,
    }

    const [tickets, total] = await Promise.all([
      Report.find(queryFilter)
        .populate('category', 'name severityWeight slaHours departmentKey')
        .populate('department', 'name key')
        .populate('citizen', 'name email')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(queryFilter),
    ])

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
      pagination: buildPagination({ page, limit, total }),
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching staff ticket history' })
  }
}

// Step 3: GET /api/admin/staff-applications (admin only)
// List staff applications with pagination and filters
export const getStaffApplications = async (req, res) => {
  try {
    const { status, search } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const filter = scopeFilter(req)
    filter.role = 'staff'

    // Filter by application status
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.applicationStatus = status
    }

    // Search across name, email, phone, employeeId, designation
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' }
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { employeeId: searchRegex },
        { designation: searchRegex },
      ]
    }

    const [applications, total] = await Promise.all([
      User.find(filter)
        .populate('department', 'name key')
        .populate('reviewedBy', 'name email')
        .select('-passwordHash -otp -otpExpiry -lastOtpSentAt -passwordSetToken -passwordSetTokenExpiry')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ])

    res.status(200).json({
      items: applications,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error fetching staff applications' })
  }
}

// Step 3: POST /api/admin/staff-applications/:id/approve (admin only)
export const approveStaffApplication = async (req, res) => {
  try {
    const { id } = req.params
    const { department } = req.body
    const adminUser = req.user

    const applicant = await findInScope(User, req, id, [
      { path: 'department', select: 'name key' },
      { path: 'municipality', select: 'name' },
    ])

    if (applicant.role !== 'staff') {
      return res.status(404).json({ message: 'Staff application not found' })
    }

    if (applicant.applicationStatus !== 'pending') {
      return res.status(400).json({ message: 'Only pending applications can be approved' })
    }

    // Optional: change department
    if (department) {
      const newDept = await Department.findOne({ _id: department, municipality: applicant.municipality._id })
      if (!newDept) {
        return res.status(400).json({ message: 'Invalid department for this municipality' })
      }
      if (newDept.isExternal) {
        return res.status(400).json({ message: 'Staff cannot be assigned to an external agency department' })
      }
      applicant.department = newDept._id
    } else if (applicant.department) {
      const currentDept = await Department.findById(applicant.department)
      if (currentDept && currentDept.isExternal) {
        return res.status(400).json({ message: 'Staff cannot be approved for an external agency department' })
      }
    }

    applicant.applicationStatus = 'approved'
    applicant.reviewedAt = new Date()
    applicant.reviewedBy = adminUser.userId
    await applicant.save()

    // Send approval email
    await sendStaffApprovedEmail(applicant.email, {
      name: applicant.name,
      municipalityName: applicant.municipality.name,
      departmentName: applicant.department?.name || 'Department',
    })

    // Write audit log
    await AuditLog.create({
      actor: adminUser.userId,
      actorEmail: adminUser.email,
      action: 'staff.approve',
      targetMunicipality: applicant.municipality._id,
      targetUser: applicant._id,
      meta: {
        email: applicant.email,
        employeeId: applicant.employeeId,
        department: applicant.department?.name,
      },
    })

    res.status(200).json({
      message: 'Staff application approved',
      application: {
        _id: applicant._id,
        name: applicant.name,
        email: applicant.email,
        applicationStatus: applicant.applicationStatus,
        reviewedAt: applicant.reviewedAt,
      },
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error approving staff application' })
  }
}

// Step 3: POST /api/admin/staff-applications/:id/reject (admin only)
export const rejectStaffApplication = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const adminUser = req.user

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ message: 'Rejection reason must be at least 10 characters' })
    }

    const applicant = await findInScope(User, req, id, [
      { path: 'municipality', select: 'name' },
    ])

    if (applicant.role !== 'staff') {
      return res.status(404).json({ message: 'Staff application not found' })
    }

    if (applicant.applicationStatus !== 'pending') {
      return res.status(400).json({ message: 'Only pending applications can be rejected' })
    }

    applicant.applicationStatus = 'rejected'
    applicant.rejectionReason = reason.trim()
    applicant.reviewedAt = new Date()
    applicant.reviewedBy = adminUser.userId
    await applicant.save()

    // Send rejection email
    await sendStaffRejectedEmail(applicant.email, {
      name: applicant.name,
      municipalityName: applicant.municipality.name,
      reason: reason.trim(),
    })

    // Write audit log
    await AuditLog.create({
      actor: adminUser.userId,
      actorEmail: adminUser.email,
      action: 'staff.reject',
      targetMunicipality: applicant.municipality._id,
      targetUser: applicant._id,
      meta: {
        email: applicant.email,
        employeeId: applicant.employeeId,
        reason: reason.trim(),
      },
    })

    res.status(200).json({
      message: 'Staff application rejected',
      application: {
        _id: applicant._id,
        name: applicant.name,
        email: applicant.email,
        applicationStatus: applicant.applicationStatus,
        rejectionReason: applicant.rejectionReason,
        reviewedAt: applicant.reviewedAt,
      },
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error rejecting staff application' })
  }
}

// Step 3: POST /api/admin/staff/:id/revoke (admin only)
export const revokeStaff = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const adminUser = req.user

    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Revocation reason is required' })
    }

    const filter = scopeFilter(req)
    const staff = await User.findOne({
      _id: id,
      role: 'staff',
      municipality: filter.municipality,
    })

    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' })
    }

    if (staff.applicationStatus !== 'approved') {
      return res.status(400).json({ message: 'Only approved staff can be revoked' })
    }

    // Increment tokenVersion to invalidate existing sessions
    staff.tokenVersion = (staff.tokenVersion ?? 0) + 1
    staff.applicationStatus = 'rejected'
    staff.revokedAt = new Date()
    staff.revokedBy = adminUser.userId
    staff.revocationReason = reason.trim()
    await staff.save()

    // Return open tickets to unassigned pool
    const openTickets = await Report.find({
      municipality: filter.municipality,
      assignedTo: staff._id,
      status: { $ne: 'resolved' },
    })

    const releasedCount = openTickets.length
    for (const ticket of openTickets) {
      ticket.assignedTo = null
      if (ticket.status === 'acknowledged' || ticket.status === 'in_progress') {
        ticket.status = 'reported'
      }
      await ticket.save()
    }

    // Send revocation email
    await sendStaffRevokedEmail(staff.email, {
      name: staff.name,
      municipalityName: staff.municipality?.name || 'your city',
      reason: reason.trim(),
    })

    // Write audit log
    await AuditLog.create({
      actor: adminUser.userId,
      actorEmail: adminUser.email,
      action: 'staff.revoke',
      targetMunicipality: staff.municipality._id,
      targetUser: staff._id,
      meta: {
        email: staff.email,
        employeeId: staff.employeeId,
        reason: reason.trim(),
        releasedTickets: releasedCount,
      },
    })

    res.status(200).json({
      message: 'Staff member revoked',
      releasedTickets: releasedCount,
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error revoking staff member' })
  }
}

// Step 3: POST /api/admin/staff-applications/:id/reconsider (admin only)
export const reconsiderStaffApplication = async (req, res) => {
  try {
    const { id } = req.params
    const adminUser = req.user

    const applicant = await findInScope(User, req, id)

    if (applicant.role !== 'staff') {
      return res.status(404).json({ message: 'Staff application not found' })
    }

    if (applicant.applicationStatus !== 'rejected') {
      return res.status(400).json({ message: 'Only rejected applications can be reconsidered' })
    }

    applicant.applicationStatus = 'pending'
    applicant.rejectionReason = null
    applicant.revokedAt = null
    applicant.revokedBy = null
    applicant.revocationReason = null
    await applicant.save()

    // Write audit log
    await AuditLog.create({
      actor: adminUser.userId,
      actorEmail: adminUser.email,
      action: 'staff.reconsider',
      targetMunicipality: applicant.municipality._id,
      targetUser: applicant._id,
      meta: {
        email: applicant.email,
        employeeId: applicant.employeeId,
      },
    })

    res.status(200).json({
      message: 'Staff application moved back to pending',
      application: {
        _id: applicant._id,
        name: applicant.name,
        email: applicant.email,
        applicationStatus: applicant.applicationStatus,
      },
    })
  } catch (error) {
    const status = error.statusCode || 500
    res.status(status).json({ message: error.message || 'Server error reconsidering staff application' })
  }
}
