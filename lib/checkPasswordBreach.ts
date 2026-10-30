/**
 * Free-tier substitute for Supabase's native leaked-password protection.
 *
 * Uses Have I Been Pwned's Pwned Passwords k-anonymity range API:
 * the full password is hashed locally, and only the first five SHA-1
 * hex characters are sent. The full hash suffix is compared locally.
 *
 * This is an application-level check, not equivalent to Supabase's native
 * protection. Callers should block the password if the lookup is unavailable
 * so the security check does not silently fail open.
 */
export type PasswordBreachStatus = 'compromised' | 'safe' | 'unavailable'

export async function checkPasswordBreach(password: string): Promise<PasswordBreachStatus> {
  if (!password || !globalThis.crypto?.subtle) return 'unavailable'

  let controller: AbortController | undefined
  try {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-1',
      new TextEncoder().encode(password),
    )
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('').toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    controller = new AbortController()
    const timeout = setTimeout(() => controller?.abort(), 6000)
    let response: Response
    try {
      response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        method: 'GET',
        headers: { 'Add-Padding': 'true' },
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) return 'unavailable'
    const body = await response.text()
    for (const line of body.split(/\r?\n/)) {
      const separator = line.indexOf(':')
      if (separator < 0) continue
      const returnedSuffix = line.slice(0, separator).trim().toUpperCase()
      const count = Number.parseInt(line.slice(separator + 1).trim(), 10)
      if (returnedSuffix === suffix && Number.isFinite(count) && count > 0) {
        return 'compromised'
      }
    }
    return 'safe'
  } catch {
    return 'unavailable'
  } finally {
    controller?.abort()
  }
}
