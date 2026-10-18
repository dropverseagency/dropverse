'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Pack = {
  id: string
  title: string
  status: string
  price_usd: number
  max_buyers: number
  sold_count?: number
  reject_reason?: string | null
  created_at: string
}

export default function SellerLeadsPage() {
  const [items, setItems] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    niche: '',
    countries: '',
    price_usd: '',
    max_buyers: '10',
    source_attestation: '',
    resale_rights_ack: false,
  })
  const [file, setFile] = useState<File | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/leads/packs')
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (res.status === 401) {
      window.location.href = '/login?redirect=/dashboard/leads'
      return
    }
    if (!res.ok) {
      setError(json.error || 'Failed to load')
      return
    }
    setItems(json.items || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      setError('Choose a CSV or XLSX file')
      return
    }
    setSubmitting(true)
    setError(null)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, String(v)))
    fd.set('resale_rights_ack', form.resale_rights_ack ? 'true' : 'false')
    fd.set('file', file)
    const res = await fetch('/api/leads/packs', { method: 'POST', body: fd })
    const json = await res.json().catch(() => ({}))
    setSubmitting(false)
    if (!res.ok) {
      setError(json.error || 'Upload failed')
      return
    }
    setForm({
      title: '',
      description: '',
      niche: '',
      countries: '',
      price_usd: '',
      max_buyers: '10',
      source_attestation: '',
      resale_rights_ack: false,
    })
    setFile(null)
    await load()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-[#e7edea]">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">My lead packs</h1>
          <p className="mt-1 text-sm text-[#8fa29c]">Upload for admin review. Goes public only after approval.</p>
        </div>
        <Link href="/leads" className="text-sm text-[#e4c979] hover:underline">
          Marketplace
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-3xl border border-white/10 bg-[#0b2a26] p-5">
        <input
          required
          placeholder="Title"
          className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          placeholder="Description"
          className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Niche"
            className="rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm"
            value={form.niche}
            onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
          />
          <input
            placeholder="Countries (comma-separated)"
            className="rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm"
            value={form.countries}
            onChange={(e) => setForm((f) => ({ ...f, countries: e.target.value }))}
          />
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Price USD"
            className="rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm"
            value={form.price_usd}
            onChange={(e) => setForm((f) => ({ ...f, price_usd: e.target.value }))}
          />
          <input
            type="number"
            min="1"
            placeholder="Max buyers (default 10)"
            className="rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm"
            value={form.max_buyers}
            onChange={(e) => setForm((f) => ({ ...f, max_buyers: e.target.value }))}
          />
        </div>
        <textarea
          required
          placeholder="Source attestation (how you obtained these leads & rights to resell)"
          className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm"
          rows={2}
          value={form.source_attestation}
          onChange={(e) => setForm((f) => ({ ...f, source_attestation: e.target.value }))}
        />
        <label className="flex items-start gap-2 text-xs text-[#8fa29c]">
          <input
            type="checkbox"
            checked={form.resale_rights_ack}
            onChange={(e) => setForm((f) => ({ ...f, resale_rights_ack: e.target.checked }))}
          />
          I confirm I have lawful rights to sell this list and buyers may use it for legitimate outreach where permitted.
        </label>
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-[#8fa29c]"
        />
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-[#d8b45a] py-3 text-sm font-bold text-[#10221f] disabled:opacity-40"
        >
          {submitting ? 'Uploading…' : 'Submit for review'}
        </button>
      </form>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white">Submitted</h2>
        {loading ? (
          <p className="mt-3 text-sm text-[#8fa29c]">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-[#8fa29c]">No packs yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {items.map((p) => (
              <li key={p.id} className="rounded-2xl border border-white/10 bg-[#0b2a26] px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-white">{p.title}</span>
                  <span className="text-xs uppercase tracking-wide text-[#d8b45a]">{p.status}</span>
                </div>
                <p className="mt-1 text-xs text-[#8fa29c]">
                  ${Number(p.price_usd).toFixed(2)} · max {p.max_buyers} buyers
                  {p.reject_reason ? ` · Rejected: ${p.reject_reason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 flex gap-4 text-sm">
        <Link href="/dashboard/leads/earnings" className="text-[#e4c979] hover:underline">
          Earnings
        </Link>
        <Link href="/dashboard/leads/purchases" className="text-[#e4c979] hover:underline">
          Purchases
        </Link>
      </div>
    </div>
  )
}
