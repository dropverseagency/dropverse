'use client'

import { formatUsd } from '../../lib/payoutConfig'

export type ReceiptRow = {
  id: string
  requestedAt: string
  amount: number
  currency?: string
  dropverseFee: number
  providerFee?: number | null
  estimatedNet: number
  method: string | null
  status: string
  paidAt: string | null
  transferReference: string | null
  failureReason: string | null
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: 'Pending',
    approved: 'Processing',
    paid: 'Paid',
    cancelled: 'Cancelled',
    failed: 'Failed',
  }
  return map[s] || s
}

function statusTone(s: string) {
  if (s === 'paid') return { text: 'text-[#8fd6a8]', stamp: 'border-[#8fd6a8]/50 bg-[#8fd6a8]/10' }
  if (s === 'pending' || s === 'approved') return { text: 'text-[#e4c979]', stamp: 'border-[#e4c979]/45 bg-[#e4c979]/10' }
  if (s === 'cancelled' || s === 'failed') return { text: 'text-[#e89a8d]', stamp: 'border-[#e89a8d]/45 bg-[#e89a8d]/10' }
  return { text: 'text-[#9aa8a3]', stamp: 'border-white/15 bg-white/5' }
}

/**
 * Receipt-style transaction card — perforated top edge, mono amounts,
 * dashed divider lines, soft glass body matching DropVerse palette.
 */
export function ReceiptCard({ row }: { row: ReceiptRow }) {
  const tone = statusTone(row.status)
  const date = new Date(row.requestedAt)
  const paid = row.paidAt ? new Date(row.paidAt) : null

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-[rgba(10,41,38,0.85)] shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
      {/* Perforated ticket edge */}
      <div
        className="h-3 w-full bg-[repeating-linear-gradient(90deg,#0a2926_0_10px,transparent_10px_14px)] opacity-90"
        aria-hidden
      />

      <div className="px-4 pb-4 pt-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7f918c]">DropVerse · Payout</p>
            <p className="mt-1 font-display text-xl font-extrabold text-[#f0f4f2]">{formatUsd(row.amount)}</p>
            <p className="mt-0.5 text-xs text-[#81948e]">
              {date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
              {' · '}
              {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span className={`rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${tone.stamp} ${tone.text}`}>
            {statusLabel(row.status)}
          </span>
        </div>

        <div className="my-3 border-t border-dashed border-white/15" />

        <dl className="space-y-1.5 font-mono text-[11px] text-[#c1cbc7]">
          <div className="flex justify-between gap-3">
            <dt className="text-[#7f918c]">Method</dt>
            <dd className="text-right capitalize text-[#e8edea]">{row.method || '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#7f918c]">DropVerse fee</dt>
            <dd className="text-right">{formatUsd(row.dropverseFee)}</dd>
          </div>
          {row.providerFee != null && row.providerFee > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-[#7f918c]">Provider fee</dt>
              <dd className="text-right">{formatUsd(row.providerFee)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 font-semibold text-[#f0f4f2]">
            <dt>Est. net</dt>
            <dd className="text-right">{formatUsd(row.estimatedNet)}</dd>
          </div>
          {paid && (
            <div className="flex justify-between gap-3">
              <dt className="text-[#7f918c]">Paid at</dt>
              <dd className="text-right">{paid.toLocaleString()}</dd>
            </div>
          )}
          {row.transferReference && (
            <div className="flex justify-between gap-3">
              <dt className="text-[#7f918c]">Ref</dt>
              <dd className="max-w-[12rem] truncate text-right text-[#e4c979]" title={row.transferReference}>
                {row.transferReference}
              </dd>
            </div>
          )}
          {row.failureReason && (
            <div className="mt-1 rounded-lg border border-red-400/20 bg-red-400/5 px-2 py-1.5 text-[10px] text-red-200">
              {row.failureReason}
            </div>
          )}
        </dl>

        <div className="mt-3 flex items-center justify-between border-t border-dashed border-white/10 pt-2">
          <span className="font-mono text-[9px] tracking-widest text-[#5a6e68]">#{row.id.slice(0, 8).toUpperCase()}</span>
          <span className="font-mono text-[9px] text-[#5a6e68]">THANK YOU</span>
        </div>
      </div>
    </article>
  )
}
