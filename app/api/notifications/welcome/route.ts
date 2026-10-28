import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/leads/auth'
import { adminClient } from '@/lib/adminCore'
import { sendGmailNotificationEmail } from '@/lib/gmailSmtp'

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
    const { error: claimError } = await admin.from('agent_events').insert({
      idempotency_key: idempotencyKey,
      agent: 'welcome_email',
      entity_id: userId,
    })
    if (claimError) {
      if (claimError.code === '23505') {
        return NextResponse.json({ ok: true, skipped: 'ALREADY_SENT' })
      }
      console.error('[notifications/welcome] idempotency claim failed:', claimError.message)
      return NextResponse.json({ error: 'WELCOME_CLAIM_FAILED' }, { status: 503 })
    }

    const sent = await sendGmailNotificationEmail(
      email,
      'Welcome to DropVerse',
      [
        'Welcome to DropVerse!',
        '',
        'Your account is ready. You can explore the platform, manage projects, and connect with the services that fit your goals.',
        '',
        'Open DropVerse: ' + (process.env.NEXT_PUBLIC_SITE_URL || 'https://dropverse10v.vercel.app'),
        '',
        '— The DropVerse Team',
      ].join('\n'),
    )

    if (!sent) {
      await admin.from('agent_events').delete().eq('idempotency_key', idempotencyKey)
      return NextResponse.json({ error: 'WELCOME_EMAIL_FAILED' }, { status: 503 })
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
