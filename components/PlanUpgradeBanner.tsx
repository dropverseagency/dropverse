'use client'
import { useEffect, useState } from 'react'

import { CreditCard, Wallet, Star, CheckCircle2 } from 'lucide-react'
import { createClient } from '../lib/supabase'
import { type OrgRow } from '../lib/orgs'
import { PLAN_CONFIG, planById } from '../lib/planConfig'

const SPACEREMIT_API = 'https://spaceremit.com/api/v2/payment_info/'

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
  const [method, setMethod] = useState<'SPACEREMIT' | 'DIRECT' | null>(null)
  const [transactionCode, setTransactionCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [payEmail, setPayEmail] = useState('')
  const [payPhone, setPayPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [planPaid, setPlanPaid] = useState<string | null>(null)

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
    setPlanPaid(selectedPlan)
  }

  async function verifySpaceremit() {
    if (!sessionToken || !org || !transactionCode.trim()) return
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
              ? 'We could not confirm this payment. Make sure the transaction code is correct and the payment succeeded.'
              : (json.detail ?? json.error ?? 'Verification failed.'),
        )
        setBusy(false)
        return
      }
      setDone(`Payment confirmed — your workspace is now on the ${plan.displayName} plan.`)
      setPlanPaid(selectedPlan)
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
            You chose this plan from Pricing. Pick how you want to activate it.
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-bold text-[#9aaba6] transition hover:border-white/25"
        >
          Not now
        </button>
      </div>

      {/* Payment method */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
          <span className="text-sm font-bold text-[#d9e0dc]">Pay with SpaceRemit</span>
        </button>
        <button
          type="button"
          onClick={() => { setMethod('DIRECT'); confirmDirect() }}
          disabled={busy || !canDirect}
          className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
            method === 'DIRECT'
              ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]'
              : canDirect
                ? 'border-white/10 bg-[#071f1d] hover:border-[rgba(216,180,90,0.30)]'
                : 'cursor-not-allowed border-white/5 bg-[#071f1d]/40 opacity-40'
          }`}
        >
          <CreditCard size={18} className="shrink-0 text-[#d8b45a]" />
          <span className="text-sm font-bold text-[#d9e0dc]">{plan.price === 0 ? 'Activate free plan' : 'Pay with DropVerse'}</span>
        </button>
      </div>

      {method === 'SPACEREMIT' && (
        <div className="mt-5 rounded-2xl border border-[rgba(216,180,90,0.25)] bg-[#0a2926] p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-[#6e817c]">
            <Star size={13} className="text-[#d8b45a]" /> SpaceRemit Checkout
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none"
            />
            <input
              value={payEmail}
              onChange={(e) => setPayEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none"
            />
            <input
              value={payPhone}
              onChange={(e) => setPayPhone(e.target.value)}
              placeholder="Phone"
              className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none"
            />
            <input
              value={transactionCode}
              onChange={(e) => setTransactionCode(e.target.value)}
              placeholder="Transaction code"
              className="w-full rounded-xl border border-[rgba(216,180,90,0.35)] bg-[#071f1d] px-4 py-3 text-sm font-bold text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.6)] focus:outline-none"
            />
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[#6e817c]">
            Pay <span className="font-bold text-[#f0d98b]">${plan.price}/month</span> on SpaceRemit, then paste the transaction code here.
            The plan activates once the payment is verified.
          </p>
          <button
            onClick={verifySpaceremit}
            disabled={busy || !transactionCode.trim()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Verifying...' : 'Verify Payment & Upgrade'}
          </button>
          {error && (
            <p className="mt-3 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs font-semibold text-red-300">{error}</p>
          )}
        </div>
      )}

      {method === 'DIRECT' && canPay && (
        <p className="mt-4 text-xs leading-5 text-[#8fa29c]">
          Direct billing will be available soon — for now, pay with SpaceRemit or contact dropverseagency@gmail.com.
        </p>
      )}
    </div>
  )
}
