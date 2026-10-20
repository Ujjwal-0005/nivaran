import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

let transporter = null

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER?.trim(),
        pass: process.env.EMAIL_PASS?.trim(),
      },
    })
  }
  return transporter
}

export const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    }

    await getTransporter().sendMail(mailOptions)
  } catch (error) {
    console.error('Error sending email:', error)
    throw new Error('Failed to send email')
  }
}

export const sendOTPEmail = async (to, otp) => {
  const subject = 'Nivaran - Verify Your Email'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to Nivaran!</h2>
      <p>Your verification code is:</p>
      <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
      <p style="color: #666; font-size: 12px;">Report it. Track it. Nivaran — Resolved.</p>
    </div>
  `
  await sendEmail(to, subject, html)
}

export const sendWelcomeEmail = async (to, name) => {
  const subject = 'Welcome to Nivaran!'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to Nivaran, ${name}!</h2>
      <p>Your email has been successfully verified.</p>
      <p>You can now start reporting civic issues in your area.</p>
      <p style="color: #666; font-size: 12px;">Report it. Track it. Nivaran — Resolved.</p>
    </div>
  `
  await sendEmail(to, subject, html)
}

// Phase 8: Status update notification email
export const sendStatusUpdateEmail = async (to, { ticketId, status, category, resolutionNote }) => {
  const statusLabels = {
    acknowledged: 'Acknowledged by Department',
    in_progress: 'In Progress (Field Work Started)',
    resolved: 'Resolved',
    disputed: 'Disputed (Under Admin Review)',
  }
  const statusTitle = statusLabels[status] || status
  const subject = `Nivaran Update: Your report ${ticketId} is now ${statusTitle}`

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0B2545; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">Nivaran Civic Operations</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #cbd5e1;">Report Status Update</p>
      </div>
      <div style="padding: 24px; color: #1f2937;">
        <p style="font-size: 15px;">Hello,</p>
        <p style="font-size: 14px; line-height: 1.5;">
          There is an update on your civic report <strong>${ticketId}</strong> (${category || 'Civic Issue'}).
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #ea580c; padding: 14px 16px; margin: 18px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 13px; color: #64748b;">Current Status:</p>
          <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #0f172a; text-transform: uppercase;">
            ${statusTitle}
          </p>
          ${resolutionNote ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #334155;"><strong>Note:</strong> ${resolutionNote}</p>` : ''}
        </div>
        <p style="font-size: 13px; color: #475569;">
          You can track live progress and view photo proof directly in your citizen dashboard.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; color: #64748b; font-size: 11px;">
        Report it. Track it. Nivaran — Resolved.
      </div>
    </div>
  `

  try {
    await sendEmail(to, subject, html)
  } catch (err) {
    console.error(`Failed to send status update email to ${to}:`, err.message)
    // Non-blocking fallback
  }
}

// Phase 8: Resolved notification email with thank you and rating prompt
export const sendResolvedEmail = async (to, { ticketId, category, resolutionNote, reportId }) => {
  const subject = `Nivaran: Your report ${ticketId} has been resolved!`
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #15803d; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">✓ Issue Marked Resolved</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #dcfce7;">Thank you for making our municipality better</p>
      </div>
      <div style="padding: 24px; color: #1f2937;">
        <p style="font-size: 15px;">Hello Citizen,</p>
        <p style="font-size: 14px; line-height: 1.5;">
          Municipal field personnel have completed work on your ticket <strong>${ticketId}</strong> (${category || 'Civic Issue'}).
        </p>
        ${resolutionNote ? `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 16px; margin: 18px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 13px; font-weight: bold; color: #166534;">Field Resolution Note:</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #14532d;">${resolutionNote}</p>
        </div>` : ''}
        <div style="background-color: #fefce8; border: 1px solid #fef08a; padding: 14px 16px; margin: 18px 0; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-size: 14px; font-weight: bold; color: #854d0e;">
            How did we do?
          </p>
          <p style="margin: 4px 0 12px 0; font-size: 12px; color: #a16207;">
            Please take 10 seconds to rate the resolution or dispute if the issue persists.
          </p>
          <a href="http://localhost:5173/citizen/reports/${reportId}" style="background-color: #15803d; color: #ffffff; padding: 8px 18px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold; display: inline-block;">
            Review & Rate Resolution →
          </a>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; color: #64748b; font-size: 11px;">
        Report it. Track it. Nivaran — Resolved.
      </div>
    </div>
  `

  try {
    await sendEmail(to, subject, html)
  } catch (err) {
    console.error(`Failed to send resolution email to ${to}:`, err.message)
  }
}

// Step 2: City Admin invite email (Super Admin portal)
export const sendCityAdminInviteEmail = async (to, { name, municipalityName, setPasswordUrl }) => {
  const subject = `You have been appointed as City Admin for ${municipalityName} on Nivaran`
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0B2545; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">Nivaran — City Admin Invitation</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #cbd5e1;">${municipalityName}</p>
      </div>
      <div style="padding: 24px; color: #1f2937;">
        <p style="font-size: 15px;">Dear ${name},</p>
        <p style="font-size: 14px; line-height: 1.5;">
          You have been appointed as the <strong>City Administrator</strong> for
          <strong>${municipalityName}</strong> on the Nivaran Civic Operations Platform.
        </p>
        <p style="font-size: 14px;">
          Please click the button below to set your password and activate your account.
          This link is valid for <strong>48 hours</strong>.
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${setPasswordUrl}"
             style="background-color: #0B2545; color: #ffffff; padding: 12px 28px; border-radius: 8px;
                    text-decoration: none; font-size: 14px; font-weight: bold; display: inline-block;">
            Set Password &amp; Activate Account →
          </a>
        </div>
        <p style="font-size: 12px; color: #6b7280;">
          If you were not expecting this invitation, please ignore this email or contact
          the Nivaran platform team immediately.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; color: #64748b; font-size: 11px;">
        Report it. Track it. Nivaran — Resolved.
      </div>
    </div>
  `
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SMTP Not Configured] City Admin Invite link for ${to}: ${setPasswordUrl}`)
      }
    }
    await sendEmail(to, subject, html)
  } catch (err) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      // In development/test environments without SMTP, do not crash invite flow
      return
    }
    console.error(`Failed to send city admin invite to ${to}:`, err.message)
    throw err
  }
}

