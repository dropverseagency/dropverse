'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Brand from '../../../components/Brand'
import {
  ArrowRight, Rocket, Wallet, FileText, Link2, Copy, ExternalLink, Mail,
} from 'lucide-react'
import { useAuth } from '../../../lib/useAuth'
import {
  PROJECT_TYPES, moneyLabels,
  formatUsd, computeSellerProfit, FULFILLMENT_RATES,
  type ProjectType, type PaymentMethod,
} from '../../../lib/projectConfig'
import { createProjectServer } from '../../../lib/createProject'
import { serialiseBrief, type BriefInput } from '../../../lib/projectBrief'
import SpaceRemitPayForm from '../../../components/SpaceRemitPayForm'

type Step = 'basics' | 'billing' | 'summary'
type PaymentChoice = 'LOCAL_PAYMENT' | 'PAYPAL_PAYMENT' | 'PAYPAL_INVOICE' | 'LOCAL_INVOICE'

const paymentChoices: { id: PaymentChoice; label: string; description: string }[] = [
  {
    id: 'LOCAL_PAYMENT',
    label: 'Local Payment',
    description: 'Pay with wallets, bank transfer, and supported local methods.',
  },
  {
    id: 'PAYPAL_PAYMENT',
    label: 'PayPal',
    description: 'Continue directly to secure PayPal checkout after creating the project.',
  },
  {
    id: 'PAYPAL_INVOICE',
    label: 'Send PayPal Invoice',
    description: 'Create an invoice link for your client with PayPal selected.',
  },
  {
    id: 'LOCAL_INVOICE',
    label: 'Send Local Payment Invoice',
    description: 'Create an invoice link for your client with local payment selected.',
  },
]

