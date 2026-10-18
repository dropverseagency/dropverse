'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Embedded SpaceRemit payment form (official client-side JS integration).
 * Keeps the entire flow on the same page via in-page iframes — never opens a new tab.
 *
 * SpaceRemit local-method accounts commonly enforce a ~$300 max per payment.
 * Over that limit their iframe returns a near-blank white page with only
 * "Maximum Amount is 300$" — we block that path client-side and show a clear error.
 */
interface SpaceRemitPayFormProps {
  amount: number
  currency?: string
  fullName: string
  email: string
  phone: string
  publicKey: string
  onPaid: (transactionCode: string) => void
  onMessage?: (message: string) => void
  disabled?: boolean
  hideBuyerInputs?: boolean
  submitLabel?: string
}

declare global {
  interface Window {
    SP_PUBLIC_KEY?: string
    SP_FORM_ID?: string
    SP_SELECT_RADIO_NAME?: string
    LOCAL_METHODS_BOX_STATUS?: boolean
    LOCAL_METHODS_PARENT_ID?: string
    CARD_BOX_STATUS?: boolean
    CARD_BOX_PARENT_ID?: string
    SP_FORM_AUTO_SUBMIT_WHEN_GET_CODE?: boolean
    SP_SUCCESSFUL_PAYMENT?: (code: string) => void
    SP_FAILD_PAYMENT?: () => void
    SP_RECIVED_MESSAGE?: (message: string) => void
    SP_NEED_AUTH?: (targetAuthLink: string) => void
  }
}

/** Hard cap observed on SpaceRemit local methods (merchant account limit). */
export const SPACEREMIT_MAX_USD = 300

let spScriptPromise: Promise<void> | null = null

function loadSpScript(): Promise<void> {
  if (document.querySelector('script[src*="spaceremit.js"]')) {
    return Promise.resolve()
  }
  if (spScriptPromise) return spScriptPromise
  spScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://spaceremit.com/api/v2/js_script/spaceremit.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load SpaceRemit payment library'))
    document.head.appendChild(script)
  })
  return spScriptPromise
}

function normalizeAmount(amount: number): number {
  return Math.max(0, Math.round(Number(amount || 0) * 100) / 100)
}

function isAmountOverLimit(amount: number): boolean {
  return normalizeAmount(amount) > SPACEREMIT_MAX_USD
}

function amountLimitMessage(amount: number): string {
  const a = normalizeAmount(amount)
  return `SpaceRemit local payments are limited to $${SPACEREMIT_MAX_USD} per transaction. This order is $${a.toFixed(2)} — lower the amount to $${SPACEREMIT_MAX_USD} or less, or split the payment.`
}

function isSpLimitMessage(msg: string): boolean {
  return /maxim(?:um|un)\s*amount|max(?:imum)?\s*(?:amount|limit)|300\s*\$?/i.test(msg)
}

const FORM_ID = 'dv-spaceremit-form'
const CHECKOUT_FRAME = 'dv-sp-checkout-frame'

