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
  preview_meta?: Record<string, unknown>
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
    service_target: '',
    audience_type: 'freelancers_and_agencies',
    need_evidence: '',
    data_as_of: '',
    record_count: '',
    verification_level: 'partial',
    duplicates_removed: false,
    quality_policy_ack: false,
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
      service_target: '',
      audience_type: 'freelancers_and_agencies',
      need_evidence: '',
      data_as_of: '',
      record_count: '',
      verification_level: 'partial',
      duplicates_removed: false,
      quality_policy_ack: false,
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
          <p className="mt-1 text-sm text-[#8fa29c]">Upload a focused opportunity pack for a specific freelance/agency service. Random lists are rejected. Every pack is reviewed before publication.</p>
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
          required
          minLength={20}
          placeholder="Description"
          className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            minLength={3}
            placeholder="Niche"
            className="rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm"
            value={form.niche}
            onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
          />
          <input
            required
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[#aebcb7]">
            Service this pack supports *
            <select required value={form.service_target} onChange={(e) => setForm((f) => ({ ...f, service_target: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm text-white">
              <option value="">Choose one service</option>
              <option value="Video Editing">Video Editing</option>
              <option value="Website Design">Website Design</option>
              <option value="Shopify Store Improvement">Shopify Store Improvement</option>
              <option value="Shopify Store Setup">Shopify Store Setup</option>
              <option value="Landing Pages">Landing Pages</option>
              <option value="UGC Content">UGC Content</option>
              <option value="Social Media Content">Social Media Content</option>
              <option value="Graphic Design">Graphic Design</option>
              <option value="Copywriting">Copywriting</option>
              <option value="Other Digital Service">Other Digital Service</option>
            </select>
          </label>
          <label className="text-xs text-[#aebcb7]">
            Intended buyer *
            <select required value={form.audience_type} onChange={(e) => setForm((f) => ({ ...f, audience_type: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm text-white">
              <option value="freelancers_and_agencies">Freelancers & agencies</option>
              <option value="freelancers">Freelancers</option>
              <option value="agencies">Agencies</option>
            </select>
          </label>
          <label className="text-xs text-[#aebcb7]">
            Number of records *
            <input required type="number" min="1" step="1" value={form.record_count} onChange={(e) => setForm((f) => ({ ...f, record_count: e.target.value }))} placeholder="e.g. 100" className="mt-1 w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm text-white" />
          </label>
          <label className="text-xs text-[#aebcb7]">
            Data collected / last checked *
            <input required type="date" value={form.data_as_of} onChange={(e) => setForm((f) => ({ ...f, data_as_of: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm text-white" />
          </label>
          <label className="text-xs text-[#aebcb7] sm:col-span-2">
            Contact-data verification level *
            <select required value={form.verification_level} onChange={(e) => setForm((f) => ({ ...f, verification_level: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm text-white">
              <option value="verified">Verified — checked using a documented method</option>
              <option value="partial">Partially verified — some fields may be unchecked</option>
              <option value="unverified">Unverified — not independently checked</option>
            </select>
          </label>
        </div>
        <textarea required minLength={20} placeholder="Why are these businesses/creators a relevant opportunity for this service? Include observable evidence, e.g. no website, weak product pages, active creator with long videos but few short clips. Do not claim they requested a service unless they did." className="w-full rounded-xl border border-white/10 bg-[#071f1d] px-3 py-2.5 text-sm" rows={3} value={form.need_evidence} onChange={(e) => setForm((f) => ({ ...f, need_evidence: e.target.value }))} />
        <label className="flex items-start gap-2 text-xs text-[#8fa29c]">
          <input type="checkbox" checked={form.duplicates_removed} onChange={(e) => setForm((f) => ({ ...f, duplicates_removed: e.target.checked }))} />
          I checked this file and removed duplicate records within the pack.
        </label>
        <label className="flex items-start gap-2 text-xs text-[#8fa29c]">
          <input type="checkbox" checked={form.quality_policy_ack} onChange={(e) => setForm((f) => ({ ...f, quality_policy_ack: e.target.checked }))} />
          I confirm this is a targeted, service-relevant list — not a random business dump — and I will not describe prospects as interested or ready to buy without evidence.
        </label>
        <textarea
          required
          required
          minLength={10}
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
          I confirm I have the necessary lawful rights to sell this list, disclose its source, and buyers may use it only for legitimate outreach where permitted.
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
                  {p.reject_reason ? ` · Review note: ${p.reject_reason}` : ''}{p.preview_meta && typeof p.preview_meta.qualityScore === 'number' ? ` · Quality score: ${p.preview_meta.qualityScore}/100` : ''}
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
