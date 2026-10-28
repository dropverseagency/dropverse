import { NextResponse } from 'next/server'
import { sendGmailNotificationEmail } from '@/lib/gmailSmtp'
import { buildWelcomeEmail } from '@/lib/emailTemplates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TEST_TOKEN = 'dv-mail-check-2026-10-28-7f3c91a5e2d84b60'
const TEST_RECIPIENT = 'allinoneeg10@gmail.com'

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('token') !== TEST_TOKEN) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const email = buildWelcomeEmail('https://dropverse10v.vercel.app')
  const sent = await sendGmailNotificationEmail(
    TEST_RECIPIENT,
    'DropVerse welcome email — delivery test',
    email.text,
    email.html,
  )

  return NextResponse.json(
    { ok: sent, recipient: TEST_RECIPIENT, message: sent ? 'SMTP accepted the test email' : 'SMTP send failed; check server logs' },
    { status: sent ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
