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
 * Optional checkout.url for Paddle transactions.
 * By default we OMIT it so Paddle uses the account "Default payment link".
 * Only set NEXT_PUBLIC_PADDLE_CHECKOUT_URL if that domain is already approved in Paddle.
 * Example: NEXT_PUBLIC_PADDLE_CHECKOUT_URL=https://dropverse-nu.vercel.app/dashboard
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

/** @deprecated use paddleCheckoutPayload — kept for any remaining callers */
export function paddleApprovedCheckoutUrl(path = '/dashboard') {
  const payload = paddleCheckoutPayload()
  if (payload) return payload.url
  return `https://dropverse-nu.vercel.app${path.startsWith('/') ? path : `/${path}`}`
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