// Step 2: Notify city admin that their password was reset by super admin
export const sendPasswordChangedEmail = async (to, { name, municipalityName }) => {
  const subject = 'Nivaran: Your admin account password has been reset'
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fca5a5; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #b91c1c; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">Security Notice</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #fee2e2;">Nivaran Admin Account</p>
      </div>
      <div style="padding: 24px; color: #1f2937;">
        <p style="font-size: 15px;">Dear ${name},</p>
        <p style="font-size: 14px; line-height: 1.5;">
          Your administrator account for <strong>${municipalityName}</strong> on Nivaran has had its
          password reset by the platform Super Admin. A new set-password link has been sent in a
          separate email.
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          If this was unexpected, contact the Nivaran platform team immediately.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; color: #64748b; font-size: 11px;">
        Report it. Track it. Nivaran — Resolved.
      </div>
    </div>
  `
  try {
    await sendEmail(to, subject, html)
  } catch (err) {
    console.error(`Failed to send password-changed notice to ${to}:`, err.message)
    // Non-blocking – the reset already succeeded
  }
}

// Phase 8: Admin escalation alert email
export const sendEscalationEmail = async (to, { ticketId, category, priorityScore, hoursOverdue }) => {
  const subject = `🚨 ALERT: Ticket ${ticketId} has breached SLA and been escalated`
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fca5a5; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #b91c1c; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">🚨 SLA Breach Escalation</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #fee2e2;">Municipality Admin Alert</p>
      </div>
      <div style="padding: 24px; color: #1f2937;">
        <p style="font-size: 14px; line-height: 1.5;">
          Ticket <strong>${ticketId}</strong> (${category}) has passed its SLA deadline without resolution and has been automatically escalated.
        </p>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 14px 16px; margin: 18px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b;"><strong>Boosted Priority Score:</strong> ${priorityScore} (+50 SLA penalty applied)</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #991b1b;"><strong>Status:</strong> Awaiting administrative intervention or staff reassignment</p>
        </div>
      </div>
    </div>
  `

  try {
    await sendEmail(to, subject, html)
  } catch (err) {
    console.error(`Failed to send escalation email to ${to}:`, err.message)
  }
}

