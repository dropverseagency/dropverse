import nodemailer from 'nodemailer'

/**
 * Send an application notification through the DropVerse Gmail mailbox.
 *
 * This is deliberately separate from Supabase Auth. Supabase continues to own
 * signup confirmation, password reset, and other authentication emails.
 */
export async function sendGmailNotificationEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<boolean> {
  const user = process.env.GMAIL_SMTP_USER?.trim()
  const password = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')

  if (!user || !password) {
    console.warn('[gmail notification] skipped: GMAIL_SMTP_USER or GMAIL_APP_PASSWORD is not configured')
    return false
  }

  // Always send as the authenticated Gmail mailbox to avoid unverified From aliases.
  const from = `DropVerse <${user}>`
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  try {
    await transporter.sendMail({
      from,
      to,
      subject: subject.slice(0, 200),
      text: text.slice(0, 12_000),
      ...(html ? { html: html.slice(0, 30_000) } : {}),
    })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP error'
    console.error('[gmail notification] send failed:', message)
    return false
  } finally {
    transporter.close()
  }
}
