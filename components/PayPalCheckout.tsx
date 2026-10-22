'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'

export type PayPalCheckoutProps = {
  planName: string
  amount: number
  currency?: string
  description?: string
  onSuccess?: (details: {
    orderId: string
    status?: string
    payerEmail?: string
  }) => void
  onError?: (message: string) => void
  disabled?: boolean
  itemType?: 'subscription' | 'project' | 'invoice' | 'digital_service'
  itemId?: string
}

/**
 * Reusable PayPal Buttons checkout.
 * Uses NEXT_PUBLIC_PAYPAL_CLIENT_ID (Sandbox or Live). Falls back to "test"
 * so the UI still mounts in development when the env var is unset.
 */
export default function PayPalCheckout({
  planName,
  amount,
  currency = 'USD',
  description,
  onSuccess,
  onError,
  disabled = false,
  itemType = 'subscription',
  itemId,
}: PayPalCheckoutProps) {
  const [busy, setBusy] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [termsError, setTermsError] = useState<string | null>(null)
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'test'
  const value = useMemo(() => {
    const n = Number(amount)
    if (!Number.isFinite(n) || n <= 0) return null
    return n.toFixed(2)
  }, [amount])

  if (!value) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#9aa8a3]">
        This item has no payable amount configured.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-[#061916]/60 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#e2b656]">Pay with PayPal</p>
        <p className="mt-1 text-sm font-semibold text-white">{planName}</p>
        <p className="mt-0.5 text-xs text-[#9aa8a3]">
          {description || `${planName} — $${value} ${currency}`}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#061916]/40 p-3 text-xs leading-5 text-[#c5d2cc]">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => { setTermsAccepted(event.target.checked); setTermsError(null) }}
          className="mt-1 h-4 w-4 shrink-0 accent-[#d8b45a]"
        />
        <span>
          I have read and agree to the <Link href="/terms" target="_blank" className="font-semibold text-[#e4c979] underline underline-offset-2">Terms of Service</Link> and <Link href="/refund" target="_blank" className="font-semibold text-[#e4c979] underline underline-offset-2">Refund Policy</Link>. I understand the digital product/service, delivery conditions, renewal terms (if applicable), and dispute process.
        </span>
      </label>
      {termsError && <p role="alert" className="text-xs text-red-300">{termsError}</p>}

      {clientId === 'test' && (
        <p className="text-[11px] leading-4 text-[#849792]">
          Sandbox mode: set <code className="text-[#e4c979]">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> in Vercel for live or real sandbox buttons.
        </p>
      )}

      <PayPalScriptProvider
        options={{
          clientId,
          currency,
          intent: 'capture',
          components: 'buttons',
        }}
      >
        <div className={disabled || busy ? 'pointer-events-none opacity-60' : undefined}>
          <PayPalButtons
            style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' }}
            disabled={disabled || busy || !termsAccepted}
            onClick={async (_data, actions) => {
              if (!termsAccepted) {
                setTermsError('Please accept the Terms of Service and Refund Policy before paying.')
                return actions.reject()
              }
              try {
                const response = await fetch('/api/legal/acceptance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    accepted: true,
                    termsVersion: '2026-10-23',
                    itemType,
                    itemId,
                    itemName: planName,
                  }),
                })
                const result = await response.json().catch(() => ({}))
                if (!response.ok) {
                  setTermsError(result.error === 'NOT_AUTHENTICATED'
                    ? 'Please sign in again before paying.'
                    : 'We could not record your agreement. Please try again.')
                  return actions.reject()
                }
                setTermsError(null)
                return actions.resolve()
              } catch {
                setTermsError('We could not record your agreement. Please check your connection and try again.')
                return actions.reject()
              }
            }}
            createOrder={(_data, actions) =>
              actions.order.create({
                intent: 'CAPTURE',
                purchase_units: [
                  {
                    description: description || planName,
                    amount: {
                      currency_code: currency,
                      value,
                    },
                    custom_id: `dv:${planName}:${value}`,
                  },
                ],
              })
            }
            onApprove={async (data, actions) => {
              if (!actions.order) {
                onError?.('PayPal order actions unavailable.')
                return
              }
              setBusy(true)
              try {
                const details = await actions.order.capture()
                const orderId = details.id || data.orderID
                onSuccess?.({
                  orderId,
                  status: details.status,
                  payerEmail: details.payer?.email_address,
                })
              } catch (err) {
                const message = err instanceof Error ? err.message : 'PayPal capture failed.'
                onError?.(message)
              } finally {
                setBusy(false)
              }
            }}
            onError={(err) => {
              const message = err instanceof Error ? err.message : 'PayPal checkout error.'
              onError?.(message)
            }}
            onCancel={() => {
              onError?.('Payment cancelled.')
            }}
          />
        </div>
      </PayPalScriptProvider>
    </div>
  )
}
