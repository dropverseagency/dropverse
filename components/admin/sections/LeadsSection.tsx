'use client'

import { useEffect, useState } from 'react'

type Pack = {
  id: string
  seller_id: string
  title: string
  description: string
  niche: string
  countries: string[]
  price_usd: number
  max_buyers: number
  admin_max_buyers: number | null
  sold_count: number
  status: string
  source_attestation: string
  resale_rights_ack: boolean
  file_bytes: number | null
  file_content_type: string | null
  preview_meta: Record<string, unknown>
  reject_reason: string | null
  created_at: string
}

export default function LeadsSection() {
  const [status, setStatus] = useState('pending_review')
  const [items, setItems] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})
  const [adminMax, setAdminMax] = useState<Record<string, string>>({})

  async function load(nextStatus = status) {
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/admin/leads?status=${encodeURIComponent(nextStatus)}&limit=50`)
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(json.error || 'LOAD_FAILED')
      setItems([])
      return
    }
    setItems(json.items || [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function moderate(id: string, action: 'approve' | 'reject' | 'suspend') {
    setBusyId(id)
    setError(null)
    const body: Record<string, unknown> = { action }
    if (action === 'reject') {
      const reason = (rejectReason[id] || '').trim()
      if (!reason) {
        setError('Reject reason required')
        setBusyId(null)
        return
      }
      body.rejectReason = reason
    }
    if (action === 'approve') {
      const raw = (adminMax[id] || '').trim()
      if (raw) body.adminMaxBuyers = parseInt(raw, 10)
    }
    const res = await fetch(`/api/admin/leads/${id}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok) {
      setError(json.error || 'MODERATE_FAILED')
      return
    }
    await load()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {['pending_review', 'approved', 'rejected', 'suspended', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === s
                ? 'bg-[#d8b45a] text-[#10221f]'
                : 'border border-white/10 text-[#8fa29c] hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-[#8fa29c]">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#0b2a26] px-4 py-8 text-center text-sm text-[#8fa29c]">
          No packs in this filter.
        </p>
      ) : null}

      <ul className="space-y-4">
        {items.map((p) => (
          <li key={p.id} className="rounded-3xl border border-white/10 bg-[#0b2a26] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                <p className="mt-1 text-xs text-[#8fa29c]">
                  {p.status} · ${Number(p.price_usd).toFixed(2)} · max {p.max_buyers} buyers · sold{' '}
                  {p.sold_count}
                  {p.niche ? ` · ${p.niche}` : ''}
                </p>
                <p className="mt-2 text-sm text-[#c5d0cb]">{p.description || '—'}</p>
              </div>
              <span className="rounded-full bg-[#d8b45a]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#e4c979]">
                {p.status}
              </span>
            </div>

            <div className="mt-4 grid gap-3 text-xs text-[#8fa29c] sm:grid-cols-2">
              <div>
                <p className="font-semibold text-[#aebcb7]">Source attestation</p>
                <p className="mt-1 whitespace-pre-wrap">{p.source_attestation || '—'}</p>
                <p className="mt-2">Resale rights ack: {p.resale_rights_ack ? 'yes' : 'no'}</p>
              </div>
              <div>
                <p className="font-semibold text-[#aebcb7]">File meta</p>
                <p className="mt-1">
                  {p.file_content_type || '—'} · {p.file_bytes != null ? `${Math.round(p.file_bytes / 1024)} KB` : '—'}
                </p>
                <pre className="mt-2 max-h-24 overflow-auto rounded-xl bg-[#071f1d] p-2 text-[10px]">
                  {JSON.stringify(p.preview_meta || {}, null, 2)}
                </pre>
              </div>
            </div>

            {p.status === 'pending_review' || p.status === 'suspended' || p.status === 'rejected' ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-[#8fa29c]">
                    Admin max buyers (optional, ≤ seller max)
                    <input
                      type="number"
                      min={1}
                      className="mt-1 block w-40 rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2 text-sm text-white"
                      value={adminMax[p.id] ?? ''}
                      onChange={(e) => setAdminMax((m) => ({ ...m, [p.id]: e.target.value }))}
                      placeholder={String(p.max_buyers)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => moderate(p.id, 'approve')}
                    className="rounded-full bg-[#6fbf73] px-4 py-2 text-xs font-bold text-[#06221e] disabled:opacity-40"
                  >
                    Approve
                  </button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    className="min-w-[12rem] flex-1 rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2 text-sm"
                    placeholder="Reject reason"
                    value={rejectReason[p.id] ?? ''}
                    onChange={(e) => setRejectReason((m) => ({ ...m, [p.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => moderate(p.id, 'reject')}
                    className="rounded-full border border-red-400/40 px-4 py-2 text-xs font-bold text-red-200 disabled:opacity-40"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => moderate(p.id, 'suspend')}
                    className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-[#c5d0cb] disabled:opacity-40"
                  >
                    Suspend
                  </button>
                </div>
              </div>
            ) : null}

            {p.reject_reason ? (
              <p className="mt-3 text-xs text-red-300">Reject reason: {p.reject_reason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
