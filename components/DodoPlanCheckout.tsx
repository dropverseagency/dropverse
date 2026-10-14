'use client'

import { useState } from 'react'
import type { PlanId } from '@/lib/planConfig'

export default function DodoPlanCheckout({
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
      const response = await fetch('/api/dodo/plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId, organizationId: organizationId || null }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to start plan checkout.')
      if (!payload.checkoutUrl) throw new Error('Dodo checkout is not configured for this plan yet.')
      window.location.assign(payload.checkoutUrl)
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
