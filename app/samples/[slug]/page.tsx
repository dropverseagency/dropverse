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
  scope: string; deliverables: string; client_requirements: string; minimum_resale_price_usd:number|null
  sla_response_hours:number; sla_delivery_days:number|null; service_importance:string; freelancer_available:boolean; next_available_at:string|null; verified_level:string
  addons:Array<{id:string;name:string;description:string;price_usd:number;extra_days:number}>
  metrics:{on_time_delivery_rate:number|null;completion_rate:number|null;average_response_minutes:number|null;dispute_rate:number|null;average_rating:number|null;rating_count:number;paid_completed_projects:number}|null
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
        if (!cancelled) { setSample(json.sample); void fetch('/api/public/funnel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'sample_viewed',sampleId:json.sample.id,anonymousId:localStorage.getItem('dv_anon')||''})}) }
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
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><Detail title="Scope" text={sample.scope}/><Detail title="You receive" text={sample.deliverables}/><Detail title="Client provides" text={sample.client_requirements||'No special requirements.'}/><Detail title="Service SLA" text={`${sample.sla_response_hours}h response · ${sample.sla_delivery_days||sample.turnaround_days}d delivery`}/></div>
          <div className="mt-7 grid gap-4 rounded-2xl border border-white/10 bg-[#071b19] p-5 sm:grid-cols-3">
            <div><p className="text-xs text-[#7f9890]">Created by</p><p className="mt-1 font-semibold">{sample.freelancer_display_name || 'DropVerse freelancer'}</p></div>
            <div><p className="text-xs text-[#7f9890]">Turnaround</p><p className="mt-1 font-semibold">{sample.turnaround_days} days</p></div>
            <div><p className="text-xs text-[#7f9890]">Sample price</p><p className="mt-1 font-semibold">{sample.price_usd == null ? 'Contact for pricing' : `$${Number(sample.price_usd).toFixed(2)}`}</p></div>
          </div>
          <p className="mt-5 rounded-2xl border border-white/10 px-5 py-4 text-sm text-[#c7d3ce]">Included revisions: {sample.revision_limit}. Extra revisions: ${Number(sample.revision_price_usd).toFixed(2)} each.</p>
          <div className="mt-5 rounded-2xl border border-white/10 p-5"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#d8b45a]/10 px-3 py-1 text-xs font-bold text-[#e8cc7d]">{sample.verified_level==='none'?'Profile reviewed':`${sample.verified_level} verified`}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${sample.freelancer_available?'bg-emerald-400/10 text-emerald-200':'bg-white/5 text-[#a9bbb5]'}`}>{sample.freelancer_available?'Available':'Next availability pending'}</span></div>{sample.metrics&&sample.metrics.paid_completed_projects>0?<div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><Metric label="On time" value={`${sample.metrics.on_time_delivery_rate??0}%`}/><Metric label="Completed" value={`${sample.metrics.completion_rate??0}%`}/><Metric label="Disputes" value={`${sample.metrics.dispute_rate??0}%`}/><Metric label="Paid reviews" value={sample.metrics.rating_count?`${Number(sample.metrics.average_rating||0).toFixed(1)} / 5`:'New'}/></div>:<p className="mt-3 text-xs text-[#7f9890]">Performance appears after paid, approved projects only.</p>}</div>
          {sample.addons?.length?<div className="mt-5"><h2 className="font-bold">Optional add-ons</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{sample.addons.map(addon=><div key={addon.id} className="rounded-xl border border-white/10 p-3 text-sm"><div className="flex justify-between gap-2"><b>{addon.name}</b><span>${Number(addon.price_usd).toFixed(2)}</span></div><p className="mt-1 text-xs text-[#a9bbb5]">{addon.description}{addon.extra_days?` · +${addon.extra_days} days`:''}</p></div>)}</div></div>:null}
          <p className="mt-5 text-sm text-[#a9bbb5]">Minimum recommended resale price: {sample.minimum_resale_price_usd==null?'Set your own price':`$${Number(sample.minimum_resale_price_usd).toFixed(2)}`}. Usage rights are attested and reviewed before publication.</p>
          <Link href={auth.user ? `/dashboard/create-project?sampleId=${sample.id}` : `/login?redirect=${encodeURIComponent(`/dashboard/create-project?sampleId=${sample.id}`)}`} className="mt-7 inline-flex rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f]">Create project from this sample</Link>
        </div>
      </article> : null}
    </section>
  </main>
}

function Detail({title,text}:{title:string;text:string}){return <div className="rounded-xl border border-white/10 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#d8b45a]">{title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#c7d3ce]">{text||'—'}</p></div>}
function Metric({label,value}:{label:string;value:string}){return <div><p className="text-xs text-[#7f9890]">{label}</p><p className="mt-1 font-bold">{value}</p></div>}
