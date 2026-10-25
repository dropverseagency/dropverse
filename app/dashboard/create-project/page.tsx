'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Brand from '../../../components/Brand'
import {
  ArrowRight, Rocket, CreditCard,
  HandCoins, Wallet, FileText,
} from 'lucide-react'
import { useAuth } from '../../../lib/useAuth'
import {
  PROJECT_TYPES, PAYMENT_METHODS, moneyLabels,
  formatUsd, computeSellerProfit, FULFILLMENT_RATES,
  type ProjectType, type PaymentMethod,
} from '../../../lib/projectConfig'
import { createProjectServer } from '../../../lib/createProject'
import WhopCheckoutPanel from '../../../components/WhopCheckoutPanel'

type Step = 'basics' | 'billing' | 'summary'

export default function CreateProjectPage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const [step, setStep] = useState<Step>('basics')
  const [projectType, setProjectType] = useState<ProjectType>('ONE_TIME')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientPrice, setClientPrice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('SPACEREMIT')
  const [clientContactEmail, setClientContactEmail] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [whopSessionId, setWhopSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!auth.loading && !auth.user) window.location.assign('/login')
  }, [auth.loading, auth.user])

  const labels = useMemo(() => moneyLabels(projectType), [projectType])
  const cp = Number(clientPrice) || 0
  const fc = useMemo(() => Math.round(cp * (FULFILLMENT_RATES[projectType] ?? 0) * 100) / 100, [cp, projectType])
  const profit = useMemo(() => computeSellerProfit(cp, fc), [cp, fc])
  const typeBlocked = projectType === 'CUSTOM_RECURRING'
  const basicsValid = title.trim().length >= 3 && description.trim().length >= 5
  const billingValid = cp > 0

  async function handleSubmit() {
    if (submitting || created || pendingProjectId) return
    setSubmitting(true)
    setError(null)
    let res: { error?: string; detail?: string; projectId?: string }
    try {
      res = await createProjectServer({
        title, description, projectType, clientPrice: cp, fulfillmentCost: fc,
        paymentMethod, deliveryNotes, clientContactEmail,
      })
    } catch {
      res = { error: 'DB_ERROR', detail: 'unexpected_error' }
    }
    setSubmitting(false)
    if (res.error) {
      setError(res.error === 'NOT_AUTHENTICATED' ? 'Please sign in again.' : 'Something went wrong. Please try again.')
      return
    }
    const id = res.projectId ? String(res.projectId) : null
    if (paymentMethod === 'WHOP' && id) {
      setPendingProjectId(id)
      try {
        const checkoutRes = await fetch('/api/whop/project-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ projectId: id }),
        })
        const checkoutJson = await checkoutRes.json().catch(() => ({})) as { sessionId?: string; error?: string }
        if (!checkoutRes.ok || !checkoutJson.sessionId) {
          setPayError(checkoutJson.error || 'Whop checkout could not be created. Please retry or choose another payment method.')
          return
        }
        setWhopSessionId(checkoutJson.sessionId)
      } catch {
        setPayError('Whop checkout could not be created. Please retry or choose another payment method.')
      }
      return
    }
    if (paymentMethod === 'SPACEREMIT') {
      if (id) setPendingProjectId(id)
      return
    }
    if (paymentMethod === 'CLIENT_PAYS_DROPVERSE' && id) {
      setPendingProjectId(id)
      return
    }
    if (paymentMethod === 'INVOICE_SEND' && id) {
      try {
        const invRes = await fetch('/api/invoices/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ projectId: id, clientName: clientContactEmail?.trim() || '' }),
        })
        const invJson = (await invRes.json().catch(() => ({}))) as { invoiceId?: string }
        if (invRes.ok && invJson.invoiceId) {
          const url = window.location.origin + '/invoice/' + invJson.invoiceId
          setInvoiceId(invJson.invoiceId)
          setInvoiceUrl(url)
          setCreated(true)
          setStep('summary')
          window.open(url, '_blank', 'noopener,noreferrer')
          return
        }
      } catch { /* ignore */ }
    }
    setCreated(true)
  }

  if (!signedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#071f1d]">
        <Link href="/login" className="rounded-full bg-[#d8b45a] px-6 py-3 font-bold text-[#10221f]">Sign in</Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#071f1d]">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[rgba(7,31,29,0.80)] backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Brand />
          <Link href="/dashboard" className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-bold text-[#e4c979]">Dashboard</Link>
        </div>
      </header>
      <div className="container pb-24 pt-28">
        <div className="mx-auto mb-12 flex max-w-2xl items-center justify-center gap-2 text-sm">
          {(['basics', 'billing', 'summary'] as Step[]).map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={
                step === s
                  ? 'flex items-center gap-2 rounded-full px-4 py-2 transition bg-[#d8b45a] text-[#10221f] font-bold'
                  : 'flex items-center gap-2 rounded-full px-4 py-2 transition border border-white/10 text-[#8f9f9a]'
              }
            >
              <span
                className={
                  step === s
                    ? 'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold bg-[#10221f] text-[#d8b45a]'
                    : 'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold bg-white/10'
                }
              >
                {i + 1}
              </span>
              {s === 'basics' ? 'Project Details' : s === 'billing' ? 'Billing' : 'Review & Submit'}
            </button>
          ))}
        </div>
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]"><Rocket size={22} /></div>
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight">Create Project</h1>
              <p className="mt-1 text-sm text-[#8f9f9a]">Set up a new client project and its billing arrangement.</p>
            </div>
          </div>

          {created && invoiceUrl && (
            <div className="mb-8 rounded-3xl border border-[rgba(216,180,90,0.45)] bg-[rgba(216,180,90,0.10)] p-6">
              <p className="font-display text-xl font-extrabold text-[#f0d98b]">Invoice ready</p>
              <p className="mt-2 break-all font-mono text-xs text-[#e7edea]">{invoiceUrl}</p>
              <Link href="/dashboard" className="mt-4 inline-flex rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f]">Dashboard</Link>
            </div>
          )}

          <motion.section className={step !== 'basics' ? 'rounded-3xl border border-white/5 bg-[#0a2926] p-8 hidden' : 'rounded-3xl border border-white/5 bg-[#0a2926] p-8'}>
            <h2 className="font-display text-xl font-bold">1. Project Details</h2>
            <label className="mt-6 block text-sm font-semibold text-[#c1cbc7]">Project Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Video Editing Project" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
            <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the scope..." rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
            <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Client Contact Email (optional)</label>
            <input type="email" value={clientContactEmail} onChange={(e) => setClientContactEmail(e.target.value)} placeholder="client@company.com" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
            <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Delivery Notes (optional)</label>
            <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
            <div className="mt-8 flex justify-end">
              <button disabled={!basicsValid} onClick={() => setStep('billing')} className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] disabled:opacity-40">Next: Billing <ArrowRight size={16} /></button>
            </div>
          </motion.section>

          <motion.section className={step !== 'billing' ? 'mt-8 rounded-3xl border border-white/5 bg-[#0a2926] p-8 hidden' : 'mt-8 rounded-3xl border border-white/5 bg-[#0a2926] p-8'}>
            <h2 className="font-display text-xl font-bold">2. Billing & Payment</h2>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[.12em] text-[#6e817c]">Project Type</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {PROJECT_TYPES.map(t => {
                const selected = projectType === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => !t.comingSoon && setProjectType(t.id)}
                    disabled={t.comingSoon}
                    className={
                      (selected
                        ? 'relative rounded-2xl border p-5 text-left border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]'
                        : 'relative rounded-2xl border p-5 text-left border-white/10 bg-[#071f1d]') +
                      (t.comingSoon ? ' opacity-60' : '')
                    }
                  >
                    <span className={selected ? 'font-display text-base font-bold text-[#f0d98b]' : 'font-display text-base font-bold text-[#d9e0dc]'}>{t.label}</span>
                    <p className="mt-2 text-xs text-[#8f9f9a]">{t.description}</p>
                  </button>
                )
              })}
            </div>
            <div className="mt-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#c1cbc7]">{labels.priceLabel} *</label>
                <div className="relative mt-2">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm text-[#8f9f9a]">$</span>
                  <input type="number" min="0" step="1" value={clientPrice} onChange={(e) => setClientPrice(e.target.value)} placeholder="0" className="w-full rounded-2xl border border-white/10 bg-[#071f1d] py-3.5 pl-10 pr-5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#071f1d] p-4 text-sm">
                <div className="flex justify-between"><span className="text-[#8f9f9a]">{labels.costLabel}</span><span className="font-bold text-[#d9e0dc]">{formatUsd(fc)}</span></div>
                <div className="mt-2 flex justify-between"><span className="text-[#8f9f9a]">Your profit</span><span className="font-bold text-[#e4c979]">{formatUsd(profit)}</span></div>
              </div>
              <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#6e817c]">Payment method</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {PAYMENT_METHODS.map((m) => {
                  const selected = paymentMethod === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={
                        selected
                          ? 'rounded-2xl border p-4 text-left border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]'
                          : 'rounded-2xl border p-4 text-left border-white/10 bg-[#071f1d]'
                      }
                    >
                      <div className="flex items-center gap-2">
                        {m.id === 'WHOP' || m.id === 'CLIENT_PAYS_DROPVERSE' ? <CreditCard size={18} className="text-[#d8b45a]" /> : m.id === 'SPACEREMIT' ? <Wallet size={18} className="text-[#d8b45a]" /> : m.id === 'INVOICE_SEND' ? <FileText size={18} className="text-[#d8b45a]" /> : <HandCoins size={18} className="text-[#d8b45a]" />}
                        <span className="font-semibold text-[#d9e0dc]">{m.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#8f9f9a]">{m.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep('basics')} className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-[#c1cbc7]">Back</button>
              <button disabled={!billingValid || typeBlocked} onClick={() => setStep('summary')} className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] disabled:opacity-40">Next: Review <ArrowRight size={16} /></button>
            </div>
          </motion.section>

          <motion.section className={step !== 'summary' ? 'mt-8 rounded-3xl border border-white/5 bg-[#0a2926] p-8 hidden' : 'mt-8 rounded-3xl border border-white/5 bg-[#0a2926] p-8'}>
            <h2 className="font-display text-xl font-bold">3. Review & Submit</h2>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between border-b border-white/5 pb-3"><span className="text-[#8f9f9a]">Title</span><span className="font-semibold text-[#d9e0dc]">{title || '—'}</span></div>
              <div className="flex justify-between border-b border-white/5 pb-3"><span className="text-[#8f9f9a]">Type</span><span className="font-semibold text-[#d9e0dc]">{projectType}</span></div>
              <div className="flex justify-between border-b border-white/5 pb-3"><span className="text-[#8f9f9a]">Client price</span><span className="font-semibold text-[#d9e0dc]">{formatUsd(cp)}</span></div>
              <div className="flex justify-between"><span className="text-[#8f9f9a]">Your profit</span><span className="font-semibold text-[#e4c979]">{formatUsd(profit)}</span></div>
            </div>
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            {pendingProjectId && paymentMethod === 'WHOP' && (
              <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#071f1d] p-5 text-sm text-[#c1cbc7]">
                <p className="font-semibold text-[#e4c979]">Secure Whop checkout</p>
                {whopSessionId ? (
                  <WhopCheckoutPanel sessionId={whopSessionId} returnUrl={typeof window !== 'undefined' ? window.location.origin + '/dashboard?payment=whop' : '/dashboard?payment=whop'} />
                ) : (
                  <p>{payError || 'Preparing secure checkout…'}</p>
                )}
                {payError && <p className="text-sm text-red-300">{payError}</p>}
                {!whopSessionId && (
                  <button
                    type="button"
                    onClick={async () => {
                      setPayError(null)
                      try {
                        const retryRes = await fetch('/api/whop/project-checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ projectId: pendingProjectId }),
                        })
                        const retryJson = await retryRes.json().catch(() => ({})) as { sessionId?: string; error?: string }
                        if (!retryRes.ok || !retryJson.sessionId) {
                          setPayError(retryJson.error || 'Could not retry Whop checkout.')
                        } else {
                          setWhopSessionId(retryJson.sessionId)
                        }
                      } catch {
                        setPayError('Could not retry Whop checkout.')
                      }
                    }}
                    className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-[#e4c979]"
                  >
                    Retry Whop checkout
                  </button>
                )}
              </div>
            )}
            {pendingProjectId && paymentMethod === 'SPACEREMIT' && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#071f1d] p-5 text-sm text-[#c1cbc7]">
                <p className="font-semibold text-[#e4c979]">Local payment</p>
                <p className="mt-2">Project saved as Payment Pending. Complete payment from the dashboard when ready.</p>
                <Link href="/dashboard" className="mt-4 inline-flex rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f]">Go to Dashboard</Link>
              </div>
            )}
            {pendingProjectId && paymentMethod === 'CLIENT_PAYS_DROPVERSE' && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#071f1d] p-4 text-sm text-[#8fa29c]">
                Card checkout is unavailable. Choose <span className="font-semibold text-[#d8b45a]">Local payment (SpaceRemit)</span> or send an invoice to continue.
                {payError && <p className="mt-2 text-sm text-red-300">{payError}</p>}
              </div>
            )}
            {created && !invoiceId && (
              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">Project created. <Link href="/dashboard" className="font-bold underline">Dashboard</Link></div>
            )}
            <div className="mt-8 flex justify-between">
              <button onClick={() => setStep('billing')} className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-[#c1cbc7]">Back</button>
              {!created && !pendingProjectId && (
                <button onClick={handleSubmit} disabled={submitting || typeBlocked} className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] disabled:opacity-40">{submitting ? 'Saving…' : 'Create project'} <ArrowRight size={16} /></button>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  )
}
