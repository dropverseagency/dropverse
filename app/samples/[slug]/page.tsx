'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import SiteHeader from '../../../components/SiteHeader'
import { useAuth } from '../../../lib/useAuth'

type Sample = {
  id: string
  title: string
  category: string
  description: string
  price_usd: number | null
  turnaround_days: number
  revision_limit: number
  revision_price_usd: number
  cover_url: string | null
  freelancer_display_name: string | null
}

export default function SampleDetailPage() {
  const auth = useAuth()
  const params = useParams<{ slug: string }>()
  const [sample, setSample] = useState<Sample | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/samples?slug=${encodeURIComponent(params.slug)}`)
      .then(async (response) => {
        const json = await response.json().catch(() => ({}))
        if (!response.ok || !json.sample) throw new Error('NOT_FOUND')
        if (!cancelled) setSample(json.sample)
      })
      .catch(() => { if (!cancelled) setUnavailable(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [params.slug])

  return <main className="min-h-screen bg-[#071b19] text-[#f4f7f5]">
    <SiteHeader />
    <section className="mx-auto max-w-5xl px-5 pb-20 pt-28 sm:pt-32">
      <Link href="/samples" className="text-sm text-[#a9bbb5]">← Back to samples</Link>
      {loading ? <p className="py-20 text-center text-sm text-[#a9bbb5]">Loading sample…</p> : null}
      {unavailable ? <div className="mt-8 rounded-3xl border border-white/10 bg-[#0b2824] p-8"><h1 className="text-2xl font-black">Sample unavailable</h1><p className="mt-3 text-sm text-[#a9bbb5]">This sample is not approved or no longer exists.</p></div> : null}
      {sample ? <article className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-[#0b2824]">
        <div className="aspect-[16/8] bg-[#102f2a]">{sample.cover_url ? <img src={sample.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-5xl text-[#d8b45a]/70">✦</div>}</div>
        <div className="p-6 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d8b45a]">{sample.category}</p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">{sample.title}</h1>
          <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-[#a9bbb5]">{sample.description || 'A work sample submitted by a DropVerse freelancer.'}</p>
          <div className="mt-7 grid gap-4 rounded-2xl border border-white/10 bg-[#071b19] p-5 sm:grid-cols-3">
            <div><p className="text-xs text-[#7f9890]">Created by</p><p className="mt-1 font-semibold">{sample.freelancer_display_name || 'DropVerse freelancer'}</p></div>
            <div><p className="text-xs text-[#7f9890]">Turnaround</p><p className="mt-1 font-semibold">{sample.turnaround_days} days</p></div>
            <div><p className="text-xs text-[#7f9890]">Sample price</p><p className="mt-1 font-semibold">{sample.price_usd == null ? 'Contact for pricing' : `$${Number(sample.price_usd).toFixed(2)}`}</p></div>
          </div>
          <p className="mt-5 rounded-2xl border border-white/10 px-5 py-4 text-sm text-[#c7d3ce]">Included revisions: {sample.revision_limit}. Extra revisions: ${Number(sample.revision_price_usd).toFixed(2)} each.</p>
          <Link href={auth.user ? `/dashboard/create-project?sampleId=${sample.id}` : `/login?redirect=${encodeURIComponent(`/dashboard/create-project?sampleId=${sample.id}`)}`} className="mt-7 inline-flex rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f]">Create project from this sample</Link>
        </div>
      </article> : null}
    </section>
  </main>
}