// Step 3: Staff application approved email
export const sendStaffApprovedEmail = async (to, { name, municipalityName, departmentName }) => {
  const subject = `Your staff application for ${municipalityName} has been approved`
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #15803d; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">✓ Application Approved</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #dcfce7;">Nivaran Staff Portal</p>
      </div>
      <div style="padding: 24px; color: #1f2937;">
        <p style="font-size: 15px;">Dear ${name},</p>
        <p style="font-size: 14px; line-height: 1.5;">
          Your staff application for <strong>${municipalityName}</strong> has been approved by the city administration.
        </p>
        <p style="font-size: 14px;">
          You have been assigned to the <strong>${departmentName}</strong> department.
        </p>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 16px; margin: 18px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 13px; font-weight: bold; color: #166534;">Next Steps:</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #14532d;">You can now log in to the staff portal and start receiving civic issue assignments.</p>
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; color: #64748b; font-size: 11px;">
        Report it. Track it. Nivaran — Resolved.
      </div>
    </div>
  `

  try {
    await sendEmail(to, subject, html)
  } catch (err) {
    console.error(`Failed to send staff approval email to ${to}:`, err.message)
  }
}

// Step 3: Staff application rejected email
export const sendStaffRejectedEmail = async (to, { name, municipalityName, reason }) => {
  const subject = `Your staff application for ${municipalityName} has been rejected`
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fca5a5; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #b91c1c; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">✕ Application Rejected</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #fee2e2;">Nivaran Staff Portal</p>
      </div>
      <div style="padding: 24px; color: #1f2937;">
        <p style="font-size: 15px;">Dear ${name},</p>
        <p style="font-size: 14px; line-height: 1.5;">
          Your staff application for <strong>${municipalityName}</strong> has been reviewed and rejected by the city administration.
        </p>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 14px 16px; margin: 18px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 13px; font-weight: bold; color: #991b1b;">Reason for rejection:</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #7f1d1d;">${reason || 'No reason provided.'}</p>
        </div>
        <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">
          If you believe this is an error, please contact the city administration directly.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; color: #64748b; font-size: 11px;">
        Report it. Track it. Nivaran — Resolved.
      </div>
    </div>
  `

  try {
    await sendEmail(to, subject, html)
  } catch (err) {
    console.error(`Failed to send staff rejection email to ${to}:`, err.message)
  }
}

// Step 3: Staff account revoked email
export const sendStaffRevokedEmail = async (to, { name, municipalityName, reason }) => {
  const subject = `Your staff account for ${municipalityName} has been revoked`
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fca5a5; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #b91c1c; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">⚠ Account Revoked</h1>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #fee2e2;">Nivaran Staff Portal</p>
      </div>
      <div style="padding: 24px; color: #1f2937;">
        <p style="font-size: 15px;">Dear ${name},</p>
        <p style="font-size: 14px; line-height: 1.5;">
          Your staff account for <strong>${municipalityName}</strong> has been revoked by the city administration.
        </p>
        <p style="font-size: 14px;">
          You have been logged out immediately and will no longer have access to the staff portal.
        </p>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 14px 16px; margin: 18px 0; border-radius: 8px;">
          <p style="margin: 0; font-size: 13px; font-weight: bold; color: #991b1b;">Reason for revocation:</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #7f1d1d;">${reason || 'No reason provided.'}</p>
        </div>
        <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">
          Any open tickets assigned to you have been returned to the unassigned pool.
        </p>
      </div>
      <div style="background-color: #f1f5f9; padding: 12px 24px; text-align: center; color: #64748b; font-size: 11px;">
        Report it. Track it. Nivaran — Resolved.
      </div>
    </div>
  `

  try {
    await sendEmail(to, subject, html)
  } catch (err) {
    console.error(`Failed to send staff revocation email to ${to}:`, err.message)
  }
}

