'use client'
import { useState } from 'react'

import SpaceRemitPayForm from '../../../components/SpaceRemitPayForm'

interface Props {
  invoiceId: string
  due: string
  amount: number
}

export default function InvoicePayForm({ invoiceId, due, amount }: Props) {
  // Buyer info is passed to SpaceRemit as hidden defaults (name = invoice
  // recipient when available); the client only presses Pay Now.
  const [fullName] = useState('')
  const [payEmail] = useState('')
  const [transactionCode, setTransactionCode] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [paySuccess, setPaySuccess] = useState(false)

  async function handlePay() {
    setPaying(true)
    setPayError(null)
    const res = await fetch('/api/invoices/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceId,
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
      } else if (json.error === 'SPACEREMIT_VERIFY_FAILED' || json.error === 'SP_VERIFY_FAILED') {
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

  if (paySuccess) {
    return (
      <div className="mt-6 rounded-2xl border border-[rgba(111,191,115,0.40)] bg-[rgba(111,191,115,0.08)] p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(111,191,115,0.45)] bg-[rgba(111,191,115,0.15)]">
          <CheckIcon />
        </div>
        <h2 className="mt-3 font-display text-lg font-bold text-[#6fbf73]">Payment confirmed</h2>
        <p className="mt-1.5 text-sm text-[#aebcb7]">
          Your payment of {due} has been verified. The seller is notified — thank you!
        </p>
      </div>
    )
  }

  return (
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

      <p className="mt-4 text-[11px] leading-relaxed text-[#687d76]">
        Select a payment method below, then press Pay Now. Once your payment completes,
        it is verified automatically and your invoice is marked paid. No account required.
      </p>

      <SpaceRemitPayForm
        amount={amount}
        fullName={fullName || 'Invoice client'}
        email={payEmail || 'client@example.com'}
        phone="+0000000000"
        submitLabel="Pay Now →"
        publicKey={process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY ?? ''}
        onPaid={async (code: string) => {
          setPaying(true)
          setPayError(null)
          setTransactionCode(code)
          const res = await fetch('/api/invoices/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invoiceId,
              paymentId: code,
              clientName: String(fullName || '').trim() || undefined,
              clientEmail: String(payEmail || '').trim() || undefined,
            }),
          })
          const json = await res.json().catch(() => ({}))
          setPaying(false)
          if (!res.ok) {
            if (json.error === 'SP_KEYS_MISSING') {
              setPayError('Payment processing is being set up — please try again in a few minutes.')
            } else if (json.error === 'SPACEREMIT_VERIFY_FAILED' || json.error === 'SP_VERIFY_FAILED') {
              setPayError('We could not verify that payment. Please double-check it and try again.')
            } else {
              setPayError(String(json.error || json.detail || 'Payment verification failed — please try again.'))
            }
            return
          }
          setPaySuccess(true)
        }}
        onMessage={(msg: string) => setPayError(msg)}
      />

      {payError && (
        <div className="mt-4 rounded-xl border border-[rgba(229,115,115,0.40)] bg-[rgba(229,115,115,0.10)] px-4 py-3 text-sm text-[#e57373]">
          {payError}
        </div>
      )}

      {paying && (
        <div className="mt-4 text-center text-xs text-[#8f9f9a]">Verifying your payment…</div>
      )}
    </div>
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
