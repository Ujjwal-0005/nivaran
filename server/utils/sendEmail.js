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
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
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
