import { NextResponse } from 'next/server'
import { clientIp, limitAuth, rateLimitResponse } from '@/lib/rateLimit'
import { verifyTurnstile } from '@/lib/turnstile'

export const runtime = 'nodejs'

/**
 * Pre-auth guard: rate-limit + optional Turnstile.
 * Login/signup forms should POST here before calling supabase.auth.
 */
export async function POST(request: Request) {
  const rl = await limitAuth(request)
  if (!rl.success) return rateLimitResponse(rl, 'Too many sign-in attempts. Please wait a minute and try again.')

  let token: string | null = null
  try {
    const body = await request.json()
    token = typeof body?.turnstileToken === 'string' ? body.turnstileToken : null
  } catch {
    /* empty body ok when turnstile not configured */
  }

  const ip = clientIp(request)
  const check = await verifyTurnstile(token, ip)
  if (!check.ok) {
    return NextResponse.json({ error: 'TURNSTILE_FAILED', message: 'Security check failed. Please try again.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, turnstileSkipped: Boolean(check.skipped) })
}
