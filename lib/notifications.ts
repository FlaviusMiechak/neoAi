import 'server-only'
import nodemailer from 'nodemailer'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function sendNotificationEmail(to: string, title: string, body: string) {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT ?? 587)
  const from = process.env.SMTP_FROM

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM must be configured')
  }

  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (Boolean(user) !== Boolean(pass)) {
    throw new Error('SMTP_USER and SMTP_PASS must both be configured')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
  })

  await transporter.sendMail({
    from,
    to,
    subject: title,
    text: body,
    html: `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(body).replaceAll('\n', '<br>')}</p>`,
  })
}