import Link from 'next/link'
import {
  ShoppingBag,
  Upload,
  ShieldCheck,
  Lock,
  MapPin,
  Users,
  Sparkles,
  Package,
} from 'lucide-react'
import Brand from '../../components/Brand'
import SiteHeader from '../../components/SiteHeader'
import LeadsEmptyCtas from '../../components/leads/LeadsEmptyCtas'
import { MarketCite } from '../../components/MarketCite'
import { MARKET_FACTS } from '../../lib/marketFacts'

export const dynamic = 'force-dynamic'

type Pack = {
  id: string
  title: string
  description: string
  niche: string
  price_usd: number
  currency: string
  remaining_seats: number
  effective_max_buyers: number
  countries: string[]
  preview_meta?: Record<string, unknown>
}

async function fetchPacks(): Promise<Pack[]> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
  const origin = base
    ? base.startsWith('http')
      ? base
      : `https://${base}`
    : 'http://localhost:3000'
  try {
    const res = await fetch(`${origin}/api/leads?limit=48`, { next: { revalidate: 30 } })
    if (!res.ok) return []
    const json = await res.json()
    return json.items ?? []
  } catch {
    return []
  }
}

const HOW = [
  {
    icon: Upload,
    title: 'Sellers submit packs',
    text: 'Service-specific CSV / XLSX packs with a clear target market and evidence of why the prospects may need the service. Random lists are rejected.',
  },
  {
    icon: ShieldCheck,
    title: 'Admin approval',
    text: 'CSV files get automatic header, record-count, contact-coverage and duplicate checks. Every pack also needs a manual quality and data-rights review.',
  },
  {
    icon: ShoppingBag,
    title: 'Buyers unlock files',
    text: 'Preview is limited. Full download after payment — seats are limited per pack.',
  },
] as const

