'use client'

import { useState } from 'react'
import Link from 'next/link'
import SpaceRemitPayForm from '@/components/SpaceRemitPayForm'

export default function LeadBuyPanel({
  packId,
  priceUsd,
  remaining,
  currency,
}: {
  packId: string
  priceUsd: number
  remaining: number
  currency: string
}) {
  const [phase, setPhase] = useState<'idle' | 'pay' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const [purchaseId, setPurchaseId] = useState<string | null>(null)
  const [publicKey, setPublicKey] = useState('')
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '' })
  const [termsAccepted, setTermsAccepted] = useState(false)

  async function startCheckout() {
    setMsg(null)
    if (!termsAccepted) {
      setPhase('error')
      setMsg('Please accept the Terms of Service and Refund Policy before continuing.')
      return
    }
    const res = await fetch(`/api/leads/${packId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acceptedTerms: true, termsVersion: '2026-10-23' }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.status === 401) {
      window.location.href = `/login?redirect=/leads/${packId}`
      return
    }
    if (!res.ok) {
      setPhase('error')
      setMsg(json.error || 'Checkout failed')
      return
    }
    setPurchaseId(json.purchaseId)
    setPublicKey(json.spaceremitPublicKey || '')
    setPhase('pay')
  }

  async function onPaid(code: string) {
    if (!purchaseId) return
    const res = await fetch('/api/leads/purchases/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseId, paymentId: code }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMsg(json.error || 'Could not verify payment')
      return
    }
    setPhase('done')
    setMsg('Payment confirmed. Download from My purchases.')
  }

  if (remaining <= 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0b2a26] px-5 py-4 text-sm text-[#8fa29c]">
        This pack is sold out.
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="rounded-2xl border border-[#6fbf73]/35 bg-[rgba(111,191,115,0.08)] p-5 text-sm text-[#9fd8a4]">
        {msg}{' '}
        <Link href="/dashboard/leads/purchases" className="font-semibold underline">
          Open purchases
        </Link>
      </div>
    )
  }

  if (phase === 'pay' && publicKey && purchaseId) {
    return (
      <div className="space-y-4 rounded-2xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.04)] p-5">
        <p className="text-sm text-[#c5d0cb]">
          Pay <span className="font-bold text-[#e4c979]">${priceUsd.toFixed(2)}</span> to unlock the pack.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#071f1d] p-3 text-xs leading-5 text-[#c5d0cb]">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[#d8b45a]"
          />
          <span>
            I agree to the <Link href="/terms" target="_blank" className="font-semibold text-[#e4c979] underline underline-offset-2">Terms of Service</Link> and <Link href="/refund" target="_blank" className="font-semibold text-[#e4c979] underline underline-offset-2">Refund Policy</Link>. I understand this is a digital lead file, review the stated fields/limitations, and agree that download/access and any complaint must be handled under these policies.
          </span>
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className="rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2 text-sm"
            placeholder="Full name"
            value={buyer.name}
            onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))}
          />
          <input
            className="rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2 text-sm"
            placeholder="Email"
            value={buyer.email}
            onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))}
          />
          <input
            className="rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2 text-sm"
            placeholder="Phone"
            value={buyer.phone}
            onChange={(e) => setBuyer((b) => ({ ...b, phone: e.target.value }))}
          />
        </div>
        <SpaceRemitPayForm
          amount={priceUsd}
          currency={currency}
          fullName={buyer.name || 'Buyer'}
          email={buyer.email || 'buyer@example.com'}
          phone={buyer.phone || '0000000000'}
          publicKey={publicKey}
          onPaid={onPaid}
          disabled={!termsAccepted}
          submitLabel={`Pay $${priceUsd.toFixed(2)} →`}
        />
        {msg ? <p className="text-xs text-red-300">{msg}</p> : null}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b2a26] p-5 space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#071f1d] p-3 text-xs leading-5 text-[#c5d0cb]">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[#d8b45a]"
          />
          <span>
            I agree to the <Link href="/terms" target="_blank" className="font-semibold text-[#e4c979] underline underline-offset-2">Terms of Service</Link> and <Link href="/refund" target="_blank" className="font-semibold text-[#e4c979] underline underline-offset-2">Refund Policy</Link>. I understand this is a digital lead file, review the stated fields/limitations, and agree that download/access and any complaint must be handled under these policies.
          </span>
        </label>
      <button
        type="button"
        onClick={startCheckout}
        disabled={!termsAccepted}
        className="w-full rounded-full bg-[#d8b45a] px-6 py-3.5 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Buy this pack — ${priceUsd.toFixed(2)}
      </button>
      {msg ? <p className="mt-3 text-center text-xs text-red-300">{msg}</p> : null}
      <p className="mt-3 text-center text-[11px] text-[#6f827c]">You must be logged in. Refund requests are reviewed under the published policy and applicable law.</p>
    </div>
  )
}
