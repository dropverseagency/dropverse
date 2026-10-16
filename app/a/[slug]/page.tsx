'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Paperclip, X } from 'lucide-react'
import SpaceRemitPayForm from '../../../components/SpaceRemitPayForm'

type Pkg = { id: string; name: string; description: string; retail_price: number; currency: string }
type Svc = { id: string; title: string; slug: string; description: string; packages: Pkg[] }
type Page = {
  display_name: string
  headline: string
  description: string
  logo_url: string | null
  primary_color: string
  slug: string
  services: Svc[]
}

export default function AgencyPublicLandingPage() {
  const params = useParams()
  const slug = String(params?.slug || '')
  const [page, setPage] = useState<Page | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [packageId, setPackageId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [briefTitle, setBriefTitle] = useState('')
  const [briefNotes, setBriefNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [payMsg, setPayMsg] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [orderResult, setOrderResult] = useState<{
    projectId: string
    amount: number
    currency: string
    packageName: string
    spaceremitPublicKey: string | null
    paymentsConfigured: boolean
  } | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    ;(async () => {
      const res = await fetch(`/api/public/agency-page?slug=${encodeURIComponent(slug)}`)
      const json = await res.json()
      if (cancelled) return
      if (!res.ok) {
        setError(json.error || 'NOT_FOUND')
        setLoading(false)
        return
      }
      setPage(json.page)
      const first = json.page?.services?.[0]?.packages?.[0]
      if (first) setPackageId(first.id)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const selected = useMemo(() => {
    if (!page) return null
    for (const s of page.services) {
      const p = s.packages.find((x) => x.id === packageId)
      if (p) return { ...p, serviceTitle: s.title }
    }
    return null
  }, [page, packageId])

  async function uploadBriefFile(file: File) {
    if (attachments.length >= 5) { setFormError('Maximum 5 files'); return }
    setUploading(true); setFormError(null)
    try {
      const body = new FormData()
      body.append('slug', slug)
      body.append('file', file)
      const res = await fetch('/api/public/agency-order/upload', { method: 'POST', body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setFormError(json.error || 'Upload failed'); return }
      setAttachments((prev) => [...prev, { url: String(json.url), name: String(json.name || file.name) }])
    } finally { setUploading(false) }
  }

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setFormError(null)
    setPayMsg(null)
    const idempotencyKey =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
    const res = await fetch('/api/public/agency-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        slug,
        packageId,
        customerName,
        customerEmail,
        customerPhone,
        briefTitle,
        briefNotes,
        attachmentUrls: attachments.map((a) => a.url),
        idempotencyKey,
      }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setFormError(json.error || 'ORDER_FAILED')
      return
    }
    setOrderResult({
      projectId: json.projectId,
      amount: json.amount,
      currency: json.currency,
      packageName: json.packageName,
      spaceremitPublicKey: json.spaceremitPublicKey,
      paymentsConfigured: json.paymentsConfigured,
    })
  }

  if (loading) {
    return <main className="min-h-screen bg-[#061916] px-5 py-20 text-center text-sm text-[#849792]">Loading…</main>
  }
  if (error || !page) {
    return (
      <main className="min-h-screen bg-[#061916] px-5 py-20 text-center">
        <h1 className="font-display text-2xl font-extrabold text-[#f0f4f2]">Page not found</h1>
        <p className="mt-2 text-sm text-[#849792]">Unpublished or missing.</p>
      </main>
    )
  }

  const accent = page.primary_color || '#e2b656'

  return (
    <main className="min-h-screen bg-[#061916] text-[#e8eeeb]">
      <header className="border-b border-white/5 px-5 py-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          {page.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.logo_url} alt={page.display_name} className="h-10 w-10 rounded-full border border-white/10 object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold" style={{ background: accent, color: '#10221f' }}>
              {page.display_name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <div className="font-display text-lg font-extrabold">{page.display_name}</div>
            <div className="text-xs text-[#849792]">Services fulfilled by DropVerse</div>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="font-display text-3xl font-extrabold" style={{ color: accent }}>
          {page.headline || page.display_name}
        </h1>
        {page.description ? <p className="mt-4 text-sm text-[#aebcb7]">{page.description}</p> : null}
        {page.services.every((s) => !s.packages.length) ? (
          <p className="mt-8 rounded-2xl border border-white/10 bg-[#0c2420] px-4 py-6 text-sm text-[#849792]">
            No sellable packages are available on this page yet. Please check back soon.
          </p>
        ) : null}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {page.services.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-[#0c2420] p-5">
              <h3 className="font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-[#8fa29c]">{s.description}</p>
              <ul className="mt-4 space-y-2">
                {s.packages.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setPackageId(p.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        packageId === p.id
                          ? 'border-[rgba(216,180,90,0.55)] bg-[rgba(216,180,90,0.1)]'
                          : 'border-white/10'
                      }`}
                    >
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-[#849792]">
                        {p.currency} {Number(p.retail_price).toLocaleString()}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <section className="mt-12 rounded-3xl border border-white/10 bg-[#0c2420] p-6">
          <h2 className="font-display text-xl font-bold">Request this service</h2>
          <p className="mt-2 text-sm text-[#849792]">
            Pay DropVerse. Order is not paid until server-side verification succeeds.
          </p>
          {!orderResult ? (
            <form onSubmit={submitOrder} className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="text-sm sm:col-span-2">
                {selected
                  ? `${selected.serviceTitle} — ${selected.name} (${selected.currency} ${selected.retail_price})`
                  : 'Choose a package'}
              </div>
              <input
                required
                className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm"
                placeholder="Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                required
                type="email"
                className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm"
                placeholder="Email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
              <input
                className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm sm:col-span-2"
                placeholder="Phone (optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <input
                required
                className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm sm:col-span-2"
                placeholder="Project title"
                value={briefTitle}
                onChange={(e) => setBriefTitle(e.target.value)}
              />
              <textarea
                required
                rows={4}
                className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-sm sm:col-span-2"
                placeholder="Brief"
                value={briefNotes}
                onChange={(e) => setBriefNotes(e.target.value)}
              />
              <div className="sm:col-span-2 rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Work files (optional, max 5)</p>
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#e4c979]">
                    <Paperclip size={14} />{uploading ? 'Uploading…' : 'Add files'}
                    <input type="file" className="hidden" disabled={uploading || attachments.length >= 5} accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.ppt,.pptx,.txt,.mp4,image/*,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadBriefFile(f); e.target.value = '' }} />
                  </label>
                </div>
                {attachments.map((a) => (
                  <div key={a.url} className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <a href={a.url} target="_blank" rel="noreferrer" className="truncate hover:underline">{a.name}</a>
                    <button type="button" onClick={() => setAttachments((p) => p.filter((x) => x.url !== a.url))}><X size={14} /></button>
                  </div>
                ))}
              </div>

              {formError ? <p className="text-sm text-red-300 sm:col-span-2">{formError}</p> : null}
              <button
                type="submit"
                disabled={submitting || !packageId || uploading}
                className="sm:col-span-2 rounded-full px-6 py-3 text-sm font-bold text-[#10221f] disabled:opacity-50"
                style={{ background: accent }}
              >
                {submitting ? 'Submitting…' : 'Submit order & pay'}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-[#9fd8a4]">
                Order received ({orderResult.projectId.slice(0, 8)}…). Pay below to start fulfillment.
              </p>
              {orderResult.paymentsConfigured && orderResult.spaceremitPublicKey ? (
                <SpaceRemitPayForm
                  amount={orderResult.amount}
                  currency={orderResult.currency}
                  fullName={customerName}
                  email={customerEmail}
                  phone={customerPhone || "0000000000"}
                  publicKey={orderResult.spaceremitPublicKey}
                  onPaid={async (code) => {
                    setPayMsg(null); setFormError(null)
                    const res = await fetch('/api/public/agency-order/confirm', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ projectId: orderResult.projectId, paymentId: code, customerEmail }),
                    })
                    const json = await res.json().catch(() => ({}))
                    if (!res.ok) setFormError(json.error || 'Could not verify payment yet')
                    else if (!json.confirmed) setPayMsg(json.message || 'Payment reference saved; awaiting confirmation')
                    else setPayMsg('Payment confirmed. DropVerse will start fulfillment.')
                  }}
                  submitLabel="Pay with SpaceRemit →"
                />
              ) : (
                <p className="rounded-xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-3 text-sm text-[#e4c979]">
                  Online payment is not configured here. DropVerse will contact {customerEmail}. Order remains
                  payment pending.
                </p>
              )}
              {payMsg ? <p className="text-sm text-[#9fd8a4]">{payMsg}</p> : null}
            </div>
          )}
        </section>
        <p className="mt-10 text-center text-xs text-[#5f726c]">Powered by DropVerse</p>
      </div>
    </main>
  )
}
