'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PayPalCheckoutModal from './PayPalCheckoutModal'

/**
 * Sample CTA. If amount is provided, opens PayPal checkout modal.
 * Otherwise links to contact / pitch flow.
 */
export default function DodoSampleCheckout({
  sampleTitle = 'Work sample',
  amount,
}: {
  sampleTitle?: string
  amount?: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (amount && amount > 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
          className="inline-flex items-center justify-center rounded-full border border-[rgba(226,182,86,0.35)] bg-[rgba(226,182,86,0.08)] px-4 py-2.5 text-sm font-bold text-[#e2b656] transition hover:bg-[rgba(226,182,86,0.14)]"
        >
          Buy sample kit — ${amount}
        </button>
        {error ? <p className="mt-2 text-xs text-[#e89a8d]">{error}</p> : null}
        <PayPalCheckoutModal
          open={open}
          onClose={() => setOpen(false)}
          title={`Buy — ${sampleTitle}`}
          planName={sampleTitle}
          amount={amount}
          description={`DropVerse sample: ${sampleTitle}`}
          onSuccess={(details) => {
            setOpen(false)
            router.push(`/payment/success?transaction_id=${encodeURIComponent(details.orderId)}&provider=paypal`)
          }}
          onError={(message) => setError(message)}
        />
      </>
    )
  }

  return (
    <a
      href="mailto:dropverseagency@gmail.com?subject=Pitch%20this%20sample"
      className="inline-flex items-center justify-center rounded-full border border-[rgba(226,182,86,0.35)] bg-[rgba(226,182,86,0.08)] px-4 py-2.5 text-sm font-bold text-[#e2b656] transition hover:bg-[rgba(226,182,86,0.14)]"
    >
      Pitch this sample
    </a>
  )
}
