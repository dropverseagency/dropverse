'use client'
import { useEffect, useState } from 'react'

import { CreditCard, Wallet, CheckCircle2, Globe } from 'lucide-react'
import { createClient } from '../lib/supabase'
import { type OrgRow } from '../lib/orgs'
import { PLAN_CONFIG, planById, type PlanId } from '../lib/planConfig'
import { getPaddleClient } from '@/lib/paddle'
import SpaceRemitPayForm from '@/components/SpaceRemitPayForm'

interface PlanUpgradeBannerProps {
  orgs: OrgRow[]
  activeOrgId: string | null
  sessionToken: string | null
}

export default function PlanUpgradeBanner({ orgs, activeOrgId, sessionToken }: PlanUpgradeBannerProps) {
  const [requested, setRequested] = useState<string | null>(null)
  const org = orgs.find((o) => o.id === activeOrgId) ?? null
  useEffect(() => {
    const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('plan') : null
    setRequested(p)
  }, [])

  const [open, setOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [method, setMethod] = useState<'SPACEREMIT' | 'PADDLE' | 'DIRECT' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const publicKey = process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY || process.env.SPACEREMIT_PUBLIC_KEY || ''

  useEffect(() => {
    if (!requested || !org) return
    const plan = PLAN_CONFIG.find((p) => p.id === requested)
    if (plan) {
      setSelectedPlan(plan.id)
      setOpen(true)
    }
  }, [requested, org])

  if (!open || !org || !selectedPlan) return null
  const plan = planById(selectedPlan as never)
  const same = org.plan === selectedPlan

  async function confirmDirect() {
    if (!sessionToken || !org) return
    setBusy(true); setError(null)
    const supabase = createClient()
    const { error: upErr } = await supabase
      .from('organizations')
      .update({ plan: selectedPlan, updated_at: new Date().toISOString() })
      .eq('id', org.id)
    setBusy(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setDone(`Your workspace is now on the ${plan.displayName} plan.`)
  }

  async function openPaddleCheckout() {
    if (!org || !selectedPlan || busy) return
    setBusy(true); setError(null)
    try {
      const response = await fetch('/api/paddle/plan-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId: selectedPlan as PlanId, organizationId: org.id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to start international checkout.')
      const paddle = await getPaddleClient()
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
      setError(err instanceof Error ? err.message : 'Unable to start international checkout.')
    } finally {
      setBusy(false)
    }
  }

  async function onLocalPaid(transactionCode: string) {
    if (!sessionToken || !org || !selectedPlan) return
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/plans/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ paymentId: transactionCode.trim(), orgId: org.id, planId: selectedPlan }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(
          json.error === 'SP_KEYS_MISSING'
            ? 'Payment verification is not available yet — please try again shortly.'
            : json.error === 'PAYMENT_NOT_CONFIRMED'
              ? 'We could not confirm this payment. Please try again or contact support.'
              : (json.detail ?? json.error ?? 'Verification failed.'),
        )
        return
      }
      setDone(`Payment confirmed — your workspace is now on the ${plan.displayName} plan.`)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-[rgba(216,180,90,0.45)] bg-[rgba(216,180,90,0.08)] p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-[#d8b45a]" />
          <div className="flex-1">
            <p className="font-bold text-[#e4c979]">{done}</p>
            <p className="mt-1 text-xs leading-5 text-[#8fa29c]">Your plan change is applied immediately. Enjoy the new features.</p>
          </div>
        </div>
      </div>
    )
  }

  const canPay = plan.price > 0 && !plan.enterprise && !same
  const canDirect = plan.price === 0 && !plan.enterprise && !same

  return (
    <div className="rounded-3xl border border-[rgba(216,180,90,0.45)] bg-[rgba(216,180,90,0.08)] p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d8b45a]">Upgrade your workspace</p>
          <h2 className="font-display mt-1 text-xl font-extrabold sm:text-2xl">
            {plan.displayName} Plan — {plan.price === 0 ? 'Free' : `$${plan.price}/month`}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#8fa29c]">
            You chose this plan from Pricing. Pick International or Local payment.
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-bold text-[#9aaba6] transition hover:border-white/25"
        >
          Not now
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => { setMethod('PADDLE'); openPaddleCheckout() }}
          disabled={busy || !canPay}
          className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
            method === 'PADDLE'
              ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]'
              : canPay
                ? 'border-white/10 bg-[#071f1d] hover:border-[rgba(216,180,90,0.30)]'
                : 'cursor-not-allowed border-white/5 bg-[#071f1d]/40 opacity-40'
          }`}
        >
          <Globe size={18} className="shrink-0 text-[#d8b45a]" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d8b45a]">International payment</div>
            <div className="text-sm font-bold text-[#d9e0dc]">Paddle</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMethod('SPACEREMIT')}
          disabled={busy || !canPay}
          className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
            method === 'SPACEREMIT'
              ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]'
              : canPay
                ? 'border-white/10 bg-[#071f1d] hover:border-[rgba(216,180,90,0.30)]'
                : 'cursor-not-allowed border-white/5 bg-[#071f1d]/40 opacity-40'
          }`}
        >
          <Wallet size={18} className="shrink-0 text-[#d8b45a]" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d8b45a]">Local payment</div>
            <div className="text-sm font-bold text-[#d9e0dc]">SpaceRemit</div>
          </div>
        </button>
        {canDirect && (
          <button
            type="button"
            onClick={() => { setMethod('DIRECT'); confirmDirect() }}
            disabled={busy}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#071f1d] p-4 text-left transition hover:border-[rgba(216,180,90,0.30)] sm:col-span-2"
          >
            <CreditCard size={18} className="shrink-0 text-[#d8b45a]" />
            <span className="text-sm font-bold text-[#d9e0dc]">Activate free plan</span>
          </button>
        )}
      </div>

      {method === 'SPACEREMIT' && (
        <div className="mt-5 rounded-2xl border border-[rgba(216,180,90,0.25)] bg-[#0a2926] p-5">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#6e817c]">
            Local payment · SpaceRemit
          </p>
          <p className="mt-2 text-[11px] leading-5 text-[#8fa29c]">
            Choose a local method below (wallet, bank transfer, etc.). No need to paste a transaction code — confirmation is automatic after payment.
          </p>
          {publicKey ? (
            <div className="mt-4">
              <SpaceRemitPayForm
                amount={plan.price}
                currency={plan.currency || 'USD'}
                fullName="DropVerse Workspace"
                email="billing@dropverse.local"
                phone="0000000000"
                publicKey={publicKey}
                hideBuyerInputs
                submitLabel={`Pay $${plan.price}/mo locally →`}
                onPaid={onLocalPaid}
                disabled={busy}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs text-[#e89a8d]">SpaceRemit is not configured yet.</p>
          )}
          {error && <p className="mt-3 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs font-semibold text-red-300">{error}</p>}
        </div>
      )}

      {method === 'PADDLE' && error && (
        <p className="mt-3 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs font-semibold text-red-300">{error}</p>
      )}
    </div>
  )
}
