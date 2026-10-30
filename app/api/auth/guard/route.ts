import { NextResponse } from 'next/server'
import { clientIp, limitAuth, rateLimitResponse } from '@/lib/rateLimit'
import { verifyTurnstile } from '@/lib/turnstile'
import { reportServerError } from '@/lib/opsAlerts'
import { notifyAdminEvent } from '@/lib/agents/adminNotify'

export const runtime = 'nodejs'

/**
 * Pre-auth guard: rate-limit + optional Turnstile.
 * Login/signup forms should POST here before calling supabase.auth.
 */
export async function POST(request: Request) {
  const rl = await limitAuth(request)
  if (!rl.success) {
    const ip = clientIp(request)
    void notifyAdminEvent({
      agent: 'auth_rate_limit',
      idempotencyKey: `auth_rl:${ip}:${Math.floor(Date.now() / 60000)}`,
      entityId: ip || 'unknown',
      title: 'Auth rate limit hit',
      lines: [`IP: ${ip || 'unknown'}`, 'Endpoint: /api/auth/guard'],
      adminPath: '/admin',
    })
    return rateLimitResponse(rl, 'Too many sign-in attempts. Please wait a minute and try again.')
  }

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
    if (check.reason === 'misconfigured' || check.reason === 'provider_http' || check.reason === 'provider_error') {
      await reportServerError(new Error(`Turnstile verification failed: ${check.reason}`), {
        source: 'turnstile-provider',
        path: '/api/auth/guard',
        method: 'POST',
      })
    }
    return NextResponse.json({ error: 'TURNSTILE_FAILED', message: 'Security check failed. Please try again.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, turnstileSkipped: Boolean(check.skipped) })
}
