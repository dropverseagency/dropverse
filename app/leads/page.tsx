import Link from 'next/link'

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

export default async function LeadsCatalogPage() {
  const items = await fetchPacks()

  return (
    <main className="min-h-screen bg-[#061916] text-[#e7edea]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d8b45a]">Lead Marketplace</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">Browse lead packs</h1>
            <p className="mt-2 max-w-xl text-sm text-[#8fa29c]">
              Approved packs only. Preview is limited — full file unlocks after payment. Login required to buy or sell.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/leads"
              className="rounded-full border border-white/15 px-4 py-2 text-sm text-[#c5d0cb] hover:border-[#d8b45a]/50 hover:text-[#e4c979]"
            >
              Sell packs
            </Link>
            <Link
              href="/dashboard/leads/purchases"
              className="rounded-full bg-[#d8b45a] px-4 py-2 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b]"
            >
              My purchases
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#0b2a26] px-6 py-16 text-center">
            <p className="text-sm text-[#8fa29c]">No approved packs yet. Sellers can submit from the dashboard for review.</p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/leads/${p.id}`}
                  className="block h-full rounded-3xl border border-white/10 bg-[#0b2a26] p-5 transition hover:border-[#d8b45a]/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-white">{p.title}</h2>
                    <span className="shrink-0 rounded-full bg-[#d8b45a]/15 px-2.5 py-0.5 text-xs font-bold text-[#e4c979]">
                      ${Number(p.price_usd).toFixed(0)}
                    </span>
                  </div>
                  {p.niche ? <p className="mt-1 text-xs text-[#d8b45a]">{p.niche}</p> : null}
                  <p className="mt-3 line-clamp-3 text-sm text-[#8fa29c]">{p.description || 'No description.'}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-[#6f827c]">
                    <span>
                      {p.remaining_seats} / {p.effective_max_buyers} seats left
                    </span>
                    {p.countries?.length ? <span>{p.countries.slice(0, 3).join(', ')}</span> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
