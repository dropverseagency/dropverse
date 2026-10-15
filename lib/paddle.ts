/**
 * Paddle helpers. Client SDK is optional: load only when the package is installed
 * and NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is configured.
 */

export function isPaddleSandbox() {
  return (process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox').toLowerCase() === 'sandbox'
}

export function paddleApiBase() {
  return isPaddleSandbox() ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'
}

export function paddleClientTokenConfigured() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || ''
  return Boolean(token) && !token.startsWith('\u0648\u0636\u0639_\u0647\u0646\u0627_') && !token.startsWith('YOUR_') && !token.includes('placeholder')
}

/**
 * Optional checkout.url for Paddle transactions.
 * By default we OMIT it so Paddle uses the account "Default payment link".
 */
export function paddleCheckoutPayload(): { url: string } | undefined {
  const configured = (process.env.NEXT_PUBLIC_PADDLE_CHECKOUT_URL || '').trim()
  if (!configured) return undefined
  let url = configured
  if (!url.startsWith('http')) url = `https://${url}`
  try {
    // eslint-disable-next-line no-new
    new URL(url)
  } catch {
    return undefined
  }
  return { url }
}

type PaddleLike = {
  Checkout?: { open: (opts: Record<string, unknown>) => void }
  Environment?: unknown
}

let paddlePromise: Promise<PaddleLike | undefined> | null = null

/** Lazy-load @paddle/paddle-js only when available and configured. */
export function getPaddleClient(): Promise<PaddleLike | undefined> {
  if (!paddleClientTokenConfigured()) return Promise.resolve(undefined)
  if (typeof window === 'undefined') return Promise.resolve(undefined)
  if (!paddlePromise) {
    paddlePromise = (async () => {
      try {
        // Optional dependency — ignore at webpack build time if package is not installed.
        const mod = await import(
          /* webpackIgnore: true */
          '@paddle/paddle-js'
        ).catch(() => null)
        if (!mod?.initializePaddle) return undefined
        const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || ''
        const paddle = await mod.initializePaddle({
          token,
          environment: isPaddleSandbox() ? 'sandbox' : 'production',
        })
        return paddle as PaddleLike | undefined
      } catch (err) {
        console.warn('[paddle] client init failed', err)
        return undefined
      }
    })()
  }
  return paddlePromise
}
