'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Rocket, Check, ShieldCheck, CreditCard,
  HandCoins, AlertTriangle, Wallet, FileText,
} from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { useAuth } from '../../../lib/useAuth'
import {
  PROJECT_TYPES, PAYMENT_METHODS, moneyLabels,
  formatUsd, computeSellerProfit, FULFILLMENT_RATES,
  type ProjectType, type PaymentMethod,
} from '../../../lib/projectConfig'
import { createProjectServer } from '../../../lib/createProject'
import SpaceRemitPayForm from '../../../components/SpaceRemitPayForm'
import { getPaddleClient, paddleClientTokenConfigured } from '../../../lib/paddle'

type Step = 'basics' | 'billing' | 'summary'

export default function CreateProjectPage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)

  const [step, setStep] = useState<Step>('basics')
  const [projectType, setProjectType] = useState<ProjectType>('ONE_TIME')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientPrice, setClientPrice] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CLIENT_PAYS_DROPVERSE')
  const [clientContactEmail, setClientContactEmail] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [fullName, setFullName] = useState('')
  const [payEmail, setPayEmail] = useState('')
  useEffect(() => {
    if (auth.user) {
      setFullName(auth.user.name ?? '')
      setPayEmail(auth.user.email ?? '')
    }
  }, [auth.user])

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [invoiceCopied, setInvoiceCopied] = useState(false)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [payConfirmed, setPayConfirmed] = useState(false)
  const [paddleLoading, setPaddleLoading] = useState(false)
  const [invoicePayRail, setInvoicePayRail] = useState<'international' | 'local'>('international')

  useEffect(() => {
    if (!auth.loading && !auth.user) window.location.assign('/login')
  }, [auth.loading, auth.user])

  useEffect(() => {
    document.getElementById('cp-form-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const labels = useMemo(() => moneyLabels(projectType), [projectType])
  const cp = Number(clientPrice) || 0
  const fc = useMemo(() => Math.round(cp * (FULFILLMENT_RATES[projectType] ?? 0) * 100) / 100, [cp, projectType])
  const profit = useMemo(() => computeSellerProfit(cp, fc), [cp, fc])
  const typeBlocked = projectType === 'CUSTOM_RECURRING'
  const basicsValid = title.trim().length >= 3 && description.trim().length >= 5
  const billingValid = cp > 0

  async function startPaddleProjectCheckout(projectId: string) {
    if (!projectId || paddleLoading) return
    setPaddleLoading(true)
    setPayError(null)
    try {
      const response = await fetch('/api/paddle/project-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to start international checkout.')
      const paddle = await getPaddleClient()
      if (paddle && payload.transactionId) {
        paddle.Checkout.open({
          transactionId: payload.transactionId,
          settings: { displayMode: 'overlay', variant: 'one-page', theme: 'dark' },
        })
        setPaddleLoading(false)
      } else if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl)
      } else if (!paddleClientTokenConfigured()) {
        throw new Error('International payment is not configured yet.')
      } else {
        throw new Error('International checkout is not ready yet.')
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Unable to start international checkout.')
      setPaddleLoading(false)
    }
  }

  async function handleSubmit() {
    if (submitting || created || pendingProjectId) return
    setSubmitting(true)
    setError(null)
    let res: { error?: string; detail?: string; projectId?: string; success?: boolean }
    try {
      res = await createProjectServer({
        title, description, projectType, clientPrice: cp, fulfillmentCost: fc,
        paymentMethod, deliveryNotes, clientContactEmail,
      })
    } catch (err) {
      console.error('createProjectServer threw:', err)
      res = { error: 'DB_ERROR', detail: 'unexpected_error' }
    }
    setSubmitting(false)
    if (res.error) {
      const messages: Record<string, string> = {
        NOT_AUTHENTICATED: 'You are no longer signed in. Please sign in again.',
        INVALID_PRICE: 'Enter a valid client price greater than zero.',
        DB_ERROR: 'Something went wrong saving the project. Please try again.',
      }
      const detail = res.detail ? ` (${res.detail})` : ''
      setError((messages[res.error] ?? 'Something went wrong. Please try again.') + (res.error === 'DB_ERROR' ? detail : ''))
      return
    }
    const createdProjectId = res.projectId ? String(res.projectId) : null
    if (paymentMethod === 'SPACEREMIT' || paymentMethod === 'PADDLE') {
      if (createdProjectId) { setPendingProjectId(createdProjectId); return }
      const supabase = createClient()
      const methodFilter = paymentMethod === 'PADDLE' ? 'CLIENT_PAYS_DROPVERSE' : paymentMethod
      const { data: rows } = await supabase.from('projects').select('id').eq('user_id', auth.user?.id).eq('payment_method', methodFilter).order('created_at', { ascending: false }).limit(1)
      if (rows?.[0]?.id) setPendingProjectId(rows[0].id)
      return
    }
    if (paymentMethod === 'INVOICE_SEND') {
      let projectId = createdProjectId
      if (!projectId) {
        const supabase = createClient()
        const { data: rows } = await supabase.from('projects').select('id').eq('user_id', auth.user?.id).eq('payment_method', 'INVOICE_SEND').order('created_at', { ascending: false }).limit(1)
        projectId = rows?.[0]?.id || null
      }
      if (!projectId) {
        setInvoiceError('Could not locate the created project. Please open the dashboard.')
        setCreated(true)
        return
      }
      const invRes = await fetch('/api/invoices/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, clientName: '', clientEmail: clientContactEmail?.trim() || undefined }),
      })
      const invJson = (await invRes.json().catch(() => ({}))) as { invoiceId?: string; error?: string }
      if (!invRes.ok || !invJson.invoiceId) {
        setInvoiceError('Could not create the invoice. You can create it from the dashboard instead.')
        setCreated(true)
        return
      }
      setInvoiceId(invJson.invoiceId)
      setInvoiceUrl(`${window.location.origin}/invoice/${invJson.invoiceId}?method=${invoicePayRail}`)
      setCreated(true)
      return
    }
    setCreated(true)
  }

  async function handleSpaceRemitVerify(paymentId: string) {
    if (!pendingProjectId) return
    setPaying(true)
    setPayError(null)
    const res = await fetch('/api/spaceremit/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, projectId: pendingProjectId }),
    })
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    setPaying(false)
    if (!res.ok) {
      setPayError('Payment verification failed. Your project is saved as Payment Pending.')
      return
    }
    setPayConfirmed(true)
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
          <Link href="/" className="inline-flex items-center gap-3" aria-label="DropVerse home">
            <Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover" priority />
            <span className="font-display text-xl font-extrabold tracking-[.16em]">DROP<span className="text-[#d8b45a]">VERSE</span></span>
          </Link>
          <Link href="/dashboard" className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-bold text-[#e4c979]">Dashboard</Link>
        </div>
      </header>

      <div className="container pb-24 pt-28">
        <div className="mx-auto mb-12 flex max-w-2xl items-center justify-center gap-2 text-sm">
          {(['basics', 'billing', 'summary'] as Step[]).map((s, i) => (
            <button key={s} onClick={() => setStep(s)} className={`flex items-center gap-2 rounded-full px-4 py-2 transition ${step === s ? 'bg-[#d8b45a] text-[#10221f] font-bold' : 'border border-white/10 text-[#8f9f9a]'}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${step === s ? 'bg-[#10221f] text-[#d8b45a]' : 'bg-white/10'}`}>{i + 1}</span>
              {s === 'basics' ? 'Project Details' : s === 'billing' ? 'Billing' : 'Review & Submit'}
            </button>
          ))}
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <div id="cp-form-top" className="mb-8 flex items-center gap-4 scroll-mt-24">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]"><Rocket size={22} /></div>
              <div>
                <h1 className="font-display text-3xl font-extrabold tracking-tight">Create Project</h1>
                <p className="mt-1 text-sm text-[#8f9f9a]">Set up a new client project and its billing arrangement.</p>
              </div>
            </div>

            <motion.section className={`rounded-3xl border border-white/5 bg-[#0a2926] p-8 ${step !== 'basics' ? 'hidden' : ''}`}>
              <h2 className="font-display text-xl font-bold">1. Project Details</h2>
              <label className="mt-6 block text-sm font-semibold text-[#c1cbc7]">Project Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Video Editing Project for Acme Co." className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
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

            <motion.section className={`mt-8 rounded-3xl border border-white/5 bg-[#0a2926] p-8 ${step !== 'billing' ? 'hidden' : ''}`}>
              <h2 className="font-display text-xl font-bold">2. Billing & Payment</h2>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[.12em] text-[#6e817c]">Project Type</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {PROJECT_TYPES.map(t => {
                  const selected = projectType === t.id
                  return (
                    <button key={t.id} type="button" onClick={() => !t.comingSoon && setProjectType(t.id)} disabled={t.comingSoon} className={`relative rounded-2xl border p-5 text-left ${selected ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]' : 'border-white/10 bg-[#071f1d]'} ${t.comingSoon ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <span className={`font-display text-base font-bold ${selected ? 'text-[#f0d98b]' : 'text-[#d9e0dc]'}`}>{t.label}</span>
                        {t.comingSoon ? <span className="text-[10px] font-bold text-[#f0d98b]">Coming Soon</span> : <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-[#d8b45a] bg-[#d8b45a]' : 'border-[#5f726c]'}`}>{selected && <Check size={12} className="text-[#10221f]" />}</span>}
                      </div>
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
                  <div className="mt-2 flex justify-between border-t border-white/10 pt-2"><span className="text-[#8f9f9a]">{labels.profitLabel}</span><span className="font-bold text-[#f0d98b]">{formatUsd(profit)}</span></div>
                </div>
              </div>

              <p className="mt-8 text-sm font-semibold uppercase tracking-[.12em] text-[#6e817c]">Payment Method</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {PAYMENT_METHODS.map(m => {
                  const selected = paymentMethod === m.id
                  return (
                    <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)} className={`relative rounded-2xl border p-5 text-left ${selected ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]' : 'border-white/10 bg-[#071f1d]'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`flex items-center gap-2.5 font-bold ${selected ? 'text-[#f0d98b]' : 'text-[#d9e0dc]'}`}>
                          {m.id === 'CLIENT_PAYS_DROPVERSE' || m.id === 'PADDLE' ? <CreditCard size={18} className="text-[#d8b45a]" /> : m.id === 'SPACEREMIT' ? <Wallet size={18} className="text-[#d8b45a]" /> : m.id === 'INVOICE_SEND' ? <FileText size={18} className="text-[#d8b45a]" /> : <HandCoins size={18} className="text-[#d8b45a]" />}
                          {m.label}
                        </span>
                        {m.recommended ? <span className="text-[10px] font-bold text-[#f0d98b]">Recommended</span> : <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? 'border-[#d8b45a] bg-[#d8b45a]' : 'border-[#5f726c]'}`}>{selected && <Check size={12} className="text-[#10221f]" />}</span>}
                      </div>
                      <p className="mt-2 text-xs text-[#8f9f9a]">{m.description}</p>
                    </button>
                  )
                })}
              </div>

              {paymentMethod === 'INVOICE_SEND' && (
                <div className="mt-6 rounded-2xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.06)] p-5">
                  <p className="text-sm font-bold text-[#f0d98b]">Client payment method on the invoice</p>
                  <p className="mt-1 text-xs leading-5 text-[#9aaba6]">Choose what your client will see on the payment page. You will send them a link.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => setInvoicePayRail('international')} className={`rounded-xl border p-4 text-left ${invoicePayRail === 'international' ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.12)]' : 'border-white/10 bg-[#071f1d]'}`}>
                      <div className={`text-sm font-bold ${invoicePayRail === 'international' ? 'text-[#f0d98b]' : 'text-[#d9e0dc]'}`}>International payment</div>
                      <p className="mt-1 text-[11px] text-[#8f9f9a]">Cards & global methods. No amount cap.</p>
                    </button>
                    <button type="button" onClick={() => setInvoicePayRail('local')} className={`rounded-xl border p-4 text-left ${invoicePayRail === 'local' ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.12)]' : 'border-white/10 bg-[#071f1d]'}`}>
                      <div className={`text-sm font-bold ${invoicePayRail === 'local' ? 'text-[#f0d98b]' : 'text-[#d9e0dc]'}`}>Local payment</div>
                      <p className="mt-1 text-[11px] text-[#8f9f9a]">Wallets & bank transfer. Max $300 per payment.</p>
                    </button>
                  </div>
                  {invoicePayRail === 'local' && (
                    <p className="mt-3 text-xs leading-5 text-[#e4c979]">Local payment is limited to <span className="font-bold">$300 per transaction</span>. For larger invoices use International.</p>
                  )}
                </div>
              )}

              <div className="mt-8 flex justify-between gap-3">
                <button onClick={() => setStep('basics')} className="rounded-full border border-white/10 px-6 py-3 text-sm font-bold text-[#c1cbc7]">Back</button>
                <button disabled={!billingValid || typeBlocked} onClick={() => setStep('summary')} className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] disabled:opacity-40">Next: Review <ArrowRight size={16} /></button>
              </div>
            </motion.section>

            <motion.section className={`mt-8 rounded-3xl border border-white/5 bg-[#0a2926] p-8 ${step !== 'summary' ? 'hidden' : ''}`}>
              <h2 className="font-display text-xl font-bold">3. Review & Submit</h2>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between"><dt className="text-[#8f9f9a]">Title</dt><dd className="font-semibold text-[#d9e0dc]">{title.trim() || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-[#8f9f9a]">Client price</dt><dd className="font-semibold text-[#d9e0dc]">{formatUsd(cp)}</dd></div>
                <div className="flex justify-between"><dt className="text-[#8f9f9a]">Payment method</dt><dd className="font-semibold text-[#d9e0dc]">{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}</dd></div>
                {paymentMethod === 'INVOICE_SEND' && (
                  <div className="flex justify-between"><dt className="text-[#8f9f9a]">Client pays via</dt><dd className="font-semibold text-[#d9e0dc]">{invoicePayRail === 'local' ? 'Local (max $300)' : 'International'}</dd></div>
                )}
              </dl>
              {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}</div>}
              <div className="mt-8 flex justify-between gap-3">
                <button onClick={() => setStep('billing')} className="rounded-full border border-white/10 px-6 py-3 text-sm font-bold text-[#c1cbc7]">Back</button>
                <button disabled={submitting || created || typeBlocked} onClick={handleSubmit} className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] disabled:opacity-40">{submitting ? 'Saving…' : 'Submit Project'}</button>
              </div>
            </motion.section>
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl border border-white/5 bg-[#0a2926] p-6">
              <div className="flex items-center gap-2 text-[#d8b45a]"><ShieldCheck size={18} /><span className="text-xs font-bold uppercase tracking-[.14em]">Summary</span></div>
              <h3 className="font-display mt-2 text-xl font-extrabold">{title.trim() || 'Untitled Project'}</h3>
              <dl className="mt-6 space-y-3.5 text-sm">
                <div className="flex justify-between"><dt className="text-[#8f9f9a]">Client Price</dt><dd className="font-bold text-[#d9e0dc]">{formatUsd(cp)}</dd></div>
                <div className="flex justify-between"><dt className="text-[#8f9f9a]">DropVerse Fulfillment</dt><dd className="font-bold text-[#d9e0dc]">{formatUsd(fc)}</dd></div>
                <div className="flex justify-between border-t border-white/10 pt-3.5"><dt className="font-semibold text-[#c1cbc7]">Estimated Profit</dt><dd className="font-display text-lg font-extrabold text-[#f0d98b]">{formatUsd(profit)}</dd></div>
              </dl>

              {pendingProjectId && !payConfirmed && (() => {
                const checkoutAmount = paymentMethod === 'SELLER_COLLECTED' ? fc : cp
                return (
                  <div className="mt-6 rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] p-5">
                    <p className="font-display text-lg font-extrabold">Complete Payment — {formatUsd(checkoutAmount)}</p>
                    {payError && <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">{payError}</div>}
                    {paymentMethod === 'PADDLE' ? (
                      <button type="button" onClick={() => pendingProjectId && startPaddleProjectCheckout(pendingProjectId)} disabled={paddleLoading} className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-3 py-3.5 text-sm font-bold text-[#e4c979] disabled:opacity-50">
                        {paddleLoading ? 'Opening…' : `Pay ${formatUsd(checkoutAmount)} — International`}
                      </button>
                    ) : (
                      <SpaceRemitPayForm amount={checkoutAmount} fullName={fullName || (auth.user?.name ?? '')} email={payEmail} phone="+0000000000" publicKey={process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY ?? ''} onPaid={async (code) => { await handleSpaceRemitVerify(code) }} onMessage={(msg) => setPayError(msg)} />
                    )}
                  </div>
                )
              })()}

              {payConfirmed && (
                <div className="mt-6 rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] p-5 text-center">
                  <p className="font-display text-lg font-extrabold">Payment Confirmed</p>
                  <Link href="/dashboard" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 font-bold text-[#10221f]">Go to Dashboard</Link>
                </div>
              )}

              {created && !pendingProjectId && invoiceId && invoiceUrl && (
                <div className="mt-6 rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] p-5">
                  <p className="text-center font-display text-lg font-extrabold">Invoice Ready to Send</p>
                  <p className="mt-1.5 text-center text-xs text-[#9aaba6]">Share this link with your client. They pay on a separate page ({invoicePayRail === 'local' ? 'Local · max $300' : 'International'}).</p>
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3">
                    <p className="min-w-0 flex-1 truncate text-xs font-mono text-[#e7edea]">{invoiceUrl}</p>
                    <button onClick={() => { navigator.clipboard.writeText(invoiceUrl).then(() => { setInvoiceCopied(true); setTimeout(() => setInvoiceCopied(false), 2000) }).catch(() => {}) }} className="shrink-0 rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.12)] px-3.5 py-1.5 text-[11px] font-bold text-[#f0d98b]">{invoiceCopied ? 'Copied!' : 'Copy'}</button>
                  </div>
                  <Link href="/dashboard" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 font-bold text-[#10221f]">Go to Dashboard</Link>
                </div>
              )}

              {created && !pendingProjectId && !invoiceId && !payConfirmed && (
                <div className="mt-6 rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] p-5 text-center">
                  <p className="font-display text-lg font-extrabold">Project Created</p>
                  <Link href="/dashboard" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 font-bold text-[#10221f]">Go to Dashboard</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