export default function SpaceRemitPayForm({
  amount,
  currency = 'USD',
  fullName,
  email,
  phone,
  publicKey,
  onPaid,
  onMessage,
  disabled,
  hideBuyerInputs,
  submitLabel = 'Pay Now →',
}: SpaceRemitPayFormProps) {
  const safeAmount = normalizeAmount(amount)
  const overLimit = isAmountOverLimit(safeAmount)

  const [ready, setReady] = useState(false)
  const [iframeReady, setIframeReady] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    overLimit ? amountLimitMessage(safeAmount) : null,
  )
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [showCheckoutFrame, setShowCheckoutFrame] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const onPaidRef = useRef(onPaid)
  onPaidRef.current = onPaid
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    if (overLimit) {
      setError(amountLimitMessage(safeAmount))
      setReady(false)
      setIframeReady(false)
      setShowCheckoutFrame(false)
      return
    }

    let cancelled = false
    window.SP_PUBLIC_KEY = publicKey
    window.SP_FORM_ID = `#${FORM_ID}`
    window.SP_SELECT_RADIO_NAME = 'sp-pay-type-radio'
    window.LOCAL_METHODS_BOX_STATUS = true
    window.LOCAL_METHODS_PARENT_ID = '#dv-sp-local-methods-pay'
    window.CARD_BOX_STATUS = false
    window.CARD_BOX_PARENT_ID = '#dv-sp-card-pay'
    window.SP_FORM_AUTO_SUBMIT_WHEN_GET_CODE = false

    window.SP_SUCCESSFUL_PAYMENT = (code: string) => {
      setAuthUrl(null)
      setShowCheckoutFrame(false)
      setSubmitting(false)
      onPaidRef.current(code)
    }
    window.SP_FAILD_PAYMENT = () => {
      setSubmitting(false)
      setError('Payment failed or was cancelled. Please try again.')
    }
    window.SP_RECIVED_MESSAGE = (message: string) => {
      if (message && message.length > 0) {
        const msg = message.trim()
        const isError =
          isSpLimitMessage(msg) ||
          /error|fail|invalid|denied|refused|exception|unsuccessful/i.test(msg)
        if (isError) {
          setError(
            isSpLimitMessage(msg)
              ? amountLimitMessage(safeAmount)
              : msg,
          )
          setInfo(null)
          setShowCheckoutFrame(false)
          setSubmitting(false)
        } else {
          setInfo(msg)
          setError(null)
        }
        if (onMessageRef.current) onMessageRef.current(message)
      }
    }
    // Keep auth/checkout on this page — never open a new browser tab.
    window.SP_NEED_AUTH = (targetAuthLink: string) => {
      if (!targetAuthLink) {
        setError('Authentication is required to complete this payment.')
        return
      }
      setError(null)
      setInfo('Complete the steps in the secure panel below — you stay on this page.')
      setShowCheckoutFrame(true)
      setAuthUrl(targetAuthLink)
      requestAnimationFrame(() => {
        document.getElementById('dv-sp-inline-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }

    loadSpScript()
      .then(() => {
        if (cancelled) return
        setReady(true)
        let cleared = false
        const clearOverlay = () => {
          if (cleared) return
          cleared = true
          setIframeReady(true)
        }
        const t1 = setTimeout(clearOverlay, 12000)
        const t2 = setTimeout(clearOverlay, 18000)
        const ifr = document.getElementById('sp_local_nethods_iframe') as HTMLIFrameElement | null
        if (ifr) {
          ifr.addEventListener('load', () => {
            clearTimeout(t1)
            setTimeout(clearOverlay, 4000)
          })
        }
        return () => {
          clearTimeout(t1)
          clearTimeout(t2)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load the payment methods. Please refresh the page.')
      })

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.('a[target="_blank"]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      if (!href || href === '#') return
      if (!/spaceremit\.(com|net)/i.test(href) && !/pay|auth|checkout/i.test(href)) return
      event.preventDefault()
      event.stopPropagation()
      setShowCheckoutFrame(true)
      setAuthUrl(href)
      setInfo('Continue payment in the secure panel below.')
    }
    document.addEventListener('click', onClickCapture, true)

    return () => {
      cancelled = true
      document.removeEventListener('click', onClickCapture, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overLimit, publicKey, safeAmount])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (overLimit) {
      setError(amountLimitMessage(safeAmount))
      setShowCheckoutFrame(false)
      return
    }
    if (submitting || disabled || !ready) return
    setSubmitting(true)
    setError(null)
    setAuthUrl(null)
    const form = formRef.current
    if (!form) {
      setSubmitting(false)
      setError('Could not open the payment form. Please refresh the page.')
      return
    }
    form.setAttribute('target', CHECKOUT_FRAME)
    setShowCheckoutFrame(true)
    form.requestSubmit()
    requestAnimationFrame(() => {
      document.getElementById('dv-sp-inline-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const showInputs = !hideBuyerInputs

  // Over-limit: never mount the SpaceRemit script/iframe path — blank white page.
  if (overLimit) {
    return (
      <div className="w-full">
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-4 text-center">
          <p className="text-sm font-bold text-red-200">Amount exceeds SpaceRemit limit</p>
          <p className="mt-2 text-xs leading-5 text-red-100/90">{amountLimitMessage(safeAmount)}</p>
          <p className="mt-3 text-[11px] leading-5 text-[#8f9f9a]">
            SpaceRemit local methods (wallets / bank transfer) cap each payment at ${SPACEREMIT_MAX_USD}.
            Create the order at ${SPACEREMIT_MAX_USD} or less to continue.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <form ref={formRef} id={FORM_ID} className="relative" target={CHECKOUT_FRAME}>
        <input type="hidden" name="amount" value={safeAmount} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="fullname" value={fullName} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="phone" value={phone} />
        <div className="sp-one-type-select">
          <input type="radio" name="sp-pay-type-radio" value="local-methods-pay" id="dv_sp_local_radio" defaultChecked />
          <label htmlFor="dv_sp_local_radio">
            <div>Pay with a local method (wallet, bank transfer, card — 70+ options)</div>
          </label>
          <div id="dv-sp-local-methods-pay" />
        </div>
        <div id="dv-sp-card-pay" style={{ display: 'none' }} />
        {!iframeReady && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#0b2a26]">
            <svg className="h-8 w-8 animate-spin text-[#d8b45a]" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-[#8f9f9a]">Loading payment methods from SpaceRemit...</span>
          </div>
        )}
      </form>

      {showInputs && (
        <div className="mt-4 grid gap-3">
          <input value={fullName} disabled placeholder="Full name" className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3 text-sm text-[#8f9f9a] placeholder:text-[#5f726c] focus:outline-none" aria-label="Full name" />
          <input value={email} disabled type="email" placeholder="Email for receipt" className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3 text-sm text-[#8f9f9a] placeholder:text-[#5f726c] focus:outline-none" aria-label="Email for receipt" />
        </div>
      )}

      {!ready && !error && (
        <div className="mt-4 rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3 text-center text-xs text-[#8f9f9a]">
          Loading payment methods...
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-xs leading-5 text-red-200">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="mt-3 rounded-xl border border-[#d8b45a]/30 bg-[#d8b45a]/10 px-4 py-3 text-center text-xs leading-5 text-[#d8b45a]">
          {info}
        </div>
      )}

      {ready && !error && (
        <>
          {iframeReady && !showCheckoutFrame && (
            <div className="mt-1 flex items-start gap-2 rounded-xl border border-[#d8b45a]/30 bg-[#d8b45a]/10 px-4 py-3">
              <span className="mt-0.5 text-xs leading-5 text-[#d8b45a]">1.</span>
              <p className="text-xs leading-5 text-[#b8c4bf]">
                Choose your payment method above, then press <span className="font-bold text-[#e8dcb8]">Pay Now</span>.
                Checkout stays on this page — no new tab.
              </p>
            </div>
          )}
          <button
            type="button"
            disabled={submitting || disabled}
            onClick={handleSubmit}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-4 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Opening secure checkout…' : submitLabel}
          </button>
        </>
      )}

      <div id="dv-sp-inline-panel" className={`mt-4 ${showCheckoutFrame ? 'block' : 'hidden'}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#d8b45a]">Secure checkout · same page</p>
          {authUrl && (
            <button
              type="button"
              onClick={() => {
                setAuthUrl(null)
                setShowCheckoutFrame(false)
                setSubmitting(false)
              }}
              className="text-[11px] font-semibold text-[#8fa29c] hover:text-[#e4c979]"
            >
              Close panel
            </button>
          )}
        </div>
        {authUrl ? (
          <iframe
            title="SpaceRemit secure payment"
            src={authUrl}
            className="w-full rounded-2xl border border-white/10 bg-[#071f1d]"
            style={{ minHeight: 640, height: '70vh' }}
            allow="payment *; clipboard-write"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <iframe
            title="SpaceRemit checkout"
            name={CHECKOUT_FRAME}
            id={CHECKOUT_FRAME}
            className="w-full rounded-2xl border border-white/10 bg-[#071f1d]"
            style={{ minHeight: 520, height: '60vh' }}
            allow="payment *; clipboard-write"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>

      {!showCheckoutFrame && (
        <iframe title="SpaceRemit checkout target" name={CHECKOUT_FRAME} id={`${CHECKOUT_FRAME}-hidden`} className="hidden" />
      )}

      <style>{`
        #${FORM_ID} .sp-one-type-select { margin: 0 0 12px 0; }
        #${FORM_ID} { ${disabled ? 'pointer-events:none; opacity:.4' : ''} }
        #sp_local_nethods_iframe { height: 760px !important; border-radius: 12px; }
        #${FORM_ID} .sp_local_nethods_iframe { height: 760px !important; }
      `}</style>
    </div>
  )
}
