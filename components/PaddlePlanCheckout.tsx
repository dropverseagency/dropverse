'use client'

import { useState } from 'react'
import { initializePaddle, type Paddle } from '@paddle/paddle-js'
import type { PlanId } from '@/lib/planConfig'

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

export default function PaddlePlanCheckout({
  planId,
  organizationId,
  label,
  className,
}: {
  planId: PlanId
  organizationId?: string | null
  label: string
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openCheckout() {
    if (loading || planId === 'SOLO' || planId === 'ENTERPRISE') return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/paddle/plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId, organizationId: organizationId || null }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to start plan checkout.')

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
      setError(err instanceof Error ? err.message : 'Unable to start plan checkout.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-8">
      <button type="button" onClick={openCheckout} disabled={loading} className={className}>
        {loading ? 'Opening secure checkout…' : label}
      </button>
      {error && <p className="mt-2 text-[11px] leading-4 text-[#e89a8d]">{error}</p>}
    </div>
  )
}
