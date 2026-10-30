/**
 * Cloudflare Turnstile server verification.
 * Configure TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY together.
 * When the secret is configured, verification fails closed on missing/invalid tokens
 * and on provider/network errors.
 */
let warnedMissingSecret = false

export type TurnstileResult = { ok: boolean; skipped?: boolean; reason?: string }

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()

  if (!secret) {
    // Fail closed if a public site key is configured without a secret (misconfiguration).
    if (siteKey) {
      console.error('[turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing')
      return { ok: false, reason: 'misconfigured' }
    }
    if (!warnedMissingSecret) {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY is missing; verification is skipped until configured')
      warnedMissingSecret = true
    }
    return { ok: true, skipped: true, reason: 'not_configured' }
  }

  if (!token || typeof token !== 'string' || token.length < 10) {
    return { ok: false, reason: 'missing_token' }
  }

  try {
    const body = new URLSearchParams()
    body.set('secret', secret)
    body.set('response', token)
    if (ip && ip !== 'unknown') body.set('remoteip', ip)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[turnstile] siteverify HTTP', res.status)
      return { ok: false, reason: 'provider_http' }
    }
    const data = (await res.json()) as { success?: boolean }
    if (!data.success) return { ok: false, reason: 'invalid_token' }
    return { ok: true }
  } catch {
    console.warn('[turnstile] verification service unavailable; rejecting request')
    return { ok: false, reason: 'provider_error' }
  }
}

/** True when server will require a valid Turnstile token (secret configured). */
export function turnstileRequired(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim())
}
