import { initializePaddle, type Paddle } from '@paddle/paddle-js'

export function isPaddleSandbox() {
  return (process.env.NEXT_PUBLIC_PADDLE_ENV || 'sandbox').toLowerCase() === 'sandbox'
}

export function paddleApiBase() {
  return isPaddleSandbox() ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'
}

export function paddleClientTokenConfigured() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || ''
  return Boolean(token) && !token.startsWith('ضع_هنا_') && !token.startsWith('YOUR_') && !token.includes('placeholder')
}

/**
 * Return URL passed to Paddle as checkout.url.
 * Must be a domain already approved in Paddle Checkout settings.
 * Prefer NEXT_PUBLIC_PADDLE_CHECKOUT_URL, then the production site, never a preview alias.
 */
export function paddleApprovedCheckoutUrl(path = '/dashboard') {
  const configured =
    process.env.NEXT_PUBLIC_PADDLE_CHECKOUT_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://dropverse.js.org'

  let origin = configured.trim()
  if (!origin.startsWith('http')) origin = `https://${origin}`
  // Never send Vercel preview / random deployment hosts to Paddle.
  try {
    const u = new URL(origin)
    const host = u.hostname.toLowerCase()
    const blocked =
      host.endsWith('.vercel.app') &&
      host !== 'dropverse-nu.vercel.app' &&
      host !== 'dropverse10v.vercel.app'
    if (blocked || host.includes('localhost')) {
      origin = 'https://dropverse.js.org'
    }
  } catch {
    origin = 'https://dropverse.js.org'
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${origin.replace(/\/$/, '')}${normalizedPath}`
}

let paddlePromise: Promise<Paddle | undefined> | null = null

/** Browser-only Paddle.js instance for overlay checkout. */
export function getPaddleClient() {
  if (typeof window === 'undefined') return Promise.resolve(undefined)
  if (!paddleClientTokenConfigured()) return Promise.resolve(undefined)
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN as string,
      environment: isPaddleSandbox() ? 'sandbox' : 'production',
      eventCallback: (event) => {
        if (event.name === 'checkout.completed') {
          const id = event.data?.transaction_id ?? ''
          window.location.assign(`/payment/success?transaction_id=${encodeURIComponent(id)}`)
        }
      },
    })
  }
  return paddlePromise
}
