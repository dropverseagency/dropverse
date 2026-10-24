'use client'
import { useState } from 'react'

export const FREELANCER_NICHES = ["Video Editing","Short-Form Video Editing","Long-Form Video Editing","UGC Content","Motion Graphics","2D Animation","3D Animation","Graphic Design","Branding","Logo Design","UI/UX Design","Web Design","Web Development","WordPress Development","Shopify Development","Mobile App Development","Software Development","AI Automation","Chatbot Development","No-Code Development","Social Media Content","Social Media Management","Content Creation","Copywriting","Content Writing","SEO","Paid Ads (Meta/Google)","Email Marketing","Lead Generation","Sales & Appointment Setting","Virtual Assistance","Data Entry","Data Analysis","Translation","Transcription","Voice Over","Podcast Editing","Photo Editing","Product Photography","Presentation Design","Other"] as const

export function validPortfolioLinks(links: string[]) {
  return links.length > 0 && links.every(link => {
    try { const url = new URL(link); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname.includes('.')) } catch { return false }
  })
}

export function FreelancerDetails({ niches, setNiches, otherNiche, setOtherNiche, links, setLinks }: {
  niches: string[]; setNiches: (v: string[]) => void
  otherNiche: string; setOtherNiche: (v: string) => void
  links: string[]; setLinks: (v: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const matches = FREELANCER_NICHES.filter(n => n.toLowerCase().includes(search.toLowerCase()) && !niches.includes(n))
  return <div className="space-y-4 rounded-2xl border border-[#d8b45a]/25 bg-white/5 p-4">
    <div>
      <label className="block text-sm font-medium text-[#d9e0dc]" htmlFor="niche-search">Your niches <span className="text-[#d8b45a]">*</span> (select more than one)</label>
      <input id="niche-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search niches, e.g. video, AI, design..." autoComplete="off" className="mt-2 w-full rounded-xl border border-white/10 bg-[#10221f] px-4 py-3 text-white" />
      {niches.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{niches.map(n => <button type="button" key={n} onClick={() => setNiches(niches.filter(x => x !== n))} className="rounded-full border border-[#d8b45a]/50 bg-[#d8b45a]/15 px-3 py-1 text-xs text-[#f0d98b]">{n} ×</button>)}</div>}
      <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#10221f]">
        {matches.map(n => <button key={n} type="button" onClick={() => { setNiches([...niches, n]); setSearch('') }} className="block w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10">{n}</button>)}
        {matches.length === 0 && <p className="px-4 py-3 text-xs text-[#9aaca6]">No more matching niches. Choose Other to specify your specialty.</p>}
      </div>
    </div>
    {niches.includes('Other') && <label className="block text-sm text-[#d9e0dc]">Specify your other niche *
      <input required maxLength={100} value={otherNiche} onChange={e => setOtherNiche(e.target.value)} placeholder="Write your specialty" className="mt-2 w-full rounded-xl border border-white/10 bg-[#10221f] px-4 py-3 text-white" />
    </label>}
    <div className="space-y-2">
      <p className="text-sm font-medium text-[#d9e0dc]">Portfolio links * (at least one)</p>
      {links.map((link, index) => <div key={index} className="flex gap-2">
        <input type="url" required placeholder="https://behance.net/your-work" value={link} onChange={e => setLinks(links.map((v,i) => i === index ? e.target.value : v))} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#10221f] px-3 py-3 text-sm text-white" />
        {links.length > 1 && <button type="button" onClick={() => setLinks(links.filter((_,i) => i !== index))} className="px-2 text-sm text-[#d8b45a]">Remove</button>}
      </div>)}
      <button type="button" onClick={() => setLinks([...links, ''])} className="text-sm font-semibold text-[#d8b45a]">+ Add another portfolio link</button>
      <p className="text-xs text-[#9aaca6]">Behance, Dribbble, GitHub, Google Drive, personal website, or other public portfolio URLs.</p>
    </div>
  </div>
}
