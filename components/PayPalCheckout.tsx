'use client'

import { useMemo, useState } from 'react'
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
}: PayPalCheckoutProps) {
  const [busy, setBusy] = useState(false)
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
            disabled={disabled || busy}
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
