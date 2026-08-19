'use client'
import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

/**
 * Public invoice page — no login required.
 * The client opens this link, sees the service details + amount, and pays
 * through SpaceRemit. Payment verification happens server-side.
 */
export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [fullName, setFullName] = useState('')
  const [payEmail, setPayEmail] = useState('')
  const [payPhone, setPayPhone] = useState('')
  const [transactionCode, setTransactionCode] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [paySuccess, setPaySuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    params
      .then(async (p) => {
        const res = await fetch(`/api/invoices/public/${p.id}`)
        if (cancelled) return
        if (!res.ok) {
          setLoading(false)
          setNotFound(true)
          return
        }
        const json = await res.json()
        if (cancelled) return
        setInvoice(json.invoice)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
          setNotFound(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [params])

  async function handlePay() {
    setPaying(true)
    setPayError(null)
    if (!invoice) return
    const res = await fetch('/api/invoices/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId: invoice.id,
        paymentId: String(transactionCode || '').trim(),
        clientName: String(fullName || '').trim() || undefined,
        clientEmail: String(payEmail || '').trim() || undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setPaying(false)
    if (!res.ok) {
      if (json.error === 'SP_KEYS_MISSING') {
        setPayError('Payment processing is being set up — please try again in a few minutes.')
      } else if (json.error === 'SP_VERIFY_FAILED') {
        setPayError('We could not verify that transaction code. Please double-check it and try again.')
      } else if (json.error === 'SP_AMOUNT_MISMATCH') {
        setPayError('The transaction amount does not match this invoice. Please contact the seller.')
      } else if (json.error === 'INVOICE_NOT_PAYABLE') {
        setPayError(`This invoice is already ${String(json.status || 'closed').toLowerCase()}.`)
      } else if (json.error === 'MISSING_PARAMS') {
        setPayError('Please enter the transaction code.')
      } else {
        setPayError(String(json.error || json.detail || 'Payment failed — please try again.'))
      }
      return
    }
    setPaySuccess(true)
  }

  function copyLink() {
    navigator.clipboard
      .writeText(typeof window !== 'undefined' ? window.location.href : '')
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  if (loading) {
    return <InvoiceShell><Spinner /></InvoiceShell>
  }

  if (notFound || !invoice) {
    return (
      <InvoiceShell>
        <div className="mx-auto w-full max-w-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[.03] text-[#536963]">
            <ReceiptIcon />
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold text-[#d9e0dc]">Invoice not found</h1>
          <p className="mt-3 text-sm text-[#687d76]">
            This invoice link is invalid or has expired. Please ask the seller to send you a fresh link.
          </p>
        </div>
      </InvoiceShell>
    )
  }

  const due = useMemo(() => formatCurrency(invoice.amount, invoice.currency), [invoice])

  return (
    <InvoiceShell>
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="rounded-3xl border border-white/10 bg-[#0a2926] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8b45a] font-display text-sm font-black text-[#10221f]">
                    DV
                  </span>
                </Link>
                <span className="font-display text-xl font-bold tracking-[.06em] text-[#d9e0dc]">
                  DROP<span className="text-[#d8b45a]">VERSE</span>
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[.18em] text-[#687d76]">Invoice</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-[#e4c979]">{invoice.invoiceNumber}</div>
              <div className="mt-1.5 flex items-center justify-end gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6fbf73]" />
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#6fbf73]">
                  {invoice.status === 'PAID' ? 'Paid' : invoice.canPay ? 'Awaiting payment' : invoice.status}
                </span>
              </div>
            </div>
          </div>

          {/* Billed to */}
          {(invoice.clientName || invoice.clientEmail) && (
            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[.02] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#687d76]">Billed to</div>
              <div className="mt-1 text-sm font-semibold text-[#d9e0dc]">{invoice.clientName || '—'}</div>
              {invoice.clientEmail && <div className="text-xs text-[#687d76]">{invoice.clientEmail}</div>}
            </div>
          )}

          {/* Service details */}
          <div className="mt-6 rounded-2xl border border-white/5 bg-white/[.02] p-5">
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#687d76]">Service</div>
            <h1 className="mt-1.5 font-display text-xl font-bold text-[#d9e0dc]">{invoice.service.title}</h1>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#aebcb7]">
              {invoice.service.description || 'No description provided.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-[11px] font-semibold text-[#849792]">
                {invoice.service.category || 'Service'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-[11px] font-semibold text-[#849792]">
                {typeLabel(invoice.service.projectType)}
              </span>
            </div>
            {invoice.service.deliveryNotes && (
              <p className="mt-4 border-t border-white/5 pt-3 text-xs text-[#687d76]">
                <span className="font-semibold text-[#8fa29c]">Delivery notes: </span>
                {invoice.service.deliveryNotes}
              </p>
            )}
          </div>

          {/* Totals */}
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.05)] px-5 py-4">
            <span className="text-sm font-bold uppercase tracking-[.12em] text-[#cfd8d3]">Total due</span>
            <span className="font-display text-2xl font-black text-[#f0d98b]">{due}</span>
          </div>

          {/* Payment section */}
          {invoice.status === 'PAID' ? (
            <div className="mt-6 rounded-2xl border border-[rgba(111,191,115,0.40)] bg-[rgba(111,191,115,0.08)] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(111,191,115,0.45)] bg-[rgba(111,191,115,0.15)]">
                <CheckIcon />
              </div>
              <h2 className="mt-3 font-display text-lg font-bold text-[#6fbf73]">This invoice is paid</h2>
              <p className="mt-1.5 text-sm text-[#aebcb7]">Thank you! The seller has been notified and your service will be delivered as agreed.</p>
            </div>
          ) : !invoice.canPay ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.03] p-6 text-center">
              <h2 className="mt-1 font-display text-lg font-bold text-[#d9e0dc]">This invoice is no longer payable</h2>
              <p className="mt-1.5 text-sm text-[#687d76]">Please contact the seller for an updated invoice.</p>
            </div>
          ) : paySuccess ? (
            <div className="mt-6 rounded-2xl border border-[rgba(111,191,115,0.40)] bg-[rgba(111,191,115,0.08)] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(111,191,115,0.45)] bg-[rgba(111,191,115,0.15)]">
                <CheckIcon />
              </div>
              <h2 className="mt-3 font-display text-lg font-bold text-[#6fbf73]">Payment confirmed</h2>
              <p className="mt-1.5 text-sm text-[#aebcb7]">
                Your payment of {due} has been verified. The seller is notified — thank you!
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.04)] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8b45a]">
                  <WalletIcon />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-[#d9e0dc]">Pay with SpaceRemit</h2>
                  <p className="text-xs text-[#687d76]">Secure payment · no account required</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <Field label="Full name" placeholder="Your name" value={fullName} onChange={setFullName} />
                <Field label="Email address" type="email" placeholder="you@example.com" value={payEmail} onChange={setPayEmail} />
                <Field label="Phone" type="tel" placeholder="+1 555 000 0000" value={payPhone} onChange={setPayPhone} />
                <Field
                  label="Transaction code"
                  placeholder="Code from your SpaceRemit payment"
                  value={transactionCode}
                  onChange={setTransactionCode}
                  accent
                />
                <p className="text-[11px] leading-relaxed text-[#687d76]">
                  Complete the payment on SpaceRemit first, then paste the transaction code you receive and click Verify.
                  You do not need an account to pay this invoice.
                </p>
              </div>

              {payError && (
                <div className="mt-4 rounded-xl border border-[rgba(229,115,115,0.40)] bg-[rgba(229,115,115,0.10)] px-4 py-3 text-sm text-[#e57373]">
                  {payError}
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={paying}
                className="mt-5 w-full rounded-full bg-[#d8b45a] px-6 py-3.5 text-sm font-bold text-[#10221f] transition hover:bg-[#e4c979] disabled:opacity-60"
              >
                {paying ? 'Verifying payment…' : `Verify & Pay ${due}`}
              </button>
            </div>
          )}

          {/* Seller share helper */}
          <div className="mt-6 flex items-center justify-between rounded-xl border border-white/5 bg-white/[.02] px-4 py-3">
            <div className="min-w-0 text-xs text-[#687d76]">
              <span className="font-semibold text-[#8fa29c]">Seller? </span>
              Share this link with your client to collect payment.
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.10)] px-3 py-1.5 text-[11px] font-bold text-[#e4c979] transition hover:bg-[rgba(216,180,90,0.18)]"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[#536963]">
          Powered by <span className="text-[#687d76]">DropVerse</span> · Payments processed by SpaceRemit
        </p>
      </div>
    </InvoiceShell>
  )
}

/* ---------- shared bits ---------- */

interface PublicInvoice {
  id: string
  invoiceNumber: string
  clientName: string | null
  clientEmail: string | null
  currency: string
  amount: number
  status: string
  service: {
    projectId: string
    title: string
    description: string
    category: string
    projectType: string
    deliveryNotes: string
  }
  canPay: boolean
}

function InvoiceShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid-bg px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
  )
}

function Spinner() {
  return (
    <div className="mx-auto mt-32 flex h-10 w-10 animate-spin items-center justify-center rounded-full border-2 border-[rgba(216,180,90,0.30)] border-t-[#d8b45a]" />
  )
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  accent = false,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: string
  accent?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.14em] text-[#849792]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-[#071f1d] px-4 py-3 text-sm text-[#d9e0dc] placeholder:text-[#4a615b] focus:outline-none ${
          accent ? 'border-[rgba(216,180,90,0.45)] focus:border-[#d8b45a]' : 'border-white/10 focus:border-[rgba(216,180,90,0.45)]'
        }`}
      />
    </label>
  )
}

function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10221f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6fbf73" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l3-2 3 2 4-2 3 2 3-2V2l-3 2-4-2-3 2-3-2z" />
      <path d="M8 8h8M8 12h5" />
    </svg>
  )
}

function typeLabel(type: string): string {
  switch (type) {
    case 'ONE_TIME': return 'One-time'
    case 'MONTHLY': return 'Monthly'
    case 'ANNUAL': return 'Annual'
    case 'CUSTOM_RECURRING': return 'Recurring'
    default: return type || 'Service'
  }
}

function formatCurrency(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(n || 0)
  } catch {
    return `$${Math.round(n || 0).toLocaleString()}`
  }
}
