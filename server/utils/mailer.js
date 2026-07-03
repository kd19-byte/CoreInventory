import nodemailer from 'nodemailer'

const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES || 15)
const MAIL_PROVIDER = String(process.env.MAIL_PROVIDER || 'smtp').toLowerCase()
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const RESEND_FROM = process.env.RESEND_FROM || process.env.MAIL_FROM || ''

const mailConfigured = Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS)

const transporter = mailConfigured
  ? nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT || 587),
      secure: String(process.env.MAIL_SECURE || 'false') === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    })
  : null

export async function sendPasswordResetEmail(email, code) {
  const text = `Your CoreInventory reset code is ${code}. It expires in ${OTP_EXPIRES_MINUTES} minutes.`
  const subject = `CoreInventory reset code: ${code}`
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827">
      <p>Your CoreInventory reset code is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px;margin:12px 0">${code}</p>
      <p>This code expires in ${OTP_EXPIRES_MINUTES} minutes.</p>
    </div>
  `

  if (MAIL_PROVIDER === 'resend') {
    if (!RESEND_API_KEY || !RESEND_FROM) {
      console.warn(`MAIL_NOT_CONFIGURED(RESEND) reset code for ${email}: ${code}`)
      return { delivered: false }
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [email],
          subject,
          text,
          html,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        console.warn(`MAIL_SEND_FAILED(RESEND) for ${email}: ${body}`)
        console.warn(`Fallback reset code for ${email}: ${code}`)
        return { delivered: false }
      }
      return { delivered: true }
    } catch (err) {
      console.warn(`MAIL_SEND_FAILED(RESEND) for ${email}: ${err.message}`)
      console.warn(`Fallback reset code for ${email}: ${code}`)
      return { delivered: false }
    }
  }

  if (!transporter) {
    console.warn(`MAIL_NOT_CONFIGURED(SMTP) reset code for ${email}: ${code}`)
    return { delivered: false }
  }

  const from = process.env.MAIL_FROM || process.env.MAIL_USER
  try {
    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    })
    return { delivered: true }
  } catch (err) {
    console.warn(`MAIL_SEND_FAILED(SMTP) for ${email}: ${err.message}`)
    console.warn(`Fallback reset code for ${email}: ${code}`)
    return { delivered: false }
  }
}
