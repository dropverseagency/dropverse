import { paymentsEnabled } from './projectConfig'

/** Minimal shape we need from Paddle.js — avoids a hard compile-time dependency. */
type PaddleLike = {
  Checkout: {
    open: (opts: Record<string, unknown>) => void
  }
}

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

/** @deprecated use paddleCheckoutPayload */
export function paddleApprovedCheckoutUrl(path = '/dashboard') {
  const payload = paddleCheckoutPayload()
  if (payload) return payload.url
  return `https://dropverse-nu.vercel.app${path.startsWith('/') ? path : `/${path}`}`
}

let paddlePromise: Promise<PaddleLike | undefined> | null = null

async function confirmTransactionClient(transactionId: string) {
  try {
    await fetch('/api/paddle/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId }),
      credentials: 'include',
    })
  } catch {
    // ignore
  }
}

/**
 * Browser-only Paddle.js instance.
 * Returns undefined when payments are disabled, token missing, or the optional
 * package is not installed. Dynamic import keeps the build green either way.
 */
export function getPaddleClient(): Promise<PaddleLike | undefined> {
  if (typeof window === 'undefined') return Promise.resolve(undefined)
  if (!paymentsEnabled()) return Promise.resolve(undefined)
  if (!paddleClientTokenConfigured()) return Promise.resolve(undefined)
  if (!paddlePromise) {
    paddlePromise = import('@paddle/paddle-js')
      .then((mod: { initializePaddle?: (opts: Record<string, unknown>) => Promise<PaddleLike | undefined> }) => {
        if (typeof mod.initializePaddle !== 'function') return undefined
        return mod.initializePaddle({
          token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN as string,
          environment: isPaddleSandbox() ? 'sandbox' : 'production',
          eventCallback: (event: { name?: string; data?: { transaction_id?: string } }) => {
            if (event.name === 'checkout.completed') {
              const id = String(event.data?.transaction_id ?? '')
              if (id) {
                void confirmTransactionClient(id).finally(() => {
                  window.location.assign(`/payment/success?transaction_id=${encodeURIComponent(id)}`)
                })
              } else {
                window.location.assign('/payment/success')
              }
            }
            if (event.name === 'checkout.error') {
              console.error('[paddle] checkout.error', event)
            }
          },
        })
      })
      .catch((err) => {
        console.error('[paddle] initialize failed or package missing', err)
        paddlePromise = null
        return undefined
      })
  }
  return paddlePromise
}
