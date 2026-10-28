import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/leads/auth'
import { adminClient } from '@/lib/adminCore'
import { sendGmailNotificationEmail } from '@/lib/gmailSmtp'
import { buildWelcomeEmail } from '@/lib/emailTemplates'

export const runtime = 'nodejs'

/**
 * Sends the one-time application welcome email after a confirmed user signs in.
 * Supabase Auth confirmation email configuration is intentionally untouched.
 */
export async function POST() {
  let userId = ''
  let idempotencyKey = ''

  try {
    const current = await requireUser()
    userId = current.userId
    const emailFromSession = current.email

    const admin = adminClient()
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data.user) {
      return NextResponse.json({ error: 'USER_LOOKUP_FAILED' }, { status: 500 })
    }

    const user = data.user
    const email = user.email || emailFromSession
    if (!email || !(user.email_confirmed_at || user.confirmed_at)) {
      return NextResponse.json({ ok: true, skipped: 'EMAIL_NOT_CONFIRMED' })
    }

    idempotencyKey = `welcome_email:${userId}`
    const { data: existing, error: lookupError } = await admin
      .from('agent_events')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (lookupError) {
      console.error('[notifications/welcome] idempotency lookup failed:', lookupError.message)
      return NextResponse.json({ error: 'WELCOME_LOOKUP_FAILED' }, { status: 503 })
    }
    if (existing) return NextResponse.json({ ok: true, skipped: 'ALREADY_SENT' })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dropverse10v.vercel.app'
    const emailContent = buildWelcomeEmail(siteUrl)
    const sent = await sendGmailNotificationEmail(
      email,
      emailContent.subject,
      emailContent.text,
      emailContent.html,
    )

    if (!sent) {
      return NextResponse.json({ error: 'WELCOME_EMAIL_FAILED' }, { status: 503 })
    }

    // Record only after successful delivery so a failed SMTP attempt can be retried.
    const { error: recordError } = await admin.from('agent_events').insert({
      idempotency_key: idempotencyKey,
      agent: 'welcome_email',
      entity_id: userId,
    })
    if (recordError && recordError.code !== '23505') {
      console.error('[notifications/welcome] sent email but could not record idempotency:', recordError.message)
    }

    return NextResponse.json({ ok: true, sent: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
    console.error('[notifications/welcome]', error)
    return NextResponse.json({ error: 'WELCOME_EMAIL_FAILED' }, { status: 500 })
  }
}
