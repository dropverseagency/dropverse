import { paymentsEnabled } from './projectConfig'

type PaddleLike = {
  Checkout: {
    open: (opts: Record<string, unknown>) => void
  }
}

declare global {
  interface Window {
    Paddle?: PaddleLike & {
      Environment?: { set: (env: string) => void }
      Initialize?: (opts: Record<string, unknown>) => void
      Setup?: (opts: Record<string, unknown>) => void
    }
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

function loadPaddleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('no document'))
      return
    }
    const existing = document.querySelector('script[data-paddle-js]')
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.async = true
    script.dataset.paddleJs = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('paddle script failed to load'))
    document.head.appendChild(script)
  })
}

/**
 * Browser-only Paddle client. No-ops when payments are disabled.
 * Loads the official CDN script so the Next.js build never needs @paddle/paddle-js.
 */
export function getPaddleClient(): Promise<PaddleLike | undefined> {
  if (typeof window === 'undefined') return Promise.resolve(undefined)
  if (!paymentsEnabled()) return Promise.resolve(undefined)
  if (!paddleClientTokenConfigured()) return Promise.resolve(undefined)
  if (!paddlePromise) {
    paddlePromise = loadPaddleScript()
      .then(() => {
        const Paddle = window.Paddle
        if (!Paddle) return undefined
        if (isPaddleSandbox() && Paddle.Environment?.set) {
          Paddle.Environment.set('sandbox')
        }
        if (typeof Paddle.Initialize === 'function') {
          Paddle.Initialize({
            token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN as string,
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
        }
        return Paddle as PaddleLike
      })
      .catch((err) => {
        console.error('[paddle] initialize failed', err)
        paddlePromise = null
        return undefined
      })
  }
  return paddlePromise
}
