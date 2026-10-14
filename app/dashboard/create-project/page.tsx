'use client'
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Brand from '../../../components/Brand'
import {
  ArrowRight, Rocket, Check, CreditCard,
  HandCoins, Wallet, FileText, Clock,
} from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { useAuth } from '../../../lib/useAuth'
import {
  PROJECT_TYPES, PAYMENT_METHODS, moneyLabels,
  formatUsd, computeSellerProfit, FULFILLMENT_RATES,
  paymentsEnabled,
  type ProjectType, type PaymentMethod,
} from '../../../lib/projectConfig'
import { createProjectServer } from '../../../lib/createProject'
import SpaceRemitPayForm from '../../../components/SpaceRemitPayForm'

type Step = 'basics' | 'billing' | 'summary'

const paymentsOn = paymentsEnabled()

export default function CreateProjectPage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)

  const [step, setStep] = useState<Step>('basics')
  const [projectType, setProjectType] = useState<ProjectType>('ONE_TIME')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientPrice, setClientPrice] = useState('')
  // When payments are off the server forces PENDING_MANUAL; keep a valid UI default.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    paymentsOn ? 'CLIENT_PAYS_DROPVERSE' : 'PENDING_MANUAL',
  )
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

  useEffect(() => {
    if (!auth.loading && !auth.user) window.location.assign('/login')
  }, [auth.loading, auth.user])

  const labels = useMemo(() => moneyLabels(projectType), [projectType])
  const cp = Number(clientPrice) || 0
  const fc = useMemo(() => Math.round(cp * (FULFILLMENT_RATES[projectType] ?? 0) * 100) / 100, [cp, projectType])
  const profit = useMemo(() => computeSellerProfit(cp, fc), [cp, fc])
  const basicsValid = title.trim().length >= 3 && description.trim().length >= 5
  const billingValid = cp > 0

  async function handleSubmit() {
    if (submitting || created || pendingProjectId) return
    setSubmitting(true)
    setError(null)
    let res: {
      error?: string
      projectId?: string
      paymentMethod?: PaymentMethod
    }
    try {
      res = await createProjectServer({
        title,
        description,
        projectType,
        clientPrice: cp,
        fulfillmentCost: fc,
        paymentMethod: paymentsOn ? paymentMethod : 'PENDING_MANUAL',
        deliveryNotes,
        clientContactEmail,
      })
    } catch {
      res = { error: 'DB_ERROR' }
    }
    setSubmitting(false)
    if (res.error) {
      setError(
        res.error === 'NOT_AUTHENTICATED'
          ? 'Please sign in again.'
          : res.error === 'INVALID_PAYMENT_METHOD'
            ? 'That payment method is not available.'
            : 'Something went wrong. Please try again.',
      )
      return
    }

    const storedMethod = res.paymentMethod ?? paymentMethod

    // Payments disabled path: project is pending manual contact.
    if (!paymentsOn || storedMethod === 'PENDING_MANUAL') {
      setCreated(true)
      return
    }

    if (storedMethod === 'SPACEREMIT') {
      const supabase = createClient()
      const { data: rows } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', auth.user?.id)
        .eq('payment_method', 'SPACEREMIT')
        .order('created_at', { ascending: false })
        .limit(1)
      if (rows?.[0]?.id) setPendingProjectId(rows[0].id)
      else if (res.projectId) setPendingProjectId(res.projectId)
      return
    }

    if (storedMethod === 'CLIENT_PAYS_DROPVERSE') {
      // Paddle checkout stays in codebase; only runs when payments are enabled.
      // Routes live under /api/paddle/* (bring from main when enabling payments).
      if (res.projectId) {
        setPendingProjectId(res.projectId)
        setPayError('Card checkout is not fully configured yet. We will contact you to confirm payment.')
        setCreated(true)
      }
      return
    }

    if (storedMethod === 'INVOICE_SEND') {
      const projectId = res.projectId
      if (!projectId) {
        setInvoiceError('Could not locate project.')
        setCreated(true)
        return
      }
      const invRes = await fetch('/api/invoices/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, clientEmail: clientContactEmail?.trim() || undefined }),
      })
      const invJson = (await invRes.json().catch(() => ({}))) as { invoiceId?: string }
      if (!invRes.ok || !invJson.invoiceId) {
        setInvoiceError('Could not create invoice.')
        setCreated(true)
        return
      }
      setInvoiceId(invJson.invoiceId)
      setInvoiceUrl(`${window.location.origin}/invoice/${invJson.invoiceId}`)
      setCreated(true)
      return
    }

    // SELLER_COLLECTED and any other allowed method
    setCreated(true)
  }

  async function handleSpaceRemitVerify(paymentId: string) {
    if (!pendingProjectId || !paymentsOn) return
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
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Link href="/login" className="rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">
          Sign in
        </Link>
      </main>
    )
  }

  if (created) {
    const pendingManual = !paymentsOn || paymentMethod === 'PENDING_MANUAL'
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Check size={28} />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Project created</h1>
          {pendingManual ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Online payment is coming soon. We will contact you to confirm this project.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Your project has been saved successfully.</p>
          )}
          {invoiceUrl && (
            <a href={invoiceUrl} className="mt-4 block break-all text-sm text-primary underline" target="_blank" rel="noreferrer">
              {invoiceUrl}
            </a>
          )}
          {invoiceError && <p className="mt-3 text-sm text-destructive">{invoiceError}</p>}
          {payError && <p className="mt-3 text-sm text-destructive">{payError}</p>}
          <Link
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Brand />
          <Link
            href="/dashboard"
            className="rounded-full border border-primary/35 bg-primary/8 px-4 py-2 text-sm font-bold text-primary"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="container pb-24 pt-28">
        <div className="mx-auto mb-12 flex max-w-2xl items-center justify-center gap-2 text-sm">
          {(['basics', 'billing', 'summary'] as Step[]).map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 transition ${
                step === s
                  ? 'bg-primary text-primary-foreground font-bold'
                  : 'border border-border text-muted-foreground'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  step === s ? 'bg-primary-foreground text-primary' : 'bg-muted'
                }`}
              >
                {i + 1}
              </span>
              {s === 'basics' ? 'Project Details' : s === 'billing' ? 'Billing' : 'Review & Submit'}
            </button>
          ))}
        </div>

        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/8 text-primary">
              <Rocket size={22} />
            </div>
            <div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Create Project</h1>
              <p className="mt-1 text-sm text-muted-foreground">Set up a new client project and its billing arrangement.</p>
            </div>
          </div>

          {step === 'basics' && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border bg-card p-8"
            >
              <h2 className="font-display text-xl font-bold text-foreground">1. Project Details</h2>
              <label className="mt-6 block text-sm font-semibold text-foreground">Project Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Video Editing Project for Acme Co."
                className="mt-2 w-full rounded-2xl border border-border bg-background px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              />
              <label className="mt-5 block text-sm font-semibold text-foreground">Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the scope..."
                rows={4}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              />
              <label className="mt-5 block text-sm font-semibold text-foreground">Client Contact Email (optional)</label>
              <input
                type="email"
                value={clientContactEmail}
                onChange={(e) => setClientContactEmail(e.target.value)}
                placeholder="client@company.com"
                className="mt-2 w-full rounded-2xl border border-border bg-background px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              />
              <label className="mt-5 block text-sm font-semibold text-foreground">Delivery Notes (optional)</label>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Assets, brand guidelines..."
                rows={3}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-5 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              />
              <div className="mt-8 flex justify-end">
                <button
                  disabled={!basicsValid}
                  onClick={() => setStep('billing')}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-bold text-primary-foreground disabled:opacity-40"
                >
                  Next: Billing <ArrowRight size={16} />
                </button>
              </div>
            </motion.section>
          )}

          {step === 'billing' && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border bg-card p-8"
            >
              <h2 className="font-display text-xl font-bold text-foreground">2. Billing & Payment</h2>
              <p className="mt-6 text-sm font-semibold uppercase tracking-[.12em] text-muted-foreground">Project Type</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {PROJECT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => !t.comingSoon && setProjectType(t.id)}
                    disabled={t.comingSoon}
                    className={`rounded-2xl border p-5 text-left transition ${
                      projectType === t.id
                        ? 'border-primary/55 bg-primary/10'
                        : 'border-border bg-background'
                    } ${t.comingSoon ? 'opacity-60' : ''}`}
                  >
                    <span
                      className={`font-display text-base font-bold ${
                        projectType === t.id ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {t.label}
                    </span>
                    <p className="mt-2 text-xs text-muted-foreground">{t.description}</p>
                  </button>
                ))}
              </div>
              <label className="mt-8 block text-sm font-semibold text-foreground">{labels.priceLabel}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={clientPrice}
                onChange={(e) => setClientPrice(e.target.value)}
                placeholder="0.00"
                className="mt-2 w-full rounded-2xl border border-border bg-background px-5 py-3.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Fulfillment: {formatUsd(fc)} · Profit: {formatUsd(profit)}
              </p>

              {!paymentsOn ? (
                <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-background p-4">
                  <Clock size={18} className="mt-0.5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Online payment is coming soon</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      We will contact you to confirm this project. No card or gateway checkout is required right now.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-6 text-sm font-semibold uppercase tracking-[.12em] text-muted-foreground">
                    Payment Method
                  </p>
                  <div className="mt-4 space-y-3">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${
                          paymentMethod === m.id
                            ? 'border-primary/55 bg-primary/10'
                            : 'border-border bg-background'
                        }`}
                      >
                        <span className="text-primary">
                          {m.id === 'CLIENT_PAYS_DROPVERSE' ? (
                            <CreditCard size={18} />
                          ) : m.id === 'SPACEREMIT' ? (
                            <Wallet size={18} />
                          ) : m.id === 'INVOICE_SEND' ? (
                            <FileText size={18} />
                          ) : (
                            <HandCoins size={18} />
                          )}
                        </span>
                        <div>
                          <span className="font-semibold text-foreground">{m.label}</span>
                          <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep('basics')}
                  className="rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground"
                >
                  Back
                </button>
                <button
                  disabled={!billingValid}
                  onClick={() => setStep('summary')}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-bold text-primary-foreground disabled:opacity-40"
                >
                  Next: Review <ArrowRight size={16} />
                </button>
              </div>
            </motion.section>
          )}

          {step === 'summary' && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-border bg-card p-8"
            >
              <h2 className="font-display text-xl font-bold text-foreground">3. Review & Submit</h2>
              <div className="mt-6 space-y-3 rounded-2xl border border-border bg-background p-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Title</span>
                  <span className="font-semibold text-foreground">{title || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-semibold text-foreground">
                    {PROJECT_TYPES.find((t) => t.id === projectType)?.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client price</span>
                  <span className="font-semibold text-foreground">{formatUsd(cp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fulfillment</span>
                  <span className="font-semibold text-foreground">{formatUsd(fc)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your profit</span>
                  <span className="font-semibold text-primary">{formatUsd(profit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment</span>
                  <span className="font-semibold text-foreground">
                    {!paymentsOn
                      ? 'Manual confirmation (online payment coming soon)'
                      : PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label}
                  </span>
                </div>
              </div>
              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
              {payError && <p className="mt-4 text-sm text-destructive">{payError}</p>}
              {pendingProjectId && paymentsOn && paymentMethod === 'SPACEREMIT' && (
                <div className="mt-6">
                  <SpaceRemitPayForm
                    amount={fc}
                    fullName={fullName || (auth.user?.name ?? '')}
                    email={payEmail}
                    phone="+0000000000"
                    publicKey={process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY ?? ''}
                    onPaid={async (code) => {
                      await handleSpaceRemitVerify(code)
                    }}
                    onMessage={(msg) => setPayError(msg)}
                  />
                </div>
              )}
              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep('billing')}
                  className="rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground"
                >
                  Back
                </button>
                {!pendingProjectId && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-bold text-primary-foreground disabled:opacity-40"
                  >
                    {submitting ? 'Creating…' : paymentsOn ? 'Create Project' : 'Request this service'}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </motion.section>
          )}
        </div>
      </div>
    </main>
  )
}
