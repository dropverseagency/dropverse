'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Wallet,
  AlertCircle,
} from 'lucide-react'
import SiteHeader from '../../../components/SiteHeader'
import { useAuth } from '../../../lib/useAuth'
import {
  DROPVERSE_PAYOUT_FEE_USD,
  estimateNetUsd,
  formatUsd,
  type PayoutMethodId,
} from '../../../lib/payoutConfig'

type Method = {
  id: PayoutMethodId
  label: string
  minUsd: number
  enabled: boolean
  description: string
}

type PayoutPayload = {
  currency: string
  balances: { pending: number; available: number; processing: number; totalPaid: number }
  breakdown: {
    affiliate: { label: string; pending: number; available: number; paid: number }
    sourcesNote: string
  }
  policy: {
    dropverseFeeUsd: number
    scheduleDays: number[]
    nextScheduledProcessingDate: string
    scheduleNote: string
    withdrawalsEnabled: boolean
    transfersActivated: boolean
    transfersNote: string
  }
  methods: Method[]
  history: {
    id: string
    requestedAt: string
    amount: number
    currency: string
    dropverseFee: number | null
    providerFee: number | null
    estimatedNet: number | null
    method: string | null
    status: string
    paidAt: string | null
    failureReason: string | null
  }[]
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved — awaiting transfer',
    paid: 'Paid',
    cancelled: 'Cancelled',
    failed: 'Failed',
  }
  return map[s] || s
}

function statusClass(s: string) {
  if (s === 'paid') return 'text-[#8fd6a8] bg-[rgba(143,214,168,0.1)] border-[rgba(143,214,168,0.25)]'
  if (s === 'pending' || s === 'approved') return 'text-[#e4c979] bg-[rgba(216,180,90,0.1)] border-[rgba(216,180,90,0.25)]'
  if (s === 'cancelled' || s === 'failed') return 'text-[#e89a8d] bg-[rgba(232,154,141,0.1)] border-[rgba(232,154,141,0.25)]'
  return 'text-[#9aa8a3] bg-white/5 border-white/10'
}

