'use client'

import { useMemo, useState } from 'react'
import { getPaddleClient, paddleClientTokenConfigured } from '@/lib/paddle'
import PaymentMethodPicker, { type PaymentRail } from '@/components/PaymentMethodPicker'
import SpaceRemitPayForm from '@/components/SpaceRemitPayForm'

export default function PaddleSampleCheckout({
  sampleId,
  amount,
  title,
  disabled = false,
}: {
  sampleId?: string
  amount?: number | null
  title?: string
  disabled?: boolean
}) {
  const [rail, setRail] = useState<PaymentRail>('international')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localDone, setLocalDone] = useState(false)

  const publicKey = process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY || process.env.SPACEREMIT_PUBLIC_KEY || ''
  const localAmount = useMemo(() => {
    const n = Number(amount)
    return Number.isFinite(n) && n > 0 ? n : null
  }, [amount])

  async function startInternationalCheckout() {
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
        throw new Error('Paddle client token is not configured yet.')
      } else {
        throw new Error('Paddle checkout is not ready yet.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.')
      setLoading(false)
    }
  }

  function onLocalPaid(transactionCode: string) {
    // Sample local payments are recorded client-side for now; support can match the SpaceRemit code.
    console.info('[dropverse] local sample payment', { sampleId, title, transactionCode, amount: localAmount })
    setLocalDone(true)
  }

  return (
    <div className="mt-4 space-y-3">
      <PaymentMethodPicker value={rail} onChange={setRail} disabled={disabled || !sampleId || loading} />

      {rail === 'international' ? (
        <button
          type="button"
          onClick={startInternationalCheckout}
          disabled={disabled || !sampleId || loading}
          className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.10)] px-4 py-2.5 text-xs font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.20)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? 'Opening secure checkout…' : 'Pay internationally with Paddle'}
        </button>
      ) : localDone ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-center text-xs text-emerald-100">
          Local payment received{title ? ` for ${title}` : ''}. We will confirm your order shortly.
        </div>
      ) : localAmount && publicKey ? (
        <SpaceRemitPayForm
          amount={localAmount}
          currency="USD"
          fullName="DropVerse Client"
          email="client@dropverse.local"
          phone="0000000000"
          publicKey={publicKey}
          hideBuyerInputs
          submitLabel={`Pay $${localAmount} locally →`}
          onPaid={onLocalPaid}
          disabled={disabled || !sampleId}
        />
      ) : (
        <p className="text-[11px] leading-4 text-[#82958f]">
          Local payment needs a published sample price. Use International payment, or publish a priced sample.
        </p>
      )}

      {error && <p className="text-[11px] leading-4 text-[#e89a8d]">{error}</p>}
      {!sampleId && (
        <p className="text-[11px] leading-4 text-[#82958f]">This sample is a format preview. Published samples can be ordered.</p>
      )}
    </div>
  )
}
