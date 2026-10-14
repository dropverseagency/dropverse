'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Brand from '../../../components/Brand'
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
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [payConfirmed, setPayConfirmed] = useState(false)
  const [paddleLoading, setPaddleLoading] = useState(false)

  useEffect(() => {
    if (!auth.loading && !auth.user) window.location.assign('/login')
  }, [auth.loading, auth.user])

  const labels = useMemo(() => moneyLabels(projectType), [projectType])
  const cp = Number(clientPrice) || 0
  const fc = useMemo(() => Math.round(cp * (FULFILLMENT_RATES[projectType] ?? 0) * 100) / 100, [cp, projectType])
  const profit = useMemo(() => computeSellerProfit(cp, fc), [cp, fc])
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
      if (!response.ok) throw new Error(payload.error || 'Unable to start checkout.')
      const paddle = await getPaddleClient()
      if (paddle && payload.transactionId) {
        paddle.Checkout.open({
          transactionId: payload.transactionId,
          settings: { displayMode: 'overlay', variant: 'one-page', theme: 'dark' },
        })
        setPaddleLoading(false)
      } else if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl)
      } else throw new Error('Checkout is not ready yet.')
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Unable to start checkout.')
      setPaddleLoading(false)
    }
  }

  async function handleSubmit() {
    if (submitting || created || pendingProjectId) return
    setSubmitting(true)
    setError(null)
    let res: { error?: string; projectId?: string }
    try {
      res = await createProjectServer({
        title, description, projectType, clientPrice: cp, fulfillmentCost: fc,
        paymentMethod, deliveryNotes, clientContactEmail,
      })
    } catch {
      res = { error: 'DB_ERROR' }
    }
    setSubmitting(false)
    if (res.error) {
      setError(res.error === 'NOT_AUTHENTICATED' ? 'Please sign in again.' : 'Something went wrong. Please try again.')
      return
    }
    if (paymentMethod === 'SPACEREMIT') {
      const supabase = createClient()
      const { data: rows } = await supabase.from('projects').select('id').eq('user_id', auth.user?.id).eq('payment_method', 'SPACEREMIT').order('created_at', { ascending: false }).limit(1)
      if (rows?.[0]?.id) setPendingProjectId(rows[0].id)
      return
    }
    if (paymentMethod === 'PADDLE' || paymentMethod === 'CLIENT_PAYS_DROPVERSE') {
      if (res.projectId) {
        setPendingProjectId(res.projectId)
        await startPaddleProjectCheckout(res.projectId)
      }
      return
    }
    if (paymentMethod === 'INVOICE_SEND') {
      const supabase = createClient()
      const { data: rows } = await supabase.from('projects').select('id').eq('user_id', auth.user?.id).eq('payment_method', 'INVOICE_SEND').order('created_at', { ascending: false }).limit(1)
      const projectId = rows?.[0]?.id || null
      if (!projectId) { setInvoiceError('Could not locate project.'); setCreated(true); return }
      const invRes = await fetch('/api/invoices/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, clientEmail: clientContactEmail?.trim() || undefined }) })
      const invJson = (await invRes.json().catch(() => ({}))) as { invoiceId?: string }
      if (!invRes.ok || !invJson.invoiceId) { setInvoiceError('Could not create invoice.'); setCreated(true); return }
      setInvoiceId(invJson.invoiceId)
      setInvoiceUrl(`${window.location.origin}/invoice/${invJson.invoiceId}`)
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
    setPaying(false)
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setPayError(data?.error ?? 'Payment verification failed.')
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

  if (created) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#071f1d] px-4">
        <div className="max-w-md rounded-3xl border border-white/10 bg-[#0a2926] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(216,180,90,0.15)] text-[#d8b45a]"><Check size={28} /></div>
          <h1 className="font-display text-2xl font-extrabold">Project created</h1>
          <p className="mt-2 text-sm text-[#8f9f9a]">Your project has been saved successfully.</p>
          {invoiceUrl && <a href={invoiceUrl} className="mt-4 block break-all text-sm text-[#d8b45a] underline" target="_blank" rel="noreferrer">{invoiceUrl}</a>}
          {invoiceError && <p className="mt-3 text-sm text-red-400">{invoiceError}</p>}
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-[#d8b45a] px-6 py-3 font-bold text-[#10221f]">Back to Dashboard</Link>
        </div>
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
            <button key={s} onClick={() => setStep(s)} className={`flex items-center gap-2 rounded-full px-4 py-2 transition ${step === s ? 'bg-[#d8b45a] text-[#10221f] font-bold' : 'border border-white/10 text-[#8f9f9a]'}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${step === s ? 'bg-[#10221f] text-[#d8b45a]' : 'bg-white/10'}`}>{i + 1}</span>
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

          {step === 'basics' && (
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/5 bg-[#0a2926] p-8">
              <h2 className="font-display text-xl font-bold">1. Project Details</h2>
              <label className="mt-6 block text-sm font-semibold text-[#c1cbc7]">Project Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Video Editing Project for Acme Co." className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Description *</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the scope..." rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Client Contact Email (optional)</label>
              <input type="email" value={clientContactEmail} onChange={(e) => setClientContactEmail(e.target.value)} placeholder="client@company.com" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
              <label className="mt-5 block text-sm font-semibold text-[#c1cbc7]">Delivery Notes (optional)</label>
              <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Assets, brand guidelines..." rows={3} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] placeholder:text-[#5f726c] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
              <div className="mt-8 flex justify-end">
                <button disabled={!basicsValid} onClick={() => setStep('billing')} className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] disabled:opacity-40">Next: Billing <ArrowRight size={16} /></button>
              </div>
            </motion.section>
          )}

          {step === 'billing' && (
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/5 bg-[#0a2926] p-8">
              <h2 className="font-display text-xl font-bold">2. Billing & Payment</h2>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[.12em] text-[#6e817c]">Project Type</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {PROJECT_TYPES.map(t => (
                  <button key={t.id} type="button" onClick={() => !t.comingSoon && setProjectType(t.id)} disabled={t.comingSoon} className={`rounded-2xl border p-5 text-left transition ${projectType === t.id ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]' : 'border-white/10 bg-[#071f1d]'} ${t.comingSoon ? 'opacity-60' : ''}`}>
                    <span className={`font-display text-base font-bold ${projectType === t.id ? 'text-[#f0d98b]' : 'text-[#d9e0dc]'}`}>{t.label}</span>
                    <p className="mt-2 text-xs text-[#8f9f9a]">{t.description}</p>
                  </button>
                ))}
              </div>
              <label className="mt-8 block text-sm font-semibold text-[#c1cbc7]">{labels.clientLabel}</label>
              <input type="number" min="0" step="0.01" value={clientPrice} onChange={(e) => setClientPrice(e.target.value)} placeholder="0.00" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#071f1d] px-5 py-3.5 text-sm text-[#e7edea] focus:border-[rgba(216,180,90,0.5)] focus:outline-none" />
              <p className="mt-2 text-xs text-[#8f9f9a]">Fulfillment: {formatUsd(fc)} · Profit: {formatUsd(profit)}</p>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[.12em] text-[#6e817c]">Payment Method</p>
              <div className="mt-4 space-y-3">
                {PAYMENT_METHODS.map(m => (
                  <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${paymentMethod === m.id ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.10)]' : 'border-white/10 bg-[#071f1d]'}`}>
                    <span className="text-[#d8b45a]">{m.id === 'CLIENT_PAYS_DROPVERSE' || m.id === 'PADDLE' ? <CreditCard size={18} /> : m.id === 'SPACEREMIT' ? <Wallet size={18} /> : m.id === 'INVOICE_SEND' ? <FileText size={18} /> : <HandCoins size={18} />}</span>
                    <div><span className="font-semibold text-[#e7edea]">{m.label}</span><p className="mt-1 text-xs text-[#8f9f9a]">{m.description}</p></div>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-between">
                <button onClick={() => setStep('basics')} className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-[#c1cbc7]">Back</button>
                <button disabled={!billingValid} onClick={() => setStep('summary')} className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] disabled:opacity-40">Next: Review <ArrowRight size={16} /></button>
              </div>
            </motion.section>
          )}

          {step === 'summary' && (
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/5 bg-[#0a2926] p-8">
              <h2 className="font-display text-xl font-bold">3. Review & Submit</h2>
              <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-[#071f1d] p-5 text-sm">
                <div className="flex justify-between"><span className="text-[#8f9f9a]">Title</span><span className="font-semibold">{title || '—'}</span></div>
                <div className="flex justify-between"><span className="text-[#8f9f9a]">Type</span><span className="font-semibold">{PROJECT_TYPES.find(t => t.id === projectType)?.label}</span></div>
                <div className="flex justify-between"><span className="text-[#8f9f9a]">Client price</span><span className="font-semibold">{formatUsd(cp)}</span></div>
                <div className="flex justify-between"><span className="text-[#8f9f9a]">Fulfillment</span><span className="font-semibold">{formatUsd(fc)}</span></div>
                <div className="flex justify-between"><span className="text-[#8f9f9a]">Your profit</span><span className="font-semibold text-[#d8b45a]">{formatUsd(profit)}</span></div>
                <div className="flex justify-between"><span className="text-[#8f9f9a]">Payment</span><span className="font-semibold">{PAYMENT_METHODS.find(m => m.id === paymentMethod)?.label}</span></div>
              </div>
              {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
              {payError && <p className="mt-4 text-sm text-red-400">{payError}</p>}
              {pendingProjectId && paymentMethod === 'SPACEREMIT' && (
                <div className="mt-6">
                  <SpaceRemitPayForm amount={fc} fullName={fullName || (auth.user?.name ?? '')} email={payEmail} phone="+0000000000" publicKey={process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY ?? ''} onPaid={async (code) => { await handleSpaceRemitVerify(code) }} onMessage={(msg) => setPayError(msg)} />
                </div>
              )}
              {pendingProjectId && (paymentMethod === 'PADDLE' || paymentMethod === 'CLIENT_PAYS_DROPVERSE') && (
                <button onClick={() => startPaddleProjectCheckout(pendingProjectId)} disabled={paddleLoading} className="mt-6 w-full rounded-full bg-[#d8b45a] py-3 font-bold text-[#10221f] disabled:opacity-50">{paddleLoading ? 'Opening checkout…' : 'Pay with card'}</button>
              )}
              <div className="mt-8 flex justify-between">
                <button onClick={() => setStep('billing')} className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-[#c1cbc7]">Back</button>
                {!pendingProjectId && (
                  <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3 font-bold text-[#10221f] disabled:opacity-40">{submitting ? 'Creating…' : 'Create Project'} <ArrowRight size={16} /></button>
                )}
              </div>
            </motion.section>
          )}
        </div>
      </div>
    </main>
  )
}