export default function PayoutsPage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const [data, setData] = useState<PayoutPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [method, setMethod] = useState<PayoutMethodId>('paypal')
  const [amount, setAmount] = useState('')
  const [destination, setDestination] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formMsg, setFormMsg] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const idempotencyAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/payouts/me', { credentials: 'include' })
      if (res.status === 401) {
        window.location.assign('/login?redirect=%2Fdashboard%2Fpayouts')
        return
      }
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error || 'Failed to load payouts')
        setData(null)
      } else {
        setData(json)
        const firstEnabled = (json.methods as Method[] | undefined)?.find((m) => m.enabled)
        if (firstEnabled) setMethod(firstEnabled.id)
      }
    } catch {
      setError('Failed to load payouts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (auth.loading) return
    if (!auth.user) {
      window.location.assign('/login?redirect=%2Fdashboard%2Fpayouts')
      return
    }
    load()
  }, [auth.loading, auth.user, load])

  const selectedMethod = useMemo(
    () => data?.methods.find((m) => m.id === method),
    [data, method],
  )

  const amountNum = Math.round(Number(amount) * 100) / 100
  const feePreview = estimateNetUsd(Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0)

  function validateClient(): string | null {
    if (!selectedMethod?.enabled) return 'Selected method is not available.'
    if (!Number.isFinite(amountNum) || amountNum <= 0) return 'Enter a valid amount.'
    if (selectedMethod && amountNum < selectedMethod.minUsd) {
      return `Minimum for ${selectedMethod.label} is ${formatUsd(selectedMethod.minUsd)}.`
    }
    if (data && amountNum > data.balances.available) {
      return 'Amount exceeds your available balance.'
    }
    if (feePreview.estimatedNet <= 0) {
      return `Amount is too low after the ${formatUsd(DROPVERSE_PAYOUT_FEE_USD)} DropVerse fee.`
    }
    if (method === 'paypal' && destination && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination.trim())) {
      return 'Enter a valid PayPal email, or leave blank for ops to collect later.'
    }
    return null
  }

  async function submitRequest() {
    const v = validateClient()
    if (v) {
      setFormErr(v)
      setConfirmOpen(false)
      return
    }
    setSubmitting(true)
    setFormErr(null)
    setFormMsg(null)
    try {
      const fingerprint = JSON.stringify({ amount: amountNum, method, destination: destination.trim() })
      if (!idempotencyAttemptRef.current || idempotencyAttemptRef.current.fingerprint !== fingerprint) {
        idempotencyAttemptRef.current = { fingerprint, key: crypto.randomUUID() }
      }
      const attempt = idempotencyAttemptRef.current
      if (!attempt) throw new Error('Unable to prepare payout request. Please try again.')
      const res = await fetch('/api/payouts/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          method,
          destination: destination.trim() || undefined,
          idempotencyKey: attempt.key,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFormErr(json.message || json.error || 'Request failed')
        setConfirmOpen(false)
        return
      }
      idempotencyAttemptRef.current = null
      setFormMsg(json.message || 'Payout request recorded.')
      setAmount('')
      setConfirmOpen(false)
      await load()
    } catch {
      setFormErr('Request failed. Try again.')
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#071210]">
      <SiteHeader highlightEarn={false} />
      <div className="pt-20">
        <div className="container max-w-4xl pb-16">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#81948e] transition hover:text-[#d8b45a]"
              >
                <ArrowLeft size={13} /> Dashboard
              </Link>
              <h1 className="font-display mt-2 text-3xl font-extrabold text-[#f0f4f2]">Payouts</h1>
              <p className="mt-1 text-sm text-[#81948e]">
                Manage your earnings, withdrawal methods, and payout history.
              </p>
            </div>
            <Link
              href="/dashboard/affiliate"
              className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-semibold text-[#e4c979] transition hover:bg-[rgba(216,180,90,0.14)]"
            >
              Affiliate earnings →
            </Link>
          </div>

          {!signedIn || loading ? (
            <div className="rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] p-10 text-center text-sm text-[#81948e]">
              <Loader2 className="mx-auto mb-2 animate-spin text-[#d8b45a]" size={20} />
              Loading payouts…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-[rgba(232,154,141,0.35)] bg-[rgba(232,154,141,0.08)] p-6 text-sm text-[#e89a8d]">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Pending" value={formatUsd(data.balances.pending)} hint="Awaiting approval" />
                <Stat label="Available" value={formatUsd(data.balances.available)} hint="Eligible to withdraw" accent />
                <Stat label="Processing" value={formatUsd(data.balances.processing)} hint="Open requests" />
                <Stat label="Total paid" value={formatUsd(data.balances.totalPaid)} hint="Completed payouts" />
              </div>

              {/* Policy */}
              <div className="mt-5 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-4 text-sm text-[#c1cbc7]">
                <div className="flex items-start gap-2">
                  <Info size={16} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                  <div className="space-y-1.5">
                    <p>
                      <span className="font-semibold text-[#e4c979]">DropVerse fee:</span>{' '}
                      {formatUsd(data.policy.dropverseFeeUsd)} per successful payout request.
                    </p>
                    <p>
                      <span className="font-semibold text-[#e4c979]">Scheduled processing:</span>{' '}
                      {data.policy.scheduleDays.join(' & ')} of each month. Next:{' '}
                      <span className="font-mono text-[#f0f4f2]">{data.policy.nextScheduledProcessingDate}</span>
                    </p>
                    <p className="text-xs text-[#81948e]">{data.policy.scheduleNote}</p>
                    {!data.policy.transfersActivated && (
                      <p className="text-xs text-[#9db8ff]">{data.policy.transfersNote}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <section className="mt-8">
                <h2 className="font-display text-lg font-bold text-[#e8edea]">Earnings breakdown</h2>
                <p className="mt-1 text-xs text-[#81948e]">{data.breakdown.sourcesNote}</p>
                <div className="mt-3 rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#f0f4f2]">{data.breakdown.affiliate.label}</span>
                    <span className="text-sm text-[#c8d4d0]">
                      {formatUsd(data.breakdown.affiliate.available)} available ·{' '}
                      {formatUsd(data.breakdown.affiliate.pending)} pending ·{' '}
                      {formatUsd(data.breakdown.affiliate.paid)} paid
                    </span>
                  </div>
                </div>
              </section>

              {/* Methods + form */}
              <section className="mt-8">
                <h2 className="font-display text-lg font-bold text-[#e8edea]">Request withdrawal</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {data.methods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!m.enabled}
                      onClick={() => m.enabled && setMethod(m.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        method === m.id && m.enabled
                          ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.1)]'
                          : m.enabled
                            ? 'border-white/10 bg-[rgba(255,255,255,0.02)] hover:border-white/20'
                            : 'cursor-not-allowed border-white/5 bg-white/[0.01] opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#f0f4f2]">{m.label}</span>
                        {!m.enabled && (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#81948e]">
                            Coming soon
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#81948e]">{m.description}</p>
                      <p className="mt-2 text-xs text-[#9aa8a3]">Min {formatUsd(m.minUsd)}</p>
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-[#0a2926] p-5">
                  {data.balances.available <= 0 ? (
                    <div className="flex items-start gap-2 text-sm text-[#81948e]">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                      No available balance yet. Earnings become withdrawable after approval and the holding period.
                    </div>
                  ) : (
                    <>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#7f918c]">
                        Amount (USD)
                      </label>
                      <input
                        type="number"
                        min={selectedMethod?.minUsd ?? 0}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071210] px-4 py-3 text-sm text-[#f0f4f2] outline-none focus:border-[rgba(216,180,90,0.45)]"
                      />
                      <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-[#7f918c]">
                        Destination {method === 'paypal' ? '(PayPal email, optional)' : '(optional note)'}
                      </label>
                      <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder={method === 'paypal' ? 'you@example.com' : 'Account reference for ops'}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071210] px-4 py-3 text-sm text-[#f0f4f2] outline-none focus:border-[rgba(216,180,90,0.45)]"
                      />
                      <div className="mt-4 space-y-1 rounded-lg border border-white/5 bg-[#071210] px-4 py-3 text-sm">
                        <Row label="Requested" value={formatUsd(feePreview.gross)} />
                        <Row label="DropVerse fee" value={`− ${formatUsd(feePreview.dropverseFee)}`} />
                        <Row label="Provider fees" value="Unknown — may apply" muted />
                        <Row label="Estimated net" value={formatUsd(feePreview.estimatedNet)} strong />
                        <p className="pt-1 text-[11px] text-[#81948e]">
                          Next scheduled processing: {data.policy.nextScheduledProcessingDate}. Net is an estimate;
                          intermediary banks may charge additional fees.
                        </p>
                      </div>
                      {formErr && <p className="mt-3 text-sm text-[#e89a8d]">{formErr}</p>}
                      {formMsg && <p className="mt-3 text-sm text-[#8fd6a8]">{formMsg}</p>}
                      <button
                        type="button"
                        onClick={() => {
                          const v = validateClient()
                          if (v) {
                            setFormErr(v)
                            return
                          }
                          setFormErr(null)
                          setConfirmOpen(true)
                        }}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-5 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] sm:w-auto"
                      >
                        Continue <ArrowRight size={16} />
                      </button>
                    </>
                  )}
                </div>
              </section>

              {/* History */}
              <section className="mt-10">
                <h2 className="font-display text-lg font-bold text-[#e8edea]">Payout history</h2>
                {!data.history.length ? (
                  <div className="mt-3 rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] p-6 text-center text-sm text-[#81948e]">
                    No payout requests yet.
                  </div>
                ) : (
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/5">
                    <div className="hidden grid-cols-[1fr_100px_90px_90px_100px] gap-3 border-b border-white/5 bg-white/[0.02] px-4 py-2.5 text-[11px] uppercase tracking-wider text-[#7f918c] sm:grid">
                      <span>Date</span>
                      <span>Amount</span>
                      <span>Fee</span>
                      <span>Est. net</span>
                      <span>Status</span>
                    </div>
                    {data.history.map((h) => (
                      <div
                        key={h.id}
                        className="border-b border-white/5 px-4 py-3.5 text-sm last:border-b-0 sm:grid sm:grid-cols-[1fr_100px_90px_90px_100px] sm:gap-3 sm:items-center"
                      >
                        <div>
                          <div className="font-medium text-[#f0f4f2]">
                            {new Date(h.requestedAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-[#81948e] sm:hidden">
                            {formatUsd(h.amount)} · fee {h.dropverseFee == null ? 'not recorded' : formatUsd(h.dropverseFee)}
                          </div>
                          <div className="text-xs text-[#81948e]">
                            {h.method ? h.method.toUpperCase() : 'Method not recorded'}
                          </div>
                        </div>
                        <div className="hidden text-[#c8d4d0] sm:block">{formatUsd(h.amount)}</div>
                        <div className="hidden text-[#81948e] sm:block">{h.dropverseFee == null ? '—' : formatUsd(h.dropverseFee)}</div>
                        <div className="hidden text-[#c8d4d0] sm:block">{h.estimatedNet == null ? '—' : formatUsd(h.estimatedNet)}</div>
                        <div className="mt-2 sm:mt-0">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusClass(h.status)}`}>
                            {statusLabel(h.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a2926] p-6 shadow-2xl">
            <h3 className="font-display text-xl font-bold text-[#f0f4f2]">Confirm payout request</h3>
            <p className="mt-2 text-sm text-[#81948e]">
              No automatic transfer will be sent yet. Ops will process on a scheduled payout date.
            </p>
            <div className="mt-4 space-y-1 rounded-lg border border-white/5 bg-[#071210] px-4 py-3 text-sm">
              <Row label="Method" value={selectedMethod?.label || method} />
              <Row label="Amount" value={formatUsd(feePreview.gross)} />
              <Row label="DropVerse fee" value={`− ${formatUsd(feePreview.dropverseFee)}`} />
              <Row label="Estimated net" value={formatUsd(feePreview.estimatedNet)} strong />
              {destination && <Row label="Destination" value={destination} />}
              <Row label="Next processing" value={data?.policy.nextScheduledProcessingDate || '—'} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={submitRequest}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-4 py-3 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b] disabled:opacity-60"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Submit request
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="rounded-full border border-white/15 px-4 py-3 text-sm font-semibold text-[#c8d4d0] hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint: string
  accent?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? 'border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.06)]'
          : 'border-white/5 bg-[rgba(255,255,255,0.02)]'
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#7f918c]">
        {label === 'Available' ? <Wallet size={13} className="text-[#d8b45a]" /> : <Clock size={13} className="text-[#d8b45a]" />}
        {label}
      </div>
      <div className="mt-1 text-xl font-extrabold text-[#f0f4f2] sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-[11px] text-[#81948e]">{hint}</div>
    </div>
  )
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#81948e]">{label}</span>
      <span className={strong ? 'font-bold text-[#f0d98b]' : muted ? 'text-[#7f918c]' : 'text-[#e8efe9]'}>
        {value}
      </span>
    </div>
  )
}
