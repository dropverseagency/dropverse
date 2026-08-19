'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight, Rocket, Check, Info, ShieldCheck, CreditCard,
  HandCoins, AlertTriangle, Wallet, FileText, Copy, ExternalLink,
} from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { useAuth } from '../../../lib/useAuth'
import {
  PROJECT_TYPES, PAYMENT_METHODS, moneyLabels, paymentRequiredNow,
  firstBillingPeriodLabel, formatUsd, computeSellerProfit, FULFILLMENT_RATES,
  type ProjectDraft, type ProjectType, type PaymentMethod,
} from '../../../lib/projectConfig'
import { createProjectServer } from '../../../lib/createProject'
import SpaceRemitPayForm from '../../../components/SpaceRemitPayForm'

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
  // Buyer info for the SpaceRemit checkout — pre-filled from the session and
  // shown as disabled read-only fields (only the receipt email matters to the buyer).
  const [fullName, setFullName] = useState('')
  const [payEmail, setPayEmail] = useState('')
  useEffect(() => {
    if (auth.user) {
      setFullName(auth.user.name ?? '')
      setPayEmail(auth.user.email ?? '')
    }
  }, [auth.user])
  const [transactionCode, setTransactionCode] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(false)

  // Spaceremit checkout step (created project pending payment)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)

  // Invoice send step (created project with INVOICE_SEND method)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [invoiceCopied, setInvoiceCopied] = useState(false)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [payConfirmed, setPayConfirmed] = useState(false)

  // Redirect unauthenticated visitors to login.
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      window.location.assign('/login')
    }
  }, [auth.loading, auth.user])

  // On mobile the form is one long column — scroll to the top of the
  // current step whenever the user advances so the next section is in view.
  useEffect(() => {
    const form = document.getElementById('cp-form-top')
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const labels = useMemo(() => moneyLabels(projectType), [projectType])
  const cp = Number(clientPrice) || 0
  // The DropVerse fulfillment cost is computed automatically from platform pricing —
  // the seller only enters the client price.
  const fc = useMemo(() => Math.round(cp * (FULFILLMENT_RATES[projectType] ?? 0) * 100) / 100, [cp, projectType])
  const profit = useMemo(() => computeSellerProfit(cp, fc), [cp, fc])
  const dueNow = useMemo(() => paymentRequiredNow({ projectType, clientPrice: cp, fulfillmentCost: fc, paymentMethod, title: title, description: '', deliveryNotes: '', clientContactEmail: '' }), [projectType, cp, fc, paymentMethod])
  const isRecurring = projectType === 'MONTHLY' || projectType === 'ANNUAL' || projectType === 'CUSTOM_RECURRING'

  const typeBlocked = projectType === 'CUSTOM_RECURRING'

  const basicsValid = title.trim().length >= 3 && description.trim().length >= 5
  const billingValid = cp > 0

  async function handleSubmit() {
    if (submitting || created || pendingProjectId) return
    setSubmitting(true)
    setError(null)
    let res: Awaited<ReturnType<typeof createProjectServer>>
    try {
      res = await createProjectServer({
      title,
      description,
      projectType,
      clientPrice: cp,
      fulfillmentCost: fc,
      paymentMethod,
      deliveryNotes,
      clientContactEmail,
      })
    } catch (err) {
      console.error('createProjectServer threw:', err)
      res = { error: 'DB_ERROR' }
    }
    setSubmitting(false)
    if (res.error) {
      const messages: Record<string, string> = {
        NOT_AUTHENTICATED: 'You are no longer signed in. Please sign in again.',
        INVOICE_FAILED: 'Could not create the invoice. The project was saved — you can create the invoice from the dashboard.',
        INVALID_PRICE: 'Enter a valid client price greater than zero.',
        INVALID_COST: 'The DropVerse fulfillment cost must be greater than zero and less than the client price.',
        DB_ERROR: 'Something went wrong saving the project. Please try again.',
      }
      setError(messages[res.error] ?? 'Something went wrong. Please try again.')
      return
    }
    if (paymentMethod === 'SPACEREMIT') {
      // Spaceremit creates the project in PAYMENT_PENDING, then we take the
      // buyer to the checkout step before marking anything confirmed.
      const supabase = createClient()
      const { data: rows } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', auth.user?.id)
        .eq('payment_method', 'SPACEREMIT')
        .order('created_at', { ascending: false })
        .limit(1)
      if (rows?.[0]?.id) setPendingProjectId(rows[0].id)
      return
    }
    if (paymentMethod === 'INVOICE_SEND') {
      // The project was saved in PAYMENT_PENDING; now create (or reuse) the
      // payable invoice so the seller can send the link to the client.
      const supabase = createClient()
      const { data: rows } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', auth.user?.id)
        .eq('payment_method', 'INVOICE_SEND')
        .order('created_at', { ascending: false })
        .limit(1)
      const projectId = rows?.[0]?.id || null
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
      setInvoiceUrl(`${window.location.origin}/invoice/${invJson.invoiceId}`)
      return
    }
    setCreated(true)
  }

  async function submitSpaceremitPayment() {
    const code = transactionCode.trim()
    if (!code) return
    await handleSpaceRemitVerify(code)
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
      const messages: Record<string, string> = {
        NOT_AUTHENTICATED: 'You are no longer signed in. Please sign in again.',
        SP_KEYS_MISSING: 'SpaceRemit payments are not enabled yet. Your project was saved as Payment Pending — DropVerse will confirm the payment manually.',
        SP_VERIFY_FAILED: 'We could not verify that payment. Please contact support with your transaction code.',
        SP_AMOUNT_MISMATCH: 'The paid amount does not match the project. Contact support.',
        MISSING_PARAMS: 'Payment verification failed — missing information.',
        PROJECT_NOT_FOUND: 'Project not found.',
        NOT_ALLOWED: 'Not allowed for this project.',
        WRONG_PAYMENT_METHOD: 'This project does not use SpaceRemit.',
        ALREADY_CONFIRMED: 'Payment already confirmed.',
        STATUS_BLOCKED: 'Project status cannot be updated right now. Contact support.',
      }
      setPayError(messages[data?.error ?? ''] ?? 'Payment verification failed. Your project is saved as Payment Pending.')
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
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="container pb-24 pt-28">
        {/* Progress steps */}
        <div className="mx-auto mb-12 flex max-w-2xl items-center justify-center gap-2 text-sm">
          {(['basics', 'billing', 'summary'] as Step[]).map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 transition ${
                step === s
                  ? 'bg-[#d8b45a] text-[#10221f] font-bold'
                  : 'border border-white/10 text-[#8f9f9a] hover:border-[rgba(216,180,90,0.35)] hover:text-[#d9e0dc]'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${step === s ? 'bg-[#10221f] text-[#d8b45a]' : 'bg-white/10 text-[#8f9f9a]'}`}>{i + 1}</span>
              {s === 'basics' ? 'Project Details' : s === 'billing' ? 'Billing' : 'Review & Submit'}
            </button>
          ))}
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.35fr_1fr]">
          {/* LEFT — form */}
          <div>
            <div id="cp-form-top" className="mb-8 flex items-center gap-4 scroll-mt-24">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
                <Rocket size={22} />
              </div>
              <div>
                <h1 className="font-display text-3xl font-extrabold tracking-tight">Create Project</h1>
                <p className="mt-1 text-sm text-[#8f9f9a]">Set up a new client project and its billing arrangement.</p>
              </div>
            </div>

            {/* STEP 1 — PROJECT DETAILS */}
            <section className={`rounded-3xl border border-white/5 bg-[#0a2926] p-8 ${step !== 'basics' ? 'hidden' : ''}`}>
              <h2 className="font-display text-xl font-bold">1. Project Details</h2>

              <label className="mt-6 block text-sm font-semibold text-[#c1cbc7]">Project Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Video Editing Project for Acme Co."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none"
              />
              <p className={`mt-1.5 text-xs leading-5 ${title.trim().length >= 3 ? 'text-[#6e817c]' : 'text-[#c78d7d]'}`}>
                {title.trim().length >= 3 ? `${title.trim().length} characters — looks good` : `At least 3 characters needed (${title.trim().length}/3)`}
              </p>

              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the scope: deliverables, volume, deadlines..."
                rows={4}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none"
              />
              <p className={`mt-1.5 text-xs leading-5 ${description.trim().length >= 5 ? 'text-[#6e817c]' : 'text-[#c78d7d]'}`}>
                {description.trim().length >= 5 ? `${description.trim().length} characters — looks good` : `At least 5 characters needed (${description.trim().length}/5)`}
              </p>

              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Client Contact Email (optional)</label>
              <input
                type="email"
                value={clientContactEmail}
                onChange={(e) => setClientContactEmail(e.target.value)}
                placeholder="client@company.com"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none"
              />

              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Delivery Notes (optional)</label>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Assets links, brand guidelines, references..."
                rows={3}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none"
              />

              <div className="mt-8 flex justify-end">
                <button
                  disabled={!basicsValid}
                  onClick={() => setStep('billing')}
                  className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next: Billing <ArrowRight size={16} />
                </button>
              </div>
            </section>

            {/* STEP 2 — BILLING */}
            <section className={`mt-8 rounded-3xl border border-white/5 bg-[#0a2926] p-8 ${step !== 'billing' ? 'hidden' : ''}`}>
              <h2 className="font-display text-xl font-bold">2. Billing & Payment</h2>

              {/* PROJECT TYPE — premium radio cards */}
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
                      className={`relative rounded-2xl border p-5 text-left transition duration-200 ${
                        selected
                          ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)] shadow-[0_0_40px_rgba(216,180,90,0.10)]'
                          : 'border-white/10 bg-[#071f1d] hover:border-[rgba(216,180,90,0.30)]'
                      } ${t.comingSoon ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`font-display text-base font-bold ${selected ? 'text-[#f0d98b]' : 'text-[#d9e0dc]'}`}>{t.label}</span>
                        {t.comingSoon ? (
                          <span className="whitespace-nowrap rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.10)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[.1em] text-[#f0d98b]">Coming Soon</span>
                        ) : (
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-[#d8b45a] bg-[#d8b45a]' : 'border-[#5f726c] bg-transparent'}`}>
                            {selected && <Check size={12} className="text-[#10221f]" />}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#8f9f9a]">{t.description}</p>
                    </button>
                  )
                })}
              </div>

              {/* DYNAMIC PRICING FIELDS */}
              <div className="mt-8 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-[#c1cbc7]">{labels.priceLabel} *</label>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-sm text-[#5f726c]">$</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={clientPrice}
                      onChange={(e) => setClientPrice(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-2xl border border-white/10 bg-[#071f1d] py-3.5 pl-9 pr-16 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none"
                    />
                    <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xs text-[#5f726c]">USD{labels.periodSuffix}</span>
                  </div>
                  <p className={`mt-1.5 text-xs leading-5 ${cp > 0 ? 'text-[#6e817c]' : 'text-[#c78d7d]'}`}>
                    {cp > 0 ? `${labels.costLabel} and ${labels.profitLabel} are computed automatically` : `Enter the amount you charge your client${labels.periodSuffix} (must be greater than zero)`}
                  </p>
                </div>

                <div className="rounded-2xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#c1cbc7]">{labels.costLabel}</span>
                    <span className="font-display text-lg font-extrabold text-[#f0d98b]">{formatUsd(fc)}<span className="text-xs font-normal text-[#8f9f9a]">{labels.periodSuffix}</span></span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-[#6e817c]">Computed automatically from platform pricing ({Math.round((FULFILLMENT_RATES[projectType] ?? 0) * 100)}% of the client price) — not entered by you.</p>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)] px-5 py-4">
                  <span className="text-sm font-semibold text-[#c1cbc7]">{labels.profitLabel}</span>
                  <span className="font-display text-lg font-extrabold text-[#f0d98b]">{formatUsd(profit)}{labels.periodSuffix}</span>
                </div>

                {/* Payment rules per type */}
                <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                    <div className="text-sm leading-6 text-[#9aaba6]">
                      <p className="font-semibold text-[#d9e0dc]">{labels.paymentNowMessage} — <span className="font-bold text-[#f0d98b]">{formatUsd(fc)}{labels.periodSuffix}</span> DropVerse fulfillment amount</p>
                      <p>{labels.fulfillmentMessage}</p>
                      {projectType === 'ANNUAL' && (
                        <p className="mt-1 text-[#c1cbc7]">The initial payment covers the entire first year — it is not split into monthly payments.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* PAYMENT METHOD */}
                <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#6e817c]">Payment Method</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {PAYMENT_METHODS.map(m => {
                    const selected = paymentMethod === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`relative rounded-2xl border p-5 text-left transition duration-200 ${
                          selected
                            ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]'
                            : 'border-white/10 bg-[#071f1d] hover:border-[rgba(216,180,90,0.30)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={`flex items-center gap-2.5 font-bold ${selected ? 'text-[#f0d98b]' : 'text-[#d9e0dc]'}`}>
                            {m.id === 'CLIENT_PAYS_DROPVERSE' ? <CreditCard size={18} className="text-[#d8b45a]" /> : m.id === 'SPACEREMIT' ? <Wallet size={18} className="text-[#d8b45a]" /> : m.id === 'INVOICE_SEND' ? <FileText size={18} className="text-[#d8b45a]" /> : <HandCoins size={18} className="text-[#d8b45a]" />}
                            {m.label}
                          </span>
                          {m.recommended ? (
                            <span className="whitespace-nowrap rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.10)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[.1em] text-[#f0d98b]">Recommended</span>
                          ) : (
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-[#d8b45a] bg-[#d8b45a]' : 'border-[#5f726c]'}`}>
                              {selected && <Check size={12} className="text-[#10221f]" />}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#8f9f9a]">{m.description}</p>
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs leading-5 text-[#6e817c]">
                  Your profit is always the difference between the client price and the DropVerse fulfillment cost. You only pay the DropVerse fulfillment amount to start the service.
                </p>

                <div className="flex items-start gap-3 rounded-2xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.05)] p-4">
                  <Info size={16} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                  <p className="text-xs leading-5 text-[#9aaba6]">
                    SpaceRemit is available for <span className="font-bold text-[#d9e0dc]">SpaceRemit</span> and <span className="font-bold text-[#d9e0dc]">Invoice Send</span> payments. When you submit, the project starts in <span className="font-bold text-[#f0d98b]">Payment Pending</span>. The fulfillment team is never instructed to start work until the required payment for the current period is confirmed.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setStep('basics')}
                    className="rounded-full border border-white/10 px-6 py-3 text-sm font-bold text-[#d9e0dc] transition hover:border-white/25"
                  >
                    Back
                  </button>
                  <button
                    disabled={!billingValid}
                    onClick={() => setStep('summary')}
                    className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next: Review <ArrowRight size={16} />
                  </button>
                </div>
                {!billingValid && (
                  <p className="mt-3 text-right text-xs leading-5 text-[#c78d7d]">
                    Enter the client price above to unlock the review step.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT — live summary sticky card */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl border border-[rgba(216,180,90,0.25)] bg-[#0a2926] p-7 shadow-[0_0_60px_rgba(216,180,90,0.07)]">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#6e817c]">Project Summary</p>
              <h3 className="font-display mt-2 text-xl font-extrabold">{title.trim() || 'Untitled Project'}</h3>

              <dl className="mt-6 space-y-3.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-[#8f9f9a]">Project Type</dt>
                  <dd className="font-semibold text-[#d9e0dc]">
                    {PROJECT_TYPES.find(t => t.id === projectType)?.label}
                    {typeBlocked && <span className="ml-2 rounded-full bg-[rgba(216,180,90,0.15)] px-2 py-0.5 text-[10px] font-bold uppercase text-[#f0d98b]">Coming Soon</span>}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[#8f9f9a]">Client Price</dt>
                  <dd className="font-bold text-[#d9e0dc]">{formatUsd(cp)}<span className="text-xs font-normal text-[#8f9f9a]">{labels.periodSuffix}</span></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[#8f9f9a]">DropVerse Fulfillment</dt>
                  <dd className="font-bold text-[#d9e0dc]">{formatUsd(fc)}<span className="text-xs font-normal text-[#8f9f9a]">{labels.periodSuffix}</span></dd>
                </div>
                <div className="flex items-center justify-between border-t border-white/10 pt-3.5">
                  <dt className="font-semibold text-[#c1cbc7]">Estimated Profit</dt>
                  <dd className="font-display text-lg font-extrabold text-[#f0d98b]">{formatUsd(profit)}<span className="text-xs font-normal text-[#8f9f9a]">{labels.periodSuffix}</span></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[#8f9f9a]">Payment Required Now</dt>
                  <dd className="font-bold text-[#d9e0dc]">
                    {paymentMethod === 'SELLER_COLLECTED' ? formatUsd(dueNow) : formatUsd(cp)}
                    {paymentMethod === 'SELLER_COLLECTED' && <span className="ml-1 text-[10px] text-[#8f9f9a]">*fulfillment amount</span>}
                  </dd>
                </div>
                {isRecurring && (
                  <div className="flex items-center justify-between">
                    <dt className="text-[#8f9f9a]">First Billing Period</dt>
                    <dd className="font-semibold text-[#d9e0dc]">{firstBillingPeriodLabel(projectType)}</dd>
                  </div>
                )}
              </dl>

              {error && (
                <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-xs leading-5 text-red-200">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              {!created && (
                <button
                  disabled={!basicsValid || !billingValid || typeBlocked || submitting}
                  onClick={handleSubmit}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-4 font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? 'Creating...' : 'Create Project'} <ArrowRight size={17} />
                </button>
              )}
              {!created && (!basicsValid || !billingValid) && (
                <p className="mt-3 text-center text-[11px] leading-5 text-[#5f726c]">
                  {!basicsValid
                    ? 'Add a project name (at least 3 characters) and a short description (at least 5 characters) in step 1.'
                    : 'Enter the client price in step 2 — the DropVerse fulfillment cost is set by platform pricing.'}
                </p>
              )}
              {/* Spaceremit checkout step — shown after the project is saved in Payment Pending */}
              {pendingProjectId && !payConfirmed && (() => {
                const checkoutAmount = paymentMethod === 'SELLER_COLLECTED' ? fc : cp
                const isSellerPaying = paymentMethod === 'SELLER_COLLECTED'
                return (
                <div className="mt-6 rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] p-5">
                  <p className="font-display text-lg font-extrabold">Complete Payment — {formatUsd(checkoutAmount)}</p>
                  {isSellerPaying ? (
                    <>
                      <p className="mt-1 text-xs leading-5 text-[#9aaba6]">Pay only the DropVerse fulfillment amount securely via SpaceRemit (card or 70+ local methods). Fulfillment starts once the payment is confirmed on our side.</p>
                      <p className="mt-3 rounded-xl bg-[#071f1d]/60 p-4 text-xs leading-5 text-[#8f9f9a]">You pay only the DropVerse fulfillment amount of <span className="font-bold text-[#f0d98b]">{formatUsd(fc)}</span>. You keep the rest — your profit of <span className="font-bold text-[#f0d98b]">{formatUsd(profit)}</span> plus the client price you collect.</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-xs leading-5 text-[#9aaba6]">This is the full amount your client will pay. After creating the project, share the payment link with your client so they can pay securely via SpaceRemit (card or 70+ local methods) without logging in.</p>
                      <p className="mt-3 rounded-xl bg-[#071f1d]/60 p-4 text-xs leading-5 text-[#8f9f9a]">Your client pays the full price of <span className="font-bold text-[#f0d98b]">{formatUsd(cp)}</span>. The DropVerse fulfillment cost of <span className="font-bold text-[#d9e0dc]">{formatUsd(fc)}</span> is covered inside it — your profit of <span className="font-bold text-[#f0d98b]">{formatUsd(profit)}</span> stays with you.</p>
                    </>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input value={fullName} readOnly placeholder="Full name" className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3 text-sm text-[#8f9f9a] placeholder:text-[#5f726c] focus:outline-none" aria-label="Full name" />
                    <input value={payEmail} onChange={e => setPayEmail(e.target.value)} type="email" placeholder="Email for receipt" className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" aria-label="Email for receipt" />
                  </div>
                  {payError && (
                    <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs leading-5 text-red-200">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {payError}
                    </div>
                  )}
                  <SpaceRemitPayForm
                    amount={checkoutAmount}
                    fullName={fullName || (auth.user?.name ?? '')}
                    email={payEmail}
                    phone="+0000000000"
                    publicKey={process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY ?? ''}
                    onPaid={async (code: string) => {
                      setTransactionCode(code)
                      await handleSpaceRemitVerify(code)
                    }}
                    onMessage={(msg: string) => setPayError(msg)}
                  />
                  <button onClick={() => { setPendingProjectId(null) }} className="mt-3 w-full text-center text-xs font-semibold text-[#8f9f9a] hover:text-[#d9e0dc]">Back to review</button>
                </div>
                )
              })()}
              {payConfirmed && (
                <div className="mt-6 rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] p-5 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(216,180,90,0.40)] bg-[#d8b45a] text-[#10221f]">
                    <Check size={20} />
                  </div>
                  <p className="font-display text-lg font-extrabold">Payment Confirmed</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#9aaba6]">Your payment was verified through SpaceRemit. The project is ready for fulfillment.</p>
                  <Link href="/dashboard" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
                    Go to Dashboard <ArrowRight size={16} />
                  </Link>
                </div>
              )}
              {created && !pendingProjectId && invoiceId && invoiceUrl && (
                <div className="mt-6 rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] p-5">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(216,180,90,0.40)] bg-[#d8b45a] text-[#10221f]">
                    <FileText size={20} />
                  </div>
                  <p className="text-center font-display text-lg font-extrabold">Invoice Ready to Send</p>
                  <p className="mt-1.5 text-center text-xs leading-5 text-[#9aaba6]">
                    Your project is in <span className="font-bold text-[#f0d98b]">Payment Pending</span>. Share the invoice link below with your client — they can view the service details and pay securely without creating an account. Once their payment is verified, the project is confirmed automatically.
                  </p>
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3">
                    <p className="min-w-0 flex-1 truncate text-xs font-mono text-[#e7edea]">{invoiceUrl}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(invoiceUrl).then(() => {
                          setInvoiceCopied(true)
                          setTimeout(() => setInvoiceCopied(false), 2000)
                        }).catch(() => {})
                      }}
                      className="shrink-0 rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.12)] px-3.5 py-1.5 text-[11px] font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.22)]"
                    >
                      {invoiceCopied ? <><Check size={12} /></> : <><Copy size={12} /></>} {invoiceCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2">
                    <a href={`mailto:?subject=${encodeURIComponent(`Invoice — ${title.trim()}`)}&body=${encodeURIComponent(`Hi! Please find your invoice here: ${invoiceUrl}`)}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-3 text-xs font-bold text-[#d9e0dc] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#f0d98b]">
                      <ExternalLink size={13} /> Email It
                    </a>
                    <Link href={`/invoice/${invoiceId}`} target="_blank" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-3 text-xs font-bold text-[#d9e0dc] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#f0d98b]">
                      <ExternalLink size={13} /> Preview Invoice
                    </Link>
                  </div>
                  <Link href="/dashboard" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
                    Go to Dashboard <ArrowRight size={16} />
                  </Link>
                </div>
              )}
              {created && !pendingProjectId && !invoiceId && (
                <div className="mt-6 rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] p-5 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(216,180,90,0.40)] bg-[#d8b45a] text-[#10221f]">
                    <Check size={20} />
                  </div>
                  <p className="font-display text-lg font-extrabold">Project Created</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#9aaba6]">It is in <span className="font-bold text-[#f0d98b]">Payment Pending</span> status. You will be notified once the payment is confirmed and fulfillment can begin.</p>
                  {paymentMethod === 'SELLER_COLLECTED' && (
                    <p className="mt-3 rounded-xl bg-[#071f1d]/60 p-4 text-xs leading-5 text-[#8f9f9a]">
                      To start the project, you still need to pay the DropVerse fulfillment amount of <span className="font-bold text-[#f0d98b]">{formatUsd(fc)}</span> (the rest of the client price stays with you). Go to the dashboard and pay it from your project page.
                    </p>
                  )}
                  <Link href="/dashboard" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
                    Go to Dashboard <ArrowRight size={16} />
                  </Link>
                </div>
              )}
              {created && !pendingProjectId && invoiceError && (
                <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-xs leading-5 text-red-200">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {invoiceError}
                  <Link href="/dashboard" className="font-bold underline">Dashboard</Link>
                </div>
              )}
              <p className="mt-4 text-center text-[11px] leading-5 text-[#5f726c]">
                {paymentMethod === 'SPACEREMIT' ? (
                  <>SpaceRemit payments are processed securely on our servers. Submitting saves the project as <span className="font-bold text-[#f0d98b]">Payment Pending</span> until the payment is verified with SpaceRemit.</>
                ) : paymentMethod === 'INVOICE_SEND' ? (
                  <>Submitting saves the project as <span className="font-bold text-[#f0d98b]">Payment Pending</span> and creates a payment invoice — your client pays from the invoice link and the project is confirmed automatically once their payment is verified.</>
                ) : (
                  <>The fulfillment team is never instructed to start work until the required payment for the current period is confirmed.</>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
