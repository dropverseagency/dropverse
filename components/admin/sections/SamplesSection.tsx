'use client'

import { useEffect, useState } from 'react'

type Sample = {
  id: string
  owner_id: string
  title: string
  category: string
  description: string
  status: string
  price_usd: number | null
  commission_rate: number | null
  turnaround_days: number
  rejection_reason: string | null
  cover_url: string | null
  freelancer: string
  sample_costs?: { cost_usd: number }[]
  sample_files?: { id: string; kind: string; mime: string; size_bytes: number; signed_url?: string | null }[]
}

export default function SamplesSection() {
  const [status, setStatus] = useState('pending_review')
  const [items, setItems] = useState<Sample[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [reason, setReason] = useState<Record<string, string>>({})
  const [price, setPrice] = useState<Record<string, string>>({})
  const [commission, setCommission] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const response = await fetch(`/api/admin/samples?status=${encodeURIComponent(status)}`)
    const json = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      setError(json.error || 'Could not load samples.')
      setItems([])
      return
    }
    setError('')
    setItems(json.items || [])
  }

  useEffect(() => { load() }, [status])

  async function moderate(sample: Sample, action: 'approve' | 'reject' | 'unpublish') {
    setBusyId(sample.id)
    setError('')
    const body: Record<string, unknown> = { action }
    if (action === 'reject') body.rejectionReason = (reason[sample.id] || '').trim()
    if (action === 'approve') {
      body.priceUsd = (price[sample.id] ?? (sample.price_usd == null ? '' : String(sample.price_usd))).trim()
      body.commissionRate = (commission[sample.id] ?? (sample.commission_rate == null ? '' : String(sample.commission_rate))).trim()
    }
    const response = await fetch(`/api/admin/samples/${sample.id}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await response.json().catch(() => ({}))
    setBusyId('')
    if (!response.ok) {
      const messages: Record<string, string> = {
        PRICE_REQUIRED_BEFORE_APPROVAL: 'Set a client price before approving this sample.',
        COMMISSION_REQUIRED_BEFORE_APPROVAL: 'Set the DropVerse commission before publishing this sample.',
        INVALID_COMMISSION_RATE: 'Commission must be between 0% and 100%.',
        INVALID_PRICE: 'Enter a valid client price greater than $0.',
      }
      setError(messages[json.error] || json.error || 'Review action failed.')
      return
    }
    await load()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {['pending_review', 'approved', 'rejected', 'unpublished', 'all'].map((item) => (
          <button key={item} onClick={() => setStatus(item)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === item ? 'bg-[#d8b45a] text-[#10221f]' : 'border border-white/10 text-[#8fa29c] hover:text-white'}`}>{item.replace('_', ' ')}</button>
        ))}
      </div>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-[#8fa29c]">Loading samples…</p> : null}
      {!loading && !items.length ? <p className="rounded-2xl border border-white/10 bg-[#0b2a26] px-4 py-8 text-center text-sm text-[#8fa29c]">No samples in this filter.</p> : null}

      <ul className="space-y-4">
        {items.map((sample) => {
          const currentPrice = Number(price[sample.id] ?? (sample.price_usd == null ? '' : String(sample.price_usd)))
          const currentCommission = Number(commission[sample.id] ?? (sample.commission_rate == null ? '' : String(sample.commission_rate)))
          const canPreviewSplit = Number.isFinite(currentPrice) && currentPrice > 0 && Number.isFinite(currentCommission) && currentCommission >= 0 && currentCommission <= 100
          return (
            <li key={sample.id} className="rounded-3xl border border-white/10 bg-[#0b2a26] p-5">
              <div className="flex flex-wrap gap-4">
                {sample.cover_url ? <img src={sample.cover_url} alt="" className="h-28 w-40 rounded-xl object-cover" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h3 className="text-lg font-semibold text-white">{sample.title}</h3><p className="mt-1 text-xs text-[#8fa29c]">{sample.category} · by {sample.freelancer} · {sample.turnaround_days} day turnaround</p></div>
                    <span className="rounded-full bg-[#d8b45a]/15 px-3 py-1 text-[11px] font-bold uppercase text-[#e4c979]">{sample.status}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#c5d0cb]">{sample.description || 'No description supplied.'}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#8fa29c]">
                    <span>Freelancer delivery cost: ${Number(sample.sample_costs?.[0]?.cost_usd || 0).toFixed(2)}</span>
                    <span>Client price: {sample.price_usd == null ? 'not set' : `$${Number(sample.price_usd).toFixed(2)}`}</span>
                    <span>DropVerse commission: {sample.commission_rate == null ? 'not set' : `${Number(sample.commission_rate).toFixed(2)}%`}</span>
                    <span>{sample.sample_files?.length || 0} file(s)</span>
                  </div>
                  {sample.sample_files?.length ? <div className="mt-3 flex flex-wrap gap-2">{sample.sample_files.map((file) => file.signed_url ? <a key={file.id} href={file.signed_url} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#e4c979] hover:bg-white/5">Preview {file.kind} · {Math.max(1, Math.round(file.size_bytes / 1024))} KB ↗</a> : null)}</div> : null}
                </div>
              </div>

              {sample.status === 'pending_review' || sample.status === 'rejected' || sample.status === 'unpublished' || sample.status === 'approved' ? (
                <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-3">
                    <label className="block text-xs text-[#a9bbb5]">Client price (USD, required for publishing)
                      <input type="number" min="0.01" max="1000000" step="0.01" value={price[sample.id] ?? (sample.price_usd == null ? '' : String(sample.price_usd))} onChange={(e) => setPrice((v) => ({ ...v, [sample.id]: e.target.value }))} className="mt-1 block w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2 text-sm text-white" placeholder="e.g. 49.00" />
                    </label>
                    <label className="block text-xs text-[#a9bbb5]">DropVerse commission (% of client price, required for publishing)
                      <input type="number" min="0" max="100" step="0.01" value={commission[sample.id] ?? (sample.commission_rate == null ? '' : String(sample.commission_rate))} onChange={(e) => setCommission((v) => ({ ...v, [sample.id]: e.target.value }))} className="mt-1 block w-full rounded-xl border border-[#d8b45a]/40 bg-[#071f1d] px-3 py-2 text-sm text-white" placeholder="e.g. 20" />
                    </label>
                    {canPreviewSplit ? <p className="rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2 text-xs text-[#c5d0cb]">At this price: DropVerse commission <strong className="text-[#e4c979]">${(Math.round(currentPrice * currentCommission) / 100).toFixed(2)}</strong> · Remaining for freelancer <strong className="text-white">${(Math.round(currentPrice * 100 - Math.round(currentPrice * currentCommission)) / 100).toFixed(2)}</strong></p> : null}
                    <label className="block text-xs text-[#a9bbb5]">Rejection reason (required when rejecting)
                      <input value={reason[sample.id] || ''} onChange={(e) => setReason((v) => ({ ...v, [sample.id]: e.target.value }))} className="mt-1 block w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2 text-sm text-white" placeholder="Explain what needs to change" />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 sm:flex-col">
                    <button disabled={busyId === sample.id} onClick={() => moderate(sample, 'approve')} className="rounded-full bg-[#6fbf73] px-4 py-2 text-xs font-bold text-[#06221e] disabled:opacity-40">Approve & publish</button>
                    <button disabled={busyId === sample.id} onClick={() => moderate(sample, 'reject')} className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-bold text-red-200 disabled:opacity-40">Reject</button>
                    {sample.status === 'approved' ? <button disabled={busyId === sample.id} onClick={() => moderate(sample, 'unpublish')} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-[#c5d0cb] disabled:opacity-40">Unpublish</button> : null}
                  </div>
                </div>
              ) : null}
              {sample.rejection_reason ? <p className="mt-3 text-xs text-red-300">Review note: {sample.rejection_reason}</p> : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
