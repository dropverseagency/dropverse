'use client'

import { useState } from 'react'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'

let paddlePromise: Promise<Paddle | undefined> | null = null

function getPaddle() {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
  if (!token || token.startsWith('ضع_هنا_') || token.startsWith('YOUR_')) return Promise.resolve(undefined)
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token,
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV === 'sandbox' ? 'sandbox' : 'production',
      eventCallback: (event) => {
        if (event.name === 'checkout.completed') {
          window.location.assign(`/payment/success?transaction_id=${encodeURIComponent(event.data?.transaction_id ?? '')}`)
        }
      },
    })
  }
  return paddlePromise
}

export default function PaddleSampleCheckout({
  sampleId,
  disabled = false,
}: {
  sampleId?: string
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout() {
    if (!sampleId || loading) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/paddle/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sampleId }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to start checkout.')

      const paddle = await getPaddle()
      if (paddle && payload.transactionId) {
        paddle.Checkout.open({
          transactionId: payload.transactionId,
          settings: { displayMode: 'overlay', variant: 'one-page', theme: 'dark' },
        })
      } else if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl)
      } else {
        throw new Error('Paddle checkout is not ready yet.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={startCheckout}
        disabled={disabled || !sampleId || loading}
        className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.10)] px-4 py-2.5 text-xs font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.20)] disabled:cursor-not-allowed disabled:opacity-45"
      >
        {loading ? 'Opening secure checkout…' : 'Order for Client'}
      </button>
      {error && <p className="mt-2 text-[11px] leading-4 text-[#e89a8d]">{error}</p>}
      {!sampleId && <p className="mt-2 text-[11px] leading-4 text-[#82958f]">This sample is a format preview. Published samples can be ordered.</p>}
    </div>
  )
}
