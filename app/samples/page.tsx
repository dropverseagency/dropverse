'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import SiteHeader from '../../components/SiteHeader'
import { useAuth } from '../../lib/useAuth'

type Sample = { id:string; slug:string; title:string; category:string; description:string; price_usd:number|null; turnaround_days:number; revision_limit:number; revision_price_usd:number; cover_url:string|null; freelancer_display_name:string|null }

export default function SamplesPage() {
  const auth = useAuth()
  const [items,setItems] = useState<Sample[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState(false)
  const [category,setCategory] = useState('All')
  useEffect(() => {
    let cancelled = false
    fetch('/api/samples').then(async r => { const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(); if(!cancelled) setItems(j.items||[]) })
      .catch(()=>!cancelled&&setError(true)).finally(()=>!cancelled&&setLoading(false))
    return ()=>{cancelled=true}
  },[])
  const categories=['All',...Array.from(new Set(items.map(x=>x.category))).sort()]
  const filtered=category==='All'?items:items.filter(x=>x.category===category)
  return <main className="min-h-screen bg-[#071b19] text-[#f4f7f5]">
    <SiteHeader />
    <section className="mx-auto max-w-7xl px-5 pb-12 pt-28 sm:pt-32">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#d8b45a]">The Samples Vault</p>
      <div className="mt-4 grid gap-8 md:grid-cols-[1.4fr_0.6fr] md:items-end"><div>
        <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-6xl">Real work. Reviewed before it goes live.</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[#a9bbb5]">Explore approved work samples from DropVerse freelancers. Every public listing is reviewed before it appears here. Approved samples may be shown by Drop Servicers in proposals, portfolios, and marketing to promote the relevant digital services, under the freelancer’s sample-use permission.</p>
      </div><div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><p className="text-sm font-semibold">Are you a freelancer?</p><p className="mt-2 text-sm leading-6 text-[#a9bbb5]">Sign in with a freelancer account to submit your work for review.</p><Link href="/login?redirect=/dashboard/samples" className="mt-4 inline-flex rounded-full border border-[#d8b45a]/50 px-4 py-2 text-sm font-bold text-[#e8cc7d]">Submit your work →</Link></div></div>
      <div className="mt-12 flex flex-wrap gap-2">{categories.map(x=><button key={x} onClick={()=>setCategory(x)} className={`rounded-full px-4 py-2 text-xs font-semibold ${category===x?'bg-[#d8b45a] text-[#10221f]':'border border-white/10 text-[#a9bbb5]'}`}>{x}</button>)}</div>
      {loading&&<div className="py-20 text-center text-sm text-[#a9bbb5]">Loading approved samples…</div>}
      {error&&<div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 text-sm text-[#e6d5a4]">The Samples Vault is not available yet. Its database migration and storage setup must be completed before the catalogue can load.</div>}
      {!loading&&!error&&filtered.length===0&&<div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-16 text-center"><h2 className="text-xl font-bold">The vault is getting ready</h2><p className="mt-2 text-sm text-[#a9bbb5]">No approved samples are published yet. Check back soon.</p></div>}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(s=><article key={s.id} className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b2824]">
        <div className="aspect-[16/10] bg-[#102f2a]">{s.cover_url?<img src={s.cover_url} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-4xl text-[#d8b45a]/70">✦</div>}</div>
        <div className="p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-[#d8b45a]">{s.category}</p><h2 className="mt-2 text-xl font-bold">{s.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#a9bbb5]">{s.description||'A work sample submitted by a DropVerse freelancer.'}</p>
          <p className="mt-4 text-sm text-[#c7d3ce]">Included revisions: {s.revision_limit}. Extra revisions: ${Number(s.revision_price_usd).toFixed(2)} each.</p>
          <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/10 pt-4"><div><p className="text-xs text-[#7f9890]">Created by</p><p className="mt-1 text-sm font-semibold">{s.freelancer_display_name||'DropVerse freelancer'}</p></div><div className="text-right"><p className="text-xs text-[#7f9890]">Turnaround</p><p className="mt-1 text-sm font-semibold">{s.turnaround_days} days</p>{s.price_usd!=null&&<p className="mt-1 text-sm font-bold text-[#e8cc7d]">${Number(s.price_usd).toFixed(2)}</p>}</div></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={auth.user ? `/dashboard/create-project?sampleId=${s.id}` : `/login?redirect=${encodeURIComponent(`/dashboard/create-project?sampleId=${s.id}`)}`} className="inline-flex rounded-full bg-[#d8b45a] px-4 py-2 text-sm font-bold text-[#10221f]">Create a project with this sample</Link>
            <Link href={`/samples/${s.slug}`} className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-semibold">View details</Link>
          </div>
        </div></article>)}</div>
    </section><footer className="border-t border-white/10 px-5 py-8 text-center text-xs text-[#718780]">DropVerse · Work samples are published only after review.</footer>
  </main>
}
