'use client'

import { useState } from 'react'
import { getPaddleClient, paddleClientTokenConfigured } from '@/lib/paddle'
import type { PlanId } from '@/lib/planConfig'

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

      const paddle = await getPaddleClient()
      if (paddle && payload.transactionId) {
        paddle.Checkout.open({
          transactionId: payload.transactionId,
          settings: { displayMode: 'overlay', variant: 'one-page', theme: 'dark' },
        })
        setLoading(false)
      } else if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl)
      } else if (!paddleClientTokenConfigured()) {
        throw new Error('Set NEXT_PUBLIC_PADDLE_CLIENT_TOKEN (sandbox) in Vercel to open the in-app overlay.')
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
