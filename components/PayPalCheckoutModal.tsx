'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import PayPalCheckout, { type PayPalCheckoutProps } from './PayPalCheckout'

type Props = PayPalCheckoutProps & {
  open: boolean
  onClose: () => void
  title?: string
}

export default function PayPalCheckoutModal({
  open,
  onClose,
  title = 'Complete payment',
  ...checkout
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close checkout"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0a2926] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e2b656]">Checkout</p>
            <h2 className="font-display mt-1 text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[#c1cbc7] transition hover:border-white/25 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <PayPalCheckout {...checkout} />
      </div>
    </div>
  )
}
