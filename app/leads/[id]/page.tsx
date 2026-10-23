import Link from 'next/link'
import { notFound } from 'next/navigation'
import LeadBuyPanel from './LeadBuyPanel'

export const dynamic = 'force-dynamic'

async function fetchPack(id: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
  const origin = base
    ? base.startsWith('http')
      ? base
      : `https://${base}`
    : 'http://localhost:3000'
  const res = await fetch(`${origin}/api/leads/${id}`, { next: { revalidate: 15 } })
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json()
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pack = await fetchPack(id)
  if (!pack) notFound()

  return (
    <main className="min-h-screen bg-[#061916] text-[#e7edea]">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/leads" className="text-xs text-[#8fa29c] hover:text-[#e4c979]">
          ← All packs
        </Link>
        <h1 className="mt-4 font-display text-3xl font-bold text-white">{pack.title}</h1>
        {pack.niche ? <p className="mt-1 text-sm text-[#d8b45a]">{pack.niche}</p> : null}
        <p className="mt-4 text-sm leading-6 text-[#aebcb7]">{pack.description || 'No description.'}</p>

        <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-[#0b2a26] p-5 sm:grid-cols-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Price</p>
            <p className="mt-1 text-xl font-bold text-[#e4c979]">${Number(pack.price_usd).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Seats left</p>
            <p className="mt-1 text-xl font-bold text-white">
              {pack.remaining_seats} / {pack.effective_max_buyers}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Countries</p>
            <p className="mt-1 text-sm text-[#c5d0cb]">
              {(pack.countries || []).length ? pack.countries.join(', ') : '—'}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b2a26] p-5">
          <h2 className="text-sm font-bold text-white">Opportunity details</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
            <div><p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Service</p><p className="mt-1 text-[#e4c979]">{String(pack.preview_meta?.serviceTarget || 'Not specified')}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Intended buyer</p><p className="mt-1 text-[#c5d0cb]">{String(pack.preview_meta?.audienceType || 'Freelancers and agencies').replaceAll('_', ' ')}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Records claimed by seller</p><p className="mt-1 text-[#c5d0cb]">{String(pack.preview_meta?.recordCount || 'Not stated')}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Data collected / checked</p><p className="mt-1 text-[#c5d0cb]">{String(pack.preview_meta?.dataAsOf || 'Not stated')}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Contact verification</p><p className="mt-1 text-[#c5d0cb]">{String(pack.preview_meta?.verificationLevel || 'Not stated')}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Quality review score</p><p className="mt-1 text-[#c5d0cb]">{typeof pack.preview_meta?.qualityScore === 'number' ? `${pack.preview_meta.qualityScore}/100 (preliminary)` : 'Manual review'}</p></div>
          </div>
          {pack.preview_meta?.needEvidence ? <div className="mt-4 border-t border-white/10 pt-3"><p className="text-[11px] uppercase tracking-wide text-[#6f827c]">Why these leads may fit</p><p className="mt-1 text-sm leading-6 text-[#c5d0cb]">{String(pack.preview_meta.needEvidence)}</p></div> : null}
          <p className="mt-3 text-xs leading-5 text-[#6f827c]">These are potential opportunities, not confirmed buyer intent. Verification and conversion are not guaranteed; check the listing details before purchasing.</p>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-[#071f1d] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8fa29c]">Limited preview</p>
          <p className="mt-3 text-xs leading-5 text-[#8fa29c]">File name: {String(pack.preview_meta?.fileName || 'Not provided')} · File size: {typeof pack.preview_meta?.bytes === 'number' ? `${Math.round(pack.preview_meta.bytes / 1024)} KB` : 'Not stated'}</p>
          <p className="mt-3 text-xs text-[#6f827c]">
            Full lead file is private until payment is confirmed server-side.
          </p>
        </div>

        <div className="mt-8">
          <LeadBuyPanel
            packId={pack.id}
            priceUsd={Number(pack.price_usd)}
            remaining={Number(pack.remaining_seats)}
            currency={pack.currency || 'USD'}
          />
        </div>
      </div>
    </main>
  )
}
