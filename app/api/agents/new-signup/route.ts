import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/leads/auth'
import { runNewSignupAgent } from '@/lib/agents/newSignupAgent'

export const runtime = 'nodejs'

function agentsEnabled(): boolean {
  return process.env.AGENTS_ENABLED === 'true'
}

/**
 * Authenticated user notifies admin of their own completed signup/onboarding.
 * Idempotent per user id. Never throws hard failures to the client flow.
 */
export async function POST() {
  if (!agentsEnabled()) {
    return NextResponse.json({ ok: true, skipped: 'AGENTS_DISABLED' })
  }

  try {
    const { userId, email } = await requireUser()
    const result = await runNewSignupAgent({ userId, email })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
    console.error('[agents/new-signup]', e)
    return NextResponse.json({ ok: true, processed: false, skipped: 'INTERNAL_ERROR' })
  }
}
