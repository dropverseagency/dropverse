'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Embedded SpaceRemit payment form (official client-side JS integration).
 * Loads https://spaceremit.com/api/v2/js_script/spaceremit.js and lets the
 * library render card + 70+ local payment methods into this component.
 * On successful payment it calls onPaid(transactionCode).
 */
interface SpaceRemitPayFormProps {
  amount: number
  currency?: string
  fullName: string
  email: string
  phone: string
  notes?: string
  publicKey: string
  onPaid: (transactionCode: string) => void
  onMessage?: (message: string) => void
  disabled?: boolean
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
  notes = '',
  publicKey,
  onPaid,
  onMessage,
  disabled,
}: SpaceRemitPayFormProps) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    window.CARD_BOX_STATUS = true
    window.CARD_BOX_PARENT_ID = '#dv-sp-card-pay'
    window.SP_FORM_AUTO_SUBMIT_WHEN_GET_CODE = false
    window.SP_SUCCESSFUL_PAYMENT = (code: string) => {
      onPaidRef.current(code)
    }
    window.SP_FAILD_PAYMENT = () => {
      setError('Payment failed or was cancelled. Please try again.')
    }
    window.SP_RECIVED_MESSAGE = (message: string) => {
      if (message && message.length > 0) {
        setError(message)
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
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load the payment methods. Please refresh the page.')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="w-full">
      <form id={FORM_ID}>
        <input type="hidden" name="amount" value={Math.max(0, Math.round(amount * 100) / 100)} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="fullname" value={fullName} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="notes" value={notes} />
        <div className="sp-one-type-select">
          <input type="radio" name="sp-pay-type-radio" value="local-methods-pay" id="dv_sp_local_radio" defaultChecked />
          <label htmlFor="dv_sp_local_radio">
            <div>Local payment methods</div>
          </label>
          <div id="dv-sp-local-methods-pay" />
        </div>
        <div className="sp-one-type-select">
          <input type="radio" name="sp-pay-type-radio" value="card-pay" id="dv_sp_card_radio" />
          <label htmlFor="dv_sp_card_radio">
            <div>Card payment</div>
          </label>
          <div id="dv-sp-card-pay" />
        </div>
      </form>

      {!ready && !error && (
        <div className="rounded-xl border border-white/10 bg-[#071f1d] px-4 py-3 text-center text-xs text-[#8f9f9a]">
          Loading payment methods...
        </div>
      )}
      {error && (
        <div className="mt-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-xs leading-5 text-red-200">
          {error}
        </div>
      )}
      {ready && !error && (
        <style>{`
          #${FORM_ID} .sp-one-type-select { margin: 0 0 12px 0; }
          #${FORM_ID} { ${disabled ? 'pointer-events:none; opacity:.4' : ''} }
        `}</style>
      )}
    </div>
  )
}
