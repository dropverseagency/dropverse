'use client'

import { useState } from 'react'
import { getPaddleClient, paddleClientTokenConfigured } from '@/lib/paddle'
import type { PlanId } from '@/lib/planConfig'
import { planById } from '@/lib/planConfig'
import PaymentMethodPicker, { type PaymentRail } from '@/components/PaymentMethodPicker'
import SpaceRemitPayForm from '@/components/SpaceRemitPayForm'
import { createClient } from '@/lib/supabase'

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
  const [rail, setRail] = useState<PaymentRail>('international')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localDone, setLocalDone] = useState(false)

  const plan = planById(planId)
  const publicKey = process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY || process.env.SPACEREMIT_PUBLIC_KEY || ''
  const canPurchase = planId !== 'SOLO' && planId !== 'ENTERPRISE' && plan.price > 0

  async function openInternationalCheckout() {
    if (loading || !canPurchase) return
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
        throw new Error('Paddle client token is not configured yet.')
      } else {
        throw new Error('Paddle checkout is not ready yet.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start plan checkout.')
      setLoading(false)
    }
  }

  async function confirmLocalPayment(transactionCode: string) {
    setError(null)
    try {
      if (!organizationId) {
        throw new Error('Sign in and open Billing from your workspace to confirm a local plan payment.')
      }
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Sign in to confirm local plan payment.')

      const response = await fetch('/api/plans/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentId: transactionCode,
          orgId: organizationId,
          planId,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          payload.error === 'PAYMENT_NOT_CONFIRMED'
            ? 'Could not confirm this SpaceRemit payment. Check the transaction code.'
            : payload.error || 'Unable to confirm local plan payment.',
        )
      }
      setLocalDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to confirm local plan payment.')
    }
  }

  if (!canPurchase) {
    return (
      <div className="mt-8">
        <button type="button" disabled className={className}>{label}</button>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-3">
      <PaymentMethodPicker value={rail} onChange={setRail} disabled={loading} />

      {rail === 'international' ? (
        <button type="button" onClick={openInternationalCheckout} disabled={loading} className={className}>
          {loading ? 'Opening secure checkout…' : `${label} · International`}
        </button>
      ) : localDone ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-center text-xs text-emerald-100">
          Local payment confirmed. Your workspace plan is updated.
        </div>
      ) : publicKey ? (
        <SpaceRemitPayForm
          amount={plan.price}
          currency={plan.currency || 'USD'}
          fullName="DropVerse Workspace"
          email="billing@dropverse.local"
          phone="0000000000"
          publicKey={publicKey}
          hideBuyerInputs
          submitLabel={`Pay $${plan.price}/mo locally →`}
          onPaid={confirmLocalPayment}
        />
      ) : (
        <p className="text-[11px] leading-4 text-[#82958f]">SpaceRemit public key is not configured.</p>
      )}

      {error && <p className="mt-2 text-[11px] leading-4 text-[#e89a8d]">{error}</p>}
    </div>
  )
}
