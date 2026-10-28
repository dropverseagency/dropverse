'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Wallet,
  AlertCircle,
  Landmark,
  Mail,
} from 'lucide-react'
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
    affiliate: { label: string; pending: number; available: number; availableBeforeReservations?: number; paid: number; paidThroughWithdrawals?: number }
    projectEarnings: { label: string; pending: number; releasable: number; released: number }
    sourcesNote: string
  }
  policy: {
    dropverseFeeUsd: number
    scheduleDays: number[]
    requestCutoffDays: number[]
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
    dropverseFee: number
    providerFee: number | null
    estimatedNet: number
    method: string | null
    status: string
    paidAt: string | null
    transferReference: string | null
    failureReason: string | null
  }[]
}

type SavedMethods = {
  preferredMethod: PayoutMethodId | null
  paypalEmail: string | null
  localDetails: string | null
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: 'Pending',
    approved: 'Processing',
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
  const [profileMissing, setProfileMissing] = useState<string[]>([])

  const [method, setMethod] = useState<PayoutMethodId>('paypal')
  const [amount, setAmount] = useState('')
  const [destination, setDestination] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formMsg, setFormMsg] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)

  const [paypalEmail, setPaypalEmail] = useState('')
  const [localDetails, setLocalDetails] = useState('')
  const [preferredMethod, setPreferredMethod] = useState<PayoutMethodId>('paypal')
  const [savingMethod, setSavingMethod] = useState(false)
  const [methodMsg, setMethodMsg] = useState<string | null>(null)
  const [methodErr, setMethodErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProfileMissing([])
    try {
      const [payoutRes, methodsRes] = await Promise.all([
        fetch('/api/payouts/me', { credentials: 'include' }),
        fetch('/api/payouts/methods', { credentials: 'include' }),
      ])

      if (payoutRes.status === 401 || methodsRes.status === 401) {
        window.location.assign('/login?redirect=%2Fdashboard%2Fpayouts')
        return
      }

      const json = await payoutRes.json()
      const methodsJson = await methodsRes.json().catch(() => ({}))
      if (json.error === 'PROFILE_INCOMPLETE' || methodsJson.error === 'PROFILE_INCOMPLETE') {
        const missing = Array.isArray(json.missing) ? json.missing : Array.isArray(methodsJson.missing) ? methodsJson.missing : []
        setProfileMissing(missing.map(String))
        setData(null)
        return
      }
      if (!payoutRes.ok || json.error) {
        setError(json.error || 'Failed to load payouts')
        setData(null)
      } else {
        setData(json)
        const firstEnabled = (json.methods as Method[] | undefined)?.find((m) => m.enabled)
        if (firstEnabled) setMethod(firstEnabled.id)
      }

      if (methodsRes.ok) {
        const saved = methodsJson.methods as SavedMethods | undefined
        if (saved) {
          if (saved.paypalEmail) setPaypalEmail(saved.paypalEmail)
          if (saved.localDetails) setLocalDetails(saved.localDetails)
          if (saved.preferredMethod) {
            setPreferredMethod(saved.preferredMethod)
            setMethod(saved.preferredMethod)
          }
          if (saved.preferredMethod === 'local' && saved.localDetails) {
            setDestination(saved.localDetails)
          } else if (saved.paypalEmail) {
            setDestination(saved.paypalEmail)
          }
        }
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

  async function savePaymentMethods() {
    setSavingMethod(true)
    setMethodErr(null)
    setMethodMsg(null)
    try {
      if (preferredMethod === 'paypal' && paypalEmail.trim()) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail.trim())) {
          setMethodErr('Enter a valid PayPal email.')
          setSavingMethod(false)
          return
        }
      }
      if (preferredMethod === 'local' && !localDetails.trim()) {
        setMethodErr('Add your local payment details (bank / mobile wallet / account name).')
        setSavingMethod(false)
        return
      }

      const res = await fetch('/api/payouts/methods', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredMethod,
          paypalEmail: paypalEmail.trim(),
          localDetails: localDetails.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMethodErr(json.message || json.error || 'Could not save')
        return
      }
      setMethodMsg(json.message || 'Saved.')
      setMethod(preferredMethod)
      if (preferredMethod === 'paypal') setDestination(paypalEmail.trim())
      else setDestination(localDetails.trim())
    } catch {
      setMethodErr('Could not save. Try again.')
    } finally {
      setSavingMethod(false)
    }
  }

  function validateClient(): string | null {
    if (!data?.policy.withdrawalsEnabled) return 'Withdrawals are not available yet.'
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
    if (method === 'paypal') {
      const email = (destination || paypalEmail).trim()
      if (!email) return 'Save or enter a PayPal email first.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid PayPal email.'
    }
    if (method === 'local') {
      const note = (destination || localDetails).trim()
      if (!note) return 'Save or enter local payment details first.'
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
      const dest =
        method === 'paypal'
          ? (destination || paypalEmail).trim()
          : (destination || localDetails).trim()
      const res = await fetch('/api/payouts/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          method,
          destination: dest || undefined,
          idempotencyKey:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36)
              : `payout_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFormErr(json.message || json.error || 'Request failed')
        setConfirmOpen(false)
        return
      }
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
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-[#f0f4f2]">Payouts</h1>
          <p className="mt-1 text-sm text-[#81948e]">
            Register PayPal or Local Payments anytime — even with $0 balance. Withdrawals open only when a payout method is enabled by DropVerse.
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
      ) : profileMissing.length ? (
        <div className="rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] p-6">
          <h2 className="font-display text-xl font-bold text-[#f0f4f2]">Complete your profile to open payouts</h2>
          <p className="mt-2 text-sm leading-6 text-[#c1cbc7]">Add the missing account details so payout requests and payment methods can be tied to the correct person.</p>
          <ul className="mt-4 list-inside list-disc text-sm text-[#e4c979]">{profileMissing.map((field) => <li key={field}>{field}</li>)}</ul>
          <Link href="/onboarding?redirect=%2Fdashboard%2Fpayouts" className="mt-5 inline-flex rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f]">Complete profile</Link>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[rgba(232,154,141,0.35)] bg-[rgba(232,154,141,0.08)] p-6 text-sm text-[#e89a8d]">
          {error}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Pending" value={formatUsd(data.balances.pending)} hint="Awaiting approval" />
            <Stat
              label="Available"
              value={formatUsd(data.balances.available)}
              hint={data.policy.withdrawalsEnabled ? 'Ready when withdrawals open' : 'Balance held — withdrawals not open yet'}
              accent
            />
            <Stat label="Processing" value={formatUsd(data.balances.processing)} hint="Open requests" />
            <Stat label="Total paid" value={formatUsd(data.balances.totalPaid)} hint="Completed payouts" />
          </div>

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
                <p>
                  <span className="font-semibold text-[#e4c979]">Request cutoffs:</span>{' '}
                  {data.policy.requestCutoffDays.join(' & ')} of each month. Submit by the 3rd for the 5th cycle and by the 18th for the 20th cycle.
                </p>
                <p className="text-xs text-[#81948e]">{data.policy.scheduleNote}</p>
                {!data.policy.transfersActivated && (
                  <p className="text-xs text-[#9db8ff]">{data.policy.transfersNote}</p>
                )}
              </div>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-[#e8edea]">Payment methods</h2>
            <p className="mt-1 text-xs text-[#81948e]">
              Save PayPal or Local Payments details now. You do not need an available balance to register.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {data.methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPreferredMethod(m.id)
                    setMethod(m.id)
                    if (m.id === 'paypal') setDestination(paypalEmail)
                    else setDestination(localDetails)
                  }}
                  className={`rounded-xl border p-4 text-left transition ${
                    preferredMethod === m.id
                      ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.1)]'
                      : 'border-white/10 bg-[rgba(255,255,255,0.02)] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 font-semibold text-[#f0f4f2]">
                      {m.id === 'paypal' ? <Mail size={15} className="text-[#d8b45a]" /> : <Landmark size={15} className="text-[#d8b45a]" />}
                      {m.label}
                    </span>
                    {!m.enabled && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#81948e]">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#81948e]">{m.description}</p>
                  <p className="mt-2 text-xs text-[#9aa8a3]">Min withdraw {formatUsd(m.minUsd)}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-[#0a2926] p-5">
              {preferredMethod === 'paypal' ? (
                <>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#7f918c]">
                    PayPal email
                  </label>
                  <input
                    type="email"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071210] px-4 py-3 text-sm text-[#f0f4f2] outline-none focus:border-[rgba(216,180,90,0.45)]"
                  />
                  <p className="mt-1.5 text-[11px] text-[#81948e]">
                    Used for future withdrawals. You can save this with zero balance.
                  </p>
                </>
              ) : (
                <>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#7f918c]">
                    Local payment details
                  </label>
                  <textarea
                    value={localDetails}
                    onChange={(e) => setLocalDetails(e.target.value)}
                    rows={3}
                    placeholder="Bank name / wallet (Vodafone Cash, InstaPay…) / account holder / phone / IBAN or account number"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071210] px-4 py-3 text-sm text-[#f0f4f2] outline-none focus:border-[rgba(216,180,90,0.45)]"
                  />
                  <p className="mt-1.5 text-[11px] text-[#81948e]">
                    Ops will use these details on scheduled payout dates. Editable anytime.
                  </p>
                </>
              )}

              {methodErr && <p className="mt-3 text-sm text-[#e89a8d]">{methodErr}</p>}
              {methodMsg && <p className="mt-3 text-sm text-[#8fd6a8]">{methodMsg}</p>}

              <button
                type="button"
                disabled={savingMethod}
                onClick={savePaymentMethods}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:opacity-60"
              >
                {savingMethod ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Save {preferredMethod === 'paypal' ? 'PayPal' : 'Local'} details
              </button>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-[#e8edea]">Earnings breakdown</h2>
            <p className="mt-1 text-xs text-[#81948e]">{data.breakdown.sourcesNote}</p>
            <div className="mt-3 grid gap-3">
              <div className="rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#f0f4f2]">{data.breakdown.affiliate.label}</span>
                  <span className="text-sm text-[#c8d4d0]">
                    {formatUsd(data.breakdown.affiliate.available)} withdrawable ·{' '}
                    {formatUsd(data.breakdown.affiliate.pending)} pending ·{' '}
                    {formatUsd(data.breakdown.affiliate.paid)} commission ledger paid
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#81948e]">
                  {formatUsd(data.breakdown.affiliate.paidThroughWithdrawals ?? 0)} paid through withdrawal requests. Open and paid withdrawals are deducted from the withdrawable balance.
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-[rgba(255,255,255,0.02)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#f0f4f2]">{data.breakdown.projectEarnings.label}</span>
                  <span className="text-sm text-[#c8d4d0]">
                    {formatUsd(data.breakdown.projectEarnings.releasable)} releasable ·{' '}
                    {formatUsd(data.breakdown.projectEarnings.pending)} held ·{' '}
                    {formatUsd(data.breakdown.projectEarnings.released)} released
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#81948e]">
                  Project earnings are paid separately by an admin after project approval; they are not included in affiliate withdrawal requests.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-[#e8edea]">Request withdrawal</h2>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#0a2926] p-5">
              {!data.policy.withdrawalsEnabled ? (
                <div className="flex items-start gap-2 text-sm text-[#c1cbc7]">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                  <div>
                    <p className="font-semibold text-[#f0f4f2]">Withdrawals are not available yet.</p>
                    <p className="mt-1 text-xs text-[#81948e]">
                      PayPal and Local payouts are not open for requests. You can still register payment details
                      above and review balances and history. The server rejects withdrawal requests while methods
                      remain disabled.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {data.balances.available <= 0 && (
                    <div className="mb-4 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-[#c1cbc7]">
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                      <div>
                        <p className="font-semibold text-[#f0f4f2]">No available balance yet.</p>
                        <p className="mt-1 text-xs text-[#81948e]">
                          You can enter an amount below, but a request can only be submitted when your available balance covers it.
                          Minimum: PayPal {formatUsd(50)} · Local {formatUsd(25)}.
                        </p>
                      </div>
                    </div>
                  )}
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
                    Destination ({method === 'paypal' ? 'PayPal email' : 'Local details'})
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={method === 'paypal' ? 'you@example.com' : 'Bank / wallet / phone'}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071210] px-4 py-3 text-sm text-[#f0f4f2] outline-none focus:border-[rgba(216,180,90,0.45)]"
                  />
                  <div className="mt-4 space-y-1 rounded-lg border border-white/5 bg-[#071210] px-4 py-3 text-sm">
                    <Row label="Method" value={selectedMethod?.label || method} />
                    <Row label="Requested" value={formatUsd(feePreview.gross)} />
                    <Row label="DropVerse fee" value={`− ${formatUsd(feePreview.dropverseFee)}`} />
                    <Row label="Estimated net" value={formatUsd(feePreview.estimatedNet)} strong />
                  </div>
                  {formErr && <p className="mt-3 text-sm text-[#e89a8d]">{formErr}</p>}
                  {formMsg && <p className="mt-3 text-sm text-[#8fd6a8]">{formMsg}</p>}
                  <button
                    type="button"
                    disabled={!selectedMethod?.enabled || submitting}
                    onClick={() => {
                      const v = validateClient()
                      if (v) {
                        setFormErr(v)
                        return
                      }
                      setFormErr(null)
                      setConfirmOpen(true)
                    }}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Review & request
                  </button>
                </>
              )}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-[#e8edea]">Payout history</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/5">
              {data.history.length === 0 ? (
                <p className="p-6 text-sm text-[#81948e]">No payout requests yet.</p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/5 bg-white/[0.02] text-xs uppercase tracking-wider text-[#7f918c]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Method</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((h) => (
                      <tr key={h.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3 text-[#c8d4d0]">
                          {h.requestedAt ? new Date(h.requestedAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#f0f4f2]">{formatUsd(h.amount)}</td>
                        <td className="px-4 py-3 text-[#c8d4d0]">
                          <div>{h.method || '—'}</div>
                          {h.transferReference ? <div className="mt-1 max-w-[14rem] break-all text-[10px] text-[#9aacb8]">Ref: {h.transferReference}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(h.status)}`}>
                            {statusLabel(h.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      ) : null}

      {confirmOpen && data && data.policy.withdrawalsEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a2926] p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-[#f0f4f2]">Confirm withdrawal request</h3>
            <p className="mt-1 text-xs text-[#81948e]">No automatic transfer is sent. Ops processes on scheduled dates.</p>
            <div className="mt-4 space-y-1 rounded-lg border border-white/5 bg-[#071210] px-4 py-3 text-sm">
              <Row label="Method" value={selectedMethod?.label || method} />
              <Row label="Amount" value={formatUsd(feePreview.gross)} />
              <Row label="DropVerse fee" value={`− ${formatUsd(feePreview.dropverseFee)}`} />
              <Row label="Estimated net" value={formatUsd(feePreview.estimatedNet)} strong />
              {(destination || paypalEmail || localDetails) && (
                <Row
                  label="Destination"
                  value={
                    method === 'paypal'
                      ? (destination || paypalEmail).trim()
                      : (destination || localDetails).trim()
                  }
                />
              )}
              <Row label="Next processing" value={data.policy.nextScheduledProcessingDate || '—'} />
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
        {label === 'Available' ? (
          <Wallet size={13} className="text-[#d8b45a]" />
        ) : (
          <Clock size={13} className="text-[#d8b45a]" />
        )}
        {label}
      </div>
      <div className={`mt-2 text-xl font-bold ${accent ? 'text-[#e4c979]' : 'text-[#f0f4f2]'}`}>{value}</div>
      <div className="mt-1 text-[11px] text-[#81948e]">{hint}</div>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#81948e]">{label}</span>
      <span className={strong ? 'font-semibold text-[#e4c979]' : 'text-[#f0f4f2]'}>{value}</span>
    </div>
  )
}