export default async function LeadsCatalogPage() {
  const items = await fetchPacks()

  return (
    <main className="min-h-screen bg-[#071f1d] text-[#e7edea]">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[rgba(216,180,90,0.08)] blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[rgba(22,59,54,0.9)] blur-3xl" />
        <div className="container relative pb-14 pt-28">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#e4c979]">
                <Sparkles size={12} /> Lead Marketplace
              </p>
              <h1 className="font-display mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Browse lead packs
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#8fa29c]">
                A lead pack is a seller-submitted file (CSV or spreadsheet) with the niche, countries, price, and buyer limit they chose.
                Admin approval means the listing can go public — it is not a certificate that every contact is verified or sales-qualified.
                Sign in to buy or sell. Browsing stays open.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/dashboard/leads"
                  className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
                >
                  <Upload size={16} /> Sell packs
                </Link>
                <Link
                  href="/dashboard/leads/purchases"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-[#c5d0cb] transition hover:border-[rgba(216,180,90,0.45)] hover:text-[#e4c979]"
                >
                  <ShoppingBag size={16} /> My purchases
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'Live packs', value: String(items.length) },
                { label: 'Commission', value: '15%' },
                { label: 'Default seats', value: '10' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="min-w-[5.5rem] rounded-2xl border border-white/10 bg-[#0a2926]/80 px-3 py-4 text-center backdrop-blur"
                >
                  <p className="font-display text-2xl font-extrabold text-[#f0d98b]">{s.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#7f918c]">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container py-10">
        {(() => {
          const lead = MARKET_FACTS.find((f) => f.id === 'leads')!
          return (
            <div className="rounded-3xl border border-white/10 bg-[#0a2926] p-6 sm:p-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e4c979]">Market context</p>
              <p className="font-display mt-3 text-3xl font-extrabold text-white">{lead.figure}</p>
              <p className="mt-1 text-sm text-[#9aa8a3]">{lead.figureLabel}</p>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[#c5d0cb]">
                Use this only as category context. It does not describe the value of files listed on DropVerse, and it is not a forecast of what a pack will sell for.
              </p>
              <MarketCite sourceName={lead.sourceName} sourceUrl={lead.sourceUrl} sourceDate={lead.sourceDate} scope={lead.scope} />
            </div>
          )
        })()}
      </section>

      {/* How it works */}
      <section className="container py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {HOW.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/8 bg-[#0a2926] p-5 transition hover:border-[rgba(216,180,90,0.25)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.3)] bg-[rgba(216,180,90,0.1)] text-[#d8b45a]">
                <Icon size={18} />
              </div>
              <h3 className="font-display mt-4 text-base font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#849792]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Catalog */}
      <section className="container pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Available packs</h2>
            <p className="mt-1 text-sm text-[#849792]">
              {items.length === 0
                ? 'Nothing live yet — be the first seller.'
                : `${items.length} approved pack${items.length === 1 ? '' : 's'} ready to buy.`}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-[rgba(216,180,90,0.28)] bg-gradient-to-br from-[#0d2f2b] via-[#0a2926] to-[#071f1d] px-6 py-14 text-center sm:px-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(216,180,90,0.08),transparent_55%)]" />
            <div className="relative mx-auto max-w-lg">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.1)] text-[#d8b45a]">
                <Package size={28} />
              </div>
              <h3 className="font-display mt-6 text-xl font-bold text-white sm:text-2xl">
                Marketplace is open — packs coming soon
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#8fa29c]">
                No approved packs are live yet. If you generate leads, submit a pack from your dashboard. We review for quality,
                niche clarity, and resale rights — then it goes public.
              </p>
              <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-sm text-[#9aa8a3]">
                <li className="flex items-start gap-2">
                  <Lock size={15} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                  Full files stay locked until payment succeeds
                </li>
                <li className="flex items-start gap-2">
                  <Users size={15} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                  Sellers set seat limits (default 10 buyers)
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#d8b45a]" />
                  DropVerse takes a flat 15% commission on successful sales
                </li>
              </ul>
              <LeadsEmptyCtas />
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => {
              const soldOut = p.remaining_seats <= 0
              return (
                <li key={p.id}>
                  <Link
                    href={`/leads/${p.id}`}
                    className="group flex h-full flex-col rounded-3xl border border-white/10 bg-[#0a2926] p-5 transition hover:border-[rgba(216,180,90,0.45)] hover:bg-[#0c2f2b]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {p.niche ? (
                          <span className="inline-block rounded-full border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.08)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#e4c979]">
                            {p.niche}
                          </span>
                        ) : null}
                        {p.preview_meta?.serviceTarget ? <span className="mt-2 inline-block rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-200">For: {String(p.preview_meta.serviceTarget)}</span> : null}
                        <h2 className="mt-2 text-lg font-semibold text-white group-hover:text-[#f0d98b]">{p.title}</h2>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#d8b45a] px-3 py-1 text-sm font-bold text-[#10221f]">
                        ${Number(p.price_usd).toFixed(0)}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-[#8fa29c]">
                      {p.description || 'No description provided.'}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-4 text-xs text-[#6f827c]">
                      <span className="inline-flex items-center gap-1.5">
                        <Users size={13} className="text-[#d8b45a]" />
                        {soldOut ? (
                          <span className="font-semibold text-red-300">Sold out</span>
                        ) : (
                          <>
                            {p.remaining_seats} / {p.effective_max_buyers} seats
                          </>
                        )}
                      </span>
                      {p.countries?.length ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin size={13} className="text-[#d8b45a]" />
                          {p.countries.slice(0, 3).join(', ')}
                          {p.countries.length > 3 ? ` +${p.countries.length - 3}` : ''}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Brand compact />
          <div className="flex flex-wrap gap-6 text-sm text-[#83958f]">
            <Link href="/" className="hover:text-[#d8b45a]">
              Home
            </Link>
            <Link href="/earn" className="hover:text-[#d8b45a]">
              Become a Partner
            </Link>
            <Link href="/pricing" className="hover:text-[#d8b45a]">
              Pricing
            </Link>
          </div>
          <p className="text-sm text-[#667c75]">© {new Date().getFullYear()} DropVerse</p>
        </div>
      </footer>
    </main>
  )
}