export default function CreateProjectPage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const [step, setStep] = useState<Step>('basics')
  const [projectType, setProjectType] = useState<ProjectType>('ONE_TIME')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [brief, setBrief] = useState<BriefInput>({ goal: '', deadline: '', format: '', references: '', notes: '' })
  const [briefAttempted, setBriefAttempted] = useState(false)
  const [clientPrice, setClientPrice] = useState('')
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('LOCAL_PAYMENT')
  const [clientContactEmail, setClientContactEmail] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(false)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [briefCopied, setBriefCopied] = useState(false)
  const [paymentBusy, setPaymentBusy] = useState(false)

  useEffect(() => {
    if (!auth.loading && !auth.user) window.location.assign('/login')
  }, [auth.loading, auth.user])

  const labels = useMemo(() => moneyLabels(projectType), [projectType])
  const cp = Number(clientPrice) || 0
  const fc = useMemo(() => Math.round(cp * (FULFILLMENT_RATES[projectType] ?? 0) * 100) / 100, [cp, projectType])
  const profit = useMemo(() => computeSellerProfit(cp, fc), [cp, fc])
  const typeBlocked = projectType === 'CUSTOM_RECURRING'
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const goalValid = brief.goal.trim().length >= 10
  const formatValid = brief.format.trim().length >= 5
  const deadlineValid = !brief.deadline || brief.deadline >= today
  const briefValid = goalValid && formatValid && deadlineValid
  const basicsValid = title.trim().length >= 3 && description.trim().length >= 5 && briefValid
  const billingValid = cp > 0
  const paymentMethod: PaymentMethod = paymentChoice === 'LOCAL_PAYMENT' ? 'SPACEREMIT' : 'INVOICE_SEND'
  const serialisedBrief = useMemo(() => serialiseBrief(brief), [brief])
  const storedDescription = useMemo(
    () => `${serialisedBrief}\n\n## Description\n${description}`.trim(),
    [serialisedBrief, description],
  )

  function updateBrief(field: keyof BriefInput, value: string) {
    setBrief((current) => ({ ...current, [field]: value }))
  }

  function continueToBilling() {
    setBriefAttempted(true)
    if (basicsValid) setStep('billing')
  }

  function navigateToStep(nextStep: Step) {
    if (nextStep === 'basics') {
      setStep(nextStep)
      return
    }
    setBriefAttempted(true)
    if (!basicsValid) {
      setStep('basics')
      return
    }
    if (nextStep === 'summary' && (!billingValid || typeBlocked)) {
      setStep('billing')
      return
    }
    setStep(nextStep)
  }

  async function createInvoiceLink(projectId: string) {
    setPayError(null)
    try {
      const invRes = await fetch('/api/invoices/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId, clientName: clientContactEmail?.trim() || '' }),
      })
      const invJson = (await invRes.json().catch(() => ({}))) as { invoiceId?: string; error?: string }
      if (!invRes.ok || !invJson.invoiceId) {
        setPayError('Project saved, but the payment link could not be created. Try again below.')
        return false
      }
      const suffix = paymentChoice === 'LOCAL_INVOICE' ? '?method=local' : '?method=paypal'
      const url = `${window.location.origin}/invoice/${invJson.invoiceId}${suffix}`
      setInvoiceId(invJson.invoiceId)
      setInvoiceUrl(url)
      setPendingProjectId(null)
      setCreated(true)
      setStep('summary')
      if (paymentChoice === 'PAYPAL_PAYMENT') {
        window.location.assign(url)
      }
      return true
    } catch {
      setPayError('Project saved, but the payment link could not be created. Check your connection and try again.')
      return false
    }
  }

  async function copyPaymentLink() {
    if (!invoiceUrl) return
    try {
      await navigator.clipboard.writeText(invoiceUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1800)
    } catch {
      setPayError('Could not copy automatically. Select and copy the link above.')
    }
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(serialisedBrief)
      setBriefCopied(true)
      window.setTimeout(() => setBriefCopied(false), 1800)
    } catch {
      setPayError('Could not copy the brief automatically.')
    }
  }

  async function confirmLocalPayment(paymentId: string) {
    if (!pendingProjectId || paymentBusy) return
    setPaymentBusy(true)
    setPayError(null)
    try {
      const response = await fetch('/api/spaceremit/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentId, projectId: pendingProjectId }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        setPayError(json.error === 'SP_KEYS_MISSING'
          ? 'Local payment is not configured yet. Contact support before trying again.'
          : 'We could not verify this payment. Please try again.')
        return
      }
      setPendingProjectId(null)
      setCreated(true)
    } catch {
      setPayError('We could not verify this payment. Check your connection and try again.')
    } finally {
      setPaymentBusy(false)
    }
  }

  async function handleSubmit() {
    if (submitting || created || pendingProjectId) return
    setSubmitting(true)
    setError(null)
    let res: { error?: string; detail?: string; projectId?: string }
    try {
      res = await createProjectServer({
        title, description: storedDescription, projectType, clientPrice: cp, fulfillmentCost: fc,
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
    if (paymentMethod === 'SPACEREMIT') {
      if (id) setPendingProjectId(id)
      return
    }
    if (paymentMethod === 'CLIENT_PAYS_DROPVERSE' && id) {
      setPendingProjectId(id)
      return
    }
    if (paymentMethod === 'INVOICE_SEND' && id) {
      setPendingProjectId(id)
      await createInvoiceLink(id)
      return
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
              onClick={() => navigateToStep(s)}
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
              <p className="font-display text-xl font-extrabold text-[#f0d98b]">
                {paymentChoice === 'PAYPAL_INVOICE' ? 'PayPal invoice ready' : 'Local payment invoice ready'}
              </p>
              <p className="mt-2 text-sm text-[#c1cbc7]">
                Share this secure link with your client. No DropVerse account is required to pay.
              </p>
              <p className="mt-2 break-all font-mono text-xs text-[#e7edea]">{invoiceUrl}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => void copyPaymentLink()} className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f]">
                  <Copy size={15} /> {linkCopied ? 'Copied' : 'Copy link'}
                </button>
                <button type="button" onClick={() => void copyBrief()} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-[#d9e0dc]">
                  <Copy size={15} /> {briefCopied ? 'Brief copied' : 'Copy brief'}
                </button>
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-[#d9e0dc]">
                  <ExternalLink size={15} /> Open
                </a>
                <a
                  href={`mailto:${clientContactEmail.trim()}?subject=${encodeURIComponent(`Invoice for ${title}`)}&body=${encodeURIComponent(`Hi,\n\nYou can review and pay for ${title} here:\n${invoiceUrl}\n\nThank you.`)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-[#d9e0dc]"
                >
                  <Mail size={15} /> Send by email
                </a>
                <Link href="/dashboard" className="inline-flex items-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-[#d9e0dc]">Dashboard</Link>
              </div>
            </div>
          )}

          <motion.section className={step !== 'basics' ? 'rounded-3xl border border-white/5 bg-[#0a2926] p-8 hidden' : 'rounded-3xl border border-white/5 bg-[#0a2926] p-8'}>
            <h2 className="font-display text-xl font-bold">1. Project Details</h2>
            <label className="mt-6 block text-sm font-semibold text-[#c1cbc7]">Project Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Video Editing Project" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
            {briefAttempted && title.trim().length < 3 && <p className="mt-2 text-xs text-red-300">Enter at least 3 characters for the project title.</p>}
            <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the scope..." rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
            {briefAttempted && description.trim().length < 5 && <p className="mt-2 text-xs text-red-300">Enter at least 5 characters for the description.</p>}
            <div className="mt-8 border-t border-white/10 pt-8">
              <h3 className="font-display text-lg font-bold text-[#e7edea]">Project brief</h3>
              <p className="mt-2 text-sm leading-6 text-[#8f9f9a]">Give the freelancer the details needed to plan the delivery.</p>

              <label className="mt-6 block text-sm font-semibold text-[#c1cbc7]">Goal *</label>
              <p className="mt-1 text-xs text-[#8f9f9a]">What should the finished work achieve?</p>
              <textarea maxLength={300} value={brief.goal} onChange={(e) => updateBrief('goal', e.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
              {briefAttempted && !goalValid && <p className="mt-2 text-xs text-red-300">Enter at least 10 characters for the project goal.</p>}

              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Duration or deadline (optional)</label>
              <p className="mt-1 text-xs text-[#8f9f9a]">When do you need it?</p>
              <input type="date" min={today} value={brief.deadline} onChange={(e) => updateBrief('deadline', e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
              {briefAttempted && !deadlineValid && <p className="mt-2 text-xs text-red-300">Choose today or a future date.</p>}

              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Format and deliverables *</label>
              <p className="mt-1 text-xs text-[#8f9f9a]">What files or formats do you need? e.g. 9:16 MP4, 1080p</p>
              <textarea maxLength={300} value={brief.format} onChange={(e) => updateBrief('format', e.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
              {briefAttempted && !formatValid && <p className="mt-2 text-xs text-red-300">Enter at least 5 characters for the required files or formats.</p>}

              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">References or examples (optional)</label>
              <p className="mt-1 text-xs text-[#8f9f9a]">Links or descriptions of what you like</p>
              <textarea maxLength={500} value={brief.references} onChange={(e) => updateBrief('references', e.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />

              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Notes for the freelancer (optional)</label>
              <p className="mt-1 text-xs text-[#8f9f9a]">Anything else the freelancer should know</p>
              <textarea maxLength={500} value={brief.notes} onChange={(e) => updateBrief('notes', e.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
            </div>
            <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Client Contact Email (optional)</label>
            <input type="email" value={clientContactEmail} onChange={(e) => setClientContactEmail(e.target.value)} placeholder="client@company.com" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
            <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Delivery Notes (optional)</label>
            <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
            <div className="mt-8 flex justify-end">
              <button onClick={continueToBilling} className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f]">Next: Billing <ArrowRight size={16} /></button>
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
                {paymentChoices.map((m) => {
                  const selected = paymentChoice === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentChoice(m.id)}
                      className={
                        selected
                          ? 'rounded-2xl border p-4 text-left border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]'
                          : 'rounded-2xl border p-4 text-left border-white/10 bg-[#071f1d]'
                      }
                    >
                      <div className="flex items-center gap-2">
                        {m.id === 'LOCAL_PAYMENT' ? <Wallet size={18} className="text-[#d8b45a]" /> : m.id === 'PAYPAL_PAYMENT' ? <Link2 size={18} className="text-[#d8b45a]" /> : <FileText size={18} className="text-[#d8b45a]" />}
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
            <div className="mt-6 rounded-2xl border border-white/10 bg-[#071f1d] p-5">
              <h3 className="font-display text-base font-bold text-[#e7edea]">Project brief preview</h3>
              <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-[#c1cbc7]">{storedDescription}</pre>
            </div>
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            {pendingProjectId && paymentMethod === 'SPACEREMIT' && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#071f1d] p-5 text-sm text-[#c1cbc7]">
                <p className="font-semibold text-[#e4c979]">Complete local payment</p>
                <p className="mt-2">Pay the DropVerse fulfillment amount of {formatUsd(fc)} to activate this project.</p>
                {payError && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-red-200">{payError}</p>}
                <div className="mt-5">
                  <SpaceRemitPayForm
                    amount={fc}
                    fullName={String(auth.user?.name || auth.user?.email || 'Project owner')}
                    email={String(auth.user?.email || '')}
                    phone="+0000000000"
                    publicKey={process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY ?? ''}
                    submitLabel={`Pay ${formatUsd(fc)} locally →`}
                    disabled={paymentBusy}
                    onPaid={(paymentId) => void confirmLocalPayment(paymentId)}
                    onMessage={(message) => setPayError(message)}
                  />
                </div>
              </div>
            )}
            {pendingProjectId && paymentMethod === 'INVOICE_SEND' && !invoiceUrl && (
              <div className="mt-6 rounded-2xl border border-[rgba(229,115,115,0.35)] bg-[rgba(229,115,115,0.08)] p-5 text-sm text-[#c1cbc7]">
                <p className="font-semibold text-red-200">Payment link not ready</p>
                <p className="mt-2">{payError || 'The project was saved, but its shareable payment link still needs to be created.'}</p>
                <button type="button" onClick={() => void createInvoiceLink(pendingProjectId)} className="mt-4 inline-flex rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f]">Try again</button>
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
