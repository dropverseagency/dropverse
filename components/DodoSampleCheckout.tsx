'use client'

import { useState } from 'react'

export default function DodoSampleCheckout({
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
      const response = await fetch('/api/dodo/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sampleId }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to start checkout.')
      if (!payload.checkoutUrl) throw new Error('Dodo checkout is not configured for this product yet.')
      window.location.assign(payload.checkoutUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-4">
      <button type="button" onClick={startCheckout} disabled={disabled || !sampleId || loading} className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.10)] px-4 py-2.5 text-xs font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.20)] disabled:cursor-not-allowed disabled:opacity-45">
        {loading ? 'Opening secure checkout…' : 'Order for Client'}
      </button>
      {error && <p className="mt-2 text-[11px] leading-4 text-[#e89a8d]">{error}</p>}
      {!sampleId && <p className="mt-2 text-[11px] leading-4 text-[#82958f]">This sample is a format preview. Published samples can be ordered.</p>}
    </div>
  )
}
