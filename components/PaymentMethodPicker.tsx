'use client'

export type PaymentRail = 'local'

export default function PaymentMethodPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: PaymentRail
  onChange: (rail: PaymentRail) => void
  disabled?: boolean
}) {
  return (
    <div className="grid gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('local')}
        className={`rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
          value === 'local'
            ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.14)]'
            : 'border-white/10 bg-white/[.03] hover:border-white/20'
        }`}
      >
        <div className="text-[11px] font-bold uppercase tracking-[.14em] text-[#d8b45a]">Local payment</div>
        <div className="mt-1 text-[11px] leading-4 text-[#82958f]">Wallets, bank transfer & local methods</div>
      </button>
      <p className="text-[11px] leading-4 text-[#687d76]">International card checkout is temporarily unavailable.</p>
    </div>
  )
}
