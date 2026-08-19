'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Embedded SpaceRemit payment form (official client-side JS integration).
 * Loads https://spaceremit.com/api/v2/js_script/spaceremit.js and lets the
 * library render 70+ local payment methods into this component.
 *
 * The official integration flow is: buyer picks a payment method in the
 * rendered methods list, then SUBMITS the form. The library appends the
 * transaction code and calls SP_SUCCESSFUL_PAYMENT on success.
 *
 * Note: the card box is disabled on this SpaceRemit account
 * ("This payments way is disabled"), so only local methods are shown.
 */
interface SpaceRemitPayFormProps {
  amount: number
  currency?: string
  /** Fallback buyer name; pre-filled invisibly (kept editable via nameEditable). */
  fullName: string
  email: string
  phone: string
  publicKey: string
  onPaid: (transactionCode: string) => void
  onMessage?: (message: string) => void
  disabled?: boolean
  /** When true, hide the buyer-info inputs entirely (defaults are used for
   *  the SpaceRemit hidden fields). */
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

let spScriptPromise: Promise<void> | null = null

function loadSpScript(): Promise<void> {
  // The library bootstraps itself once the globals exist; we only need it loaded.
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

const FORM_ID = 'dv-spaceremit-form'

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
  const [ready, setReady] = useState(false)
  const [iframeReady, setIframeReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)
  const onPaidRef = useRef(onPaid)
  onPaidRef.current = onPaid
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    let cancelled = false
    window.SP_PUBLIC_KEY = publicKey
    window.SP_FORM_ID = `#${FORM_ID}`
    window.SP_SELECT_RADIO_NAME = 'sp-pay-type-radio'
    window.LOCAL_METHODS_BOX_STATUS = true
    window.LOCAL_METHODS_PARENT_ID = '#dv-sp-local-methods-pay'
    window.CARD_BOX_STATUS = false
    window.CARD_BOX_PARENT_ID = '#dv-sp-card-pay'
    // Do not auto-submit: the buyer must confirm the payment themselves.
    window.SP_FORM_AUTO_SUBMIT_WHEN_GET_CODE = false
    window.SP_SUCCESSFUL_PAYMENT = (code: string) => {
      onPaidRef.current(code)
    }
    window.SP_FAILD_PAYMENT = () => {
      setError('Payment failed or was cancelled. Please try again.')
    }
    window.SP_RECIVED_MESSAGE = (message: string) => {
      if (message && message.length > 0) {
        const msg = message.trim()
        // Informational library status (e.g. "Choose one of the methods.") is
        // shown as neutral guidance; real failures include error keywords.
        const isError = /error|fail|invalid|denied|refused|exception|unsuccessful/i.test(msg)
        if (isError) {
          setError(msg)
          setInfo(null)
        } else {
          setInfo(msg)
          setError(null)
        }
        if (onMessageRef.current) onMessageRef.current(message)
      }
    }
    window.SP_NEED_AUTH = (targetAuthLink: string) => {
      setError('Authentication is required to complete this payment.')
      if (targetAuthLink && typeof window !== 'undefined') window.open(targetAuthLink, '_blank')
    }

    loadSpScript()
      .then(() => {
        if (cancelled) return
        setReady(true)
        // The iframe is cross-origin, so we can't observe its content paint.
        // Hide the loading overlay after the iframe's own load event fires
        // (its JS app starts rendering) plus a buffer, or a fixed timeout.
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
        // Clean up timers on unmount.
        return () => { clearTimeout(t1); clearTimeout(t2) }
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load the payment methods. Please refresh the page.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Official integration: selecting a method alone does nothing — the buyer
   *  must submit the form so the library can attach the transaction code. */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || disabled || !ready) return
    setSubmitting(true)
    setError(null)
    const form = formRef.current
    if (!form) {
      setSubmitting(false)
      setError('Could not open the payment form. Please refresh the page.')
      return
    }
    form.requestSubmit()
  }

  const showInputs = !hideBuyerInputs

  return (
    <div className="relative w-full">
      <form ref={formRef} id={FORM_ID} className="relative">
        <input type="hidden" name="amount" value={Math.max(0, Math.round(amount * 100) / 100)} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="fullname" value={fullName} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="phone" value={phone} />
        {/* The `notes` field MUST stay empty: a non-empty notes value makes the
            SpaceRemit iframe render its marketing landing page instead of the
            payment methods. */}
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
          {iframeReady && (
            <div className="mt-1 flex items-start gap-2 rounded-xl border border-[#d8b45a]/30 bg-[#d8b45a]/10 px-4 py-3">
              <span className="mt-0.5 text-xs leading-5 text-[#d8b45a]">1.</span>
              <p className="text-xs leading-5 text-[#b8c4bf]">Choose your payment method in the list above (wallet, bank transfer, or card). <span className="font-bold text-[#e8dcb8]">2.</span> Press <span className="font-bold text-[#e8dcb8]">Pay Now</span> — SpaceRemit&apos;s secure checkout will open below the button to complete your payment.</p>
            </div>
          )}
          <button
            type="button"
            disabled={submitting || disabled}
            onClick={handleSubmit}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-4 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Processing...' : submitLabel}
          </button>
          <style>{`
            #${FORM_ID} .sp-one-type-select { margin: 0 0 12px 0; }
            #${FORM_ID} { ${disabled ? 'pointer-events:none; opacity:.4' : ''} }
            #sp_local_nethods_iframe { height: 760px !important; border-radius: 12px; }
            #${FORM_ID} .sp_local_nethods_iframe { height: 760px !important; }
          `}</style>
        </>
      )}
    </div>
  )
}
