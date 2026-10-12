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
