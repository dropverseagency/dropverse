import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { sendGmailNotificationEmail } from '@/lib/gmailSmtp'

export const runtime = 'nodejs'

/**
 * Temporary, token-protected SMTP verification endpoint.
 * It is restricted to the Gmail-notification feature branch on Preview and
 * sends only to the explicitly authorized test inbox.
 */
export async function POST(request: Request) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.VERCEL_GIT_COMMIT_REF !== 'feat/gmail-smtp-user-notifications'
  ) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const expected = process.env.DROPVERSE_SMTP_TEST_TOKEN || ''
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const expectedBytes = Buffer.from(expected)
  const suppliedBytes = Buffer.from(supplied)

  if (
    !expected ||
    expectedBytes.length !== suppliedBytes.length ||
    !timingSafeEqual(expectedBytes, suppliedBytes)
  ) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const recipient = 'allinoneeg10v@gmail.com'
  const tests = [
    {
      scenario: 'welcome',
      subject: '[DropVerse SMTP Test 1/4] Welcome Email',
      body: 'SMTP delivery test 1 of 4. Scenario: Welcome to DropVerse. This is a test message sent from the Preview environment; no account settings were changed.',
    },
    {
      scenario: 'project_created',
      subject: '[DropVerse SMTP Test 2/4] Project Created',
      body: 'SMTP delivery test 2 of 4. Scenario: Project created. This simulates the notification content a user would receive after creating a project.',
    },
    {
      scenario: 'project_status',
      subject: '[DropVerse SMTP Test 3/4] Project Status Update',
      body: 'SMTP delivery test 3 of 4. Scenario: Project status updated. This simulates a notification about a project workflow status change.',
    },
    {
      scenario: 'delivery_approved',
      subject: '[DropVerse SMTP Test 4/4] Delivery Approved',
      body: 'SMTP delivery test 4 of 4. Scenario: Delivery approved. This simulates a notification after a delivery is approved.',
    },
  ]

  const results: Array<{ scenario: string; sent: boolean }> = []
  for (const test of tests) {
    const sent = await sendGmailNotificationEmail(recipient, test.subject, test.body)
    results.push({ scenario: test.scenario, sent })
  }

  return NextResponse.json({
    ok: results.every((result) => result.sent),
    recipient,
    results,
  })
}
