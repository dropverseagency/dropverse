/**
 * Cloudflare Turnstile server verification.
 * Configure TURNSTILE_SECRET_KEY and its matching public site key before
 * requiring this on public forms. Once configured, verification fails closed.
 */
let warnedMissingSecret = false
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<{ ok: boolean; skipped?: boolean }> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    if (!warnedMissingSecret) { console.warn('[turnstile] TURNSTILE_SECRET_KEY is missing; verification is skipped until configured'); warnedMissingSecret = true }
    return { ok: true, skipped: true }
  }
  if (!token || typeof token !== 'string' || token.length < 10) return { ok: false }
  try {
    const body = new URLSearchParams(); body.set('secret',secret); body.set('response',token)
    if (ip && ip !== 'unknown') body.set('remoteip',ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,cache:'no-store'})
    if (!res.ok) return {ok:false}
    const data = await res.json() as {success?:boolean}
    return {ok:Boolean(data.success)}
  } catch { console.warn('[turnstile] verification service unavailable; rejecting request'); return {ok:false} }
}
