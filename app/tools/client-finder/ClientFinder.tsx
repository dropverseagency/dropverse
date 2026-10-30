'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, ExternalLink, Search, ShieldCheck, Sparkles } from 'lucide-react'

type ServiceKey = 'video-editing' | 'ugc' | 'graphic-design' | 'social-media' | 'web-design'
type Lead = { id: string; url: string; text: string; createdAt: string; service: string; score: number; source: string }

const services: { value: ServiceKey; label: string; detail: string }[] = [
  { value: 'video-editing', label: 'Video editing', detail: 'Video editors, Reels, Shorts and short-form content' },
  { value: 'ugc', label: 'UGC content', detail: 'UGC creators and product videos' },
  { value: 'graphic-design', label: 'Graphic design', detail: 'Graphic design, logos and brand identity' },
  { value: 'social-media', label: 'Social media', detail: 'Social media content and management services' },
  { value: 'web-design', label: 'Web design', detail: 'Websites, landing pages and Shopify stores' },
]

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function ClientFinder() {
  const [service, setService] = useState<ServiceKey>('video-editing')
  const [items, setItems] = useState<Lead[]>([])
  const [searchedAt, setSearchedAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [partial, setPartial] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function search() {
    if (loading) return
    setLoading(true)
    setError('')
    setItems([])
    setPartial(false)
    try {
      const response = await fetch('/api/tools/client-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || 'Search failed. Please try again.')
      setItems(Array.isArray(payload.items) ? payload.items : [])
      setSearchedAt(payload.searchedAt || new Date().toISOString())
      setPartial(Boolean(payload.partial))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      window.setTimeout(() => setCopied((current) => current === url ? null : current), 1800)
    } catch {
      setError('Could not copy the link. Open the original post instead.')
    }
  }

  return (
    <main className="min-h-screen bg-[var(--dv-deep)] text-[var(--dv-paper)]">
      <div className="container max-w-6xl pb-20 pt-10 sm:pt-16">
        <Link href="/tools" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--dv-muted)] underline underline-offset-4 hover:text-[var(--dv-paper)]">
          <ArrowLeft size={15} /> Back to tools
        </Link>

        <header className="mt-9 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dv-gold)]">FREE TOOL · EARLY ACCESS</p>
          <h1 className="font-display mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">Client Request Finder</h1>
          <p className="mt-5 text-base leading-7 text-[var(--dv-muted)] sm:text-lg">
            Discover public posts from people explicitly asking for a service you can deliver. Every result links to the original post — no phone numbers or email lists.
          </p>
        </header>

        <section className="mt-9 rounded-3xl border border-[var(--dv-line)] bg-[var(--dv-surface)] p-5 sm:p-8" aria-labelledby="search-title">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--dv-gold)]" />
            <h2 id="search-title" className="font-display text-2xl font-bold">Find service requests</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--dv-muted)]">Choose what you sell. We search public Bluesky posts and keep only clear requests for that service.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setService(item.value)}
                aria-pressed={service === item.value}
                className={`rounded-2xl border p-4 text-start transition-colors ${service === item.value ? 'border-[var(--dv-gold)] bg-[var(--dv-surface-2)]' : 'border-[var(--dv-line)] bg-[var(--dv-deep)] hover:bg-[var(--dv-surface-2)]'}`}
              >
                <span className="block font-semibold">{item.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--dv-muted)]">{item.detail}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={search}
              disabled={loading}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--dv-gold)] px-6 py-3 text-sm font-bold text-[var(--dv-deep)] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              <Search size={17} /> {loading ? 'Searching public posts…' : 'Find client requests'}
            </button>
            <p className="text-xs leading-5 text-[var(--dv-muted)]">Limited to 6 searches per minute per network to keep the free source healthy.</p>
          </div>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        </section>

        <section className="mt-10" aria-labelledby="results-title" aria-live="polite">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--dv-muted)]">Original post links</p>
              <h2 id="results-title" className="font-display mt-2 text-2xl font-bold sm:text-3xl">Client requests</h2>
            </div>
            {searchedAt && <p className="text-xs text-[var(--dv-muted)]">Last searched {formatDate(searchedAt)}</p>}
          </div>

          {partial && <p className="mt-4 text-sm text-[var(--dv-muted)]">One search phrase was temporarily unavailable. Showing results from the successful search.</p>}
          {loading && <div className="mt-6 rounded-2xl border border-[var(--dv-line)] bg-[var(--dv-surface)] p-6 text-sm text-[var(--dv-muted)]">Searching the latest public posts and filtering out job ads and general discussion…</div>}
          {!loading && searchedAt && items.length === 0 && !error && (
            <div className="mt-6 rounded-2xl border border-[var(--dv-line)] bg-[var(--dv-surface)] p-6">
              <h3 className="font-semibold">No clear requests found in this search.</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--dv-muted)]">Try again later or choose another service. We intentionally hide general mentions and ordinary job listings rather than showing weak leads.</p>
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {items.map((lead) => (
                <article key={lead.id} className="rounded-2xl border border-[var(--dv-line)] bg-[var(--dv-surface)] p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full border border-[var(--dv-line)] bg-[var(--dv-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--dv-muted)]">{lead.source}</span>
                    <span className="text-xs font-semibold text-[var(--dv-gold)]">Explicit request</span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--dv-paper)]">{lead.text}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--dv-muted)]">
                    <span>{lead.service}</span><span>{formatDate(lead.createdAt)}</span>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a href={lead.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[var(--dv-gold)] px-4 py-2.5 text-xs font-bold text-[var(--dv-deep)] hover:opacity-90">
                      Open original post <ExternalLink size={14} />
                    </a>
                    <button type="button" onClick={() => copyLink(lead.url)} className="inline-flex items-center gap-2 rounded-full border border-[var(--dv-line)] px-4 py-2.5 text-xs font-semibold text-[var(--dv-paper)] hover:bg-[var(--dv-surface-2)]">
                      {copied === lead.url ? 'Copied' : 'Copy post link'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="mt-12 rounded-2xl border border-[var(--dv-line)] bg-[var(--dv-surface-2)] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck size={19} className="mt-0.5 shrink-0 text-[var(--dv-gold)]" />
            <div>
              <h2 className="font-semibold">A link, not a contact database</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--dv-muted)]">
                This early version uses Bluesky’s public read API, shows the original post link, and does not collect phone numbers or email addresses. Results are keyword-filtered, so review the post yourself before reaching out. Availability and result volume depend on public posts.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}
