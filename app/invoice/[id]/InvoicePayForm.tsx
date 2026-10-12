'use client'
import { useMemo, useState } from 'react'
import SpaceRemitPayForm from '../../../components/SpaceRemitPayForm'
import { getPaddleClient, paddleClientTokenConfigured } from '../../../lib/paddle'

const SPACEREMIT_MAX_USD = 300

type PayRail = 'international' | 'local'

interface Props {
  invoiceId: string
  due: string
  amount: number
  preferredMethod?: PayRail | null
}

export default function InvoicePayForm({ invoiceId, due, amount, preferredMethod = null }: Props) {
  const [rail, setRail] = useState<PayRail>(
    preferredMethod === 'local' ? 'local' : 'international',
  )
  const [paddleLoading, setPaddleLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [paySuccess, setPaySuccess] = useState(false)
  const [paying, setPaying] = useState(false)

  const localBlocked = amount > SPACEREMIT_MAX_USD
  const showChooser = !preferredMethod

  const localNote = useMemo(() => {
    if (localBlocked) {
      return `Local payment supports up to $${SPACEREMIT_MAX_USD} per transaction. This invoice is ${due} — please use International payment.`
    }
    return `Local payment maximum is $${SPACEREMIT_MAX_USD} per transaction.`
  }, [localBlocked, due])

  async function startInternational() {
    if (paddleLoading) return
    setPaddleLoading(true)
    setPayError(null)
    try {
      const response = await fetch('/api/paddle/invoice-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
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
        window.open(payload.checkoutUrl, 'dropverse_paddle_pay', 'noopener,noreferrer')
        setPaddleLoading(false)
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

  async function confirmSpaceRemit(code: string) {
    setPaying(true)
    setPayError(null)
    const res = await fetch('/api/invoices/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId, paymentId: code }),
    })
    const json = await res.json().catch(() => ({}))
    setPaying(false)
    if (!res.ok) {
      if (json.error === 'SP_KEYS_MISSING') {
        setPayError('Payment processing is being set up — please try again in a few minutes.')
      } else if (json.error === 'SPACEREMIT_VERIFY_FAILED' || json.error === 'SP_VERIFY_FAILED') {
        setPayError('We could not verify that payment. Please try again.')
      } else if (json.error === 'SP_AMOUNT_MISMATCH') {
        setPayError('The transaction amount does not match this invoice. Please contact the seller.')
      } else if (json.error === 'INVOICE_NOT_PAYABLE') {
        setPayError(`This invoice is already ${String(json.status || 'closed').toLowerCase()}.`)
      } else {
        setPayError(String(json.error || json.detail || 'Payment verification failed — please try again.'))
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
          <h2 className="font-display text-lg font-bold text-[#d9e0dc]">Pay this invoice</h2>
          <p className="text-xs text-[#687d76]">Secure payment · no account required</p>
        </div>
      </div>

      {showChooser && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRail('international')}
            className={`rounded-2xl border p-4 text-left transition ${
              rail === 'international'
                ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.12)]'
                : 'border-white/10 bg-[#071f1d] hover:border-[rgba(216,180,90,0.30)]'
            }`}
          >
            <div className={`text-sm font-bold ${rail === 'international' ? 'text-[#f0d98b]' : 'text-[#d9e0dc]'}`}>International payment</div>
            <p className="mt-1 text-[11px] leading-5 text-[#8f9f9a]">Cards and global methods. No per-transaction cap.</p>
          </button>
          <button
            type="button"
            onClick={() => !localBlocked && setRail('local')}
            disabled={localBlocked}
            className={`rounded-2xl border p-4 text-left transition ${
              rail === 'local'
                ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.12)]'
                : 'border-white/10 bg-[#071f1d] hover:border-[rgba(216,180,90,0.30)]'
            } ${localBlocked ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <div className={`text-sm font-bold ${rail === 'local' ? 'text-[#f0d98b]' : 'text-[#d9e0dc]'}`}>Local payment</div>
            <p className="mt-1 text-[11px] leading-5 text-[#8f9f9a]">Wallets, bank transfer, 70+ local methods. Max ${SPACEREMIT_MAX_USD} per payment.</p>
          </button>
        </div>
      )}

      {rail === 'local' && (
        <div className="mt-4 rounded-xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-3 text-xs leading-5 text-[#e4c979]">
          {localNote}
        </div>
      )}

      {payError && (
        <div className="mt-4 rounded-xl border border-[rgba(229,115,115,0.40)] bg-[rgba(229,115,115,0.10)] px-4 py-3 text-sm text-[#e57373]">
          {payError}
        </div>
      )}

      {rail === 'international' ? (
        <div className="mt-5">
          <p className="mb-3 text-[11px] leading-5 text-[#687d76]">
            Pay securely with cards and international methods. No account needed.
          </p>
          <button
            type="button"
            onClick={startInternational}
            disabled={paddleLoading}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {paddleLoading ? 'Opening secure checkout…' : `Pay ${due} — International`}
          </button>
        </div>
      ) : localBlocked ? null : (
        <div className="mt-5">
          <p className="mb-3 text-[11px] leading-5 text-[#687d76]">
            Choose a local method below, then press Pay Now. Maximum{' '}
            <span className="font-bold text-[#e4c979]">${SPACEREMIT_MAX_USD}</span> per payment.
          </p>
          <SpaceRemitPayForm
            amount={amount}
            fullName="Invoice client"
            email="client@invoice.local"
            phone="+0000000000"
            hideBuyerInputs
            submitLabel={`Pay ${due} →`}
            publicKey={process.env.NEXT_PUBLIC_SPACEREMIT_PUBLIC_KEY ?? ''}
            onPaid={confirmSpaceRemit}
            onMessage={(msg: string) => setPayError(msg)}
          />
          {paying && <div className="mt-4 text-center text-xs text-[#8f9f9a]">Verifying your payment…</div>}
        </div>
      )}
    </div>
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
