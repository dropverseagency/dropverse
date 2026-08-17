'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, ChevronRight, Menu, Play, Sparkles, Users, Zap, Globe, Layers, X } from 'lucide-react'

const services = [
  ['Video Editing','Reels, TikTok, Shorts, ads & long-form content.'],
  ['Graphic Design','Branding, social creatives, ads & marketing assets.'],
  ['Web Design','Modern landing pages, stores and conversion-focused websites.'],
  ['Social Media Content','Content systems built to keep brands consistent.'],
  ['UGC Content','Authentic creator content designed to drive action.'],
  ['Copywriting','Hooks, scripts, landing pages and sales copy.'],
  ['Branding','Visual identities that make businesses memorable.'],
  ['Motion Graphics','Animated visuals, promos and high-impact content.'],
]

const samples = [
  ['Short-Form Video','Video Editing','01'],
  ['Luxury Brand Creative','Graphic Design','02'],
  ['SaaS Landing Page','Web Design','03'],
]

export default function Home() {
  const [menu,setMenu]=useState(false)
  return <main className="overflow-hidden">
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[rgba(7,31,29,0.80)] backdrop-blur-xl">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="DropVerse home"><Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover" priority/><span className="font-display text-xl font-extrabold tracking-[.16em]">DROP<span className="text-[#d8b45a]">VERSE</span></span></Link>
        <nav className="hidden items-center gap-8 text-sm text-[#c1cbc7] md:flex">
          <a href="#services" className="hover:text-[#f0d98b]">Services</a><a href="#how" className="hover:text-[#f0d98b]">How It Works</a><a href="#samples" className="hover:text-[#f0d98b]">Work Samples</a><a href="#about" className="hover:text-[#f0d98b]">About</a>
        </nav>
        <div className="hidden items-center gap-3 md:flex"><Link href="/login" className="px-4 py-2 text-sm text-[#d9e0dc]">Login</Link><a href="#start" className="rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">Get Started</a></div>
        <button onClick={()=>setMenu(!menu)} className="md:hidden" aria-label="Menu">{menu?<X/>:<Menu/>}</button>
      </div>
      {menu&&<div className="border-t border-white/5 bg-[#071f1d] p-5 md:hidden"><div className="container flex flex-col gap-5 text-[#d9e0dc]"><a href="#services" onClick={()=>setMenu(false)}>Services</a><a href="#how" onClick={()=>setMenu(false)}>How It Works</a><a href="#samples" onClick={()=>setMenu(false)}>Work Samples</a><a href="#about" onClick={()=>setMenu(false)}>About</a><Link href="/login" className="text-[#d8b45a]">Get Started →</Link></div></div>}
    </header>

    <section className="grid-bg relative flex min-h-screen items-center pt-20">
      <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[rgba(216,180,90,0.05)] blur-[100px]"/>
      <div className="container relative grid items-center gap-14 py-24 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] px-4 py-2 text-xs font-semibold uppercase tracking-[.2em] text-[#e4c979]"><Sparkles size={14}/> Linking talent to sales</div>
          <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-.04em] sm:text-6xl lg:text-[76px]">Turn Great Work<br/><span className="gold-gradient">Into Real Sales.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#aebcb7]">Access professional service samples, discover talented freelancers, and build your own Drop Servicing business with DropVerse.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link href="/login" className="group flex items-center gap-3 rounded-full bg-[#d8b45a] px-6 py-3.5 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">Start Your Journey <ArrowRight size={18} className="transition group-hover:translate-x-1"/></Link><a href="#services" className="flex items-center gap-2 rounded-full border border-white/10 px-6 py-3.5 font-semibold text-white transition hover:border-[rgba(216,180,90,0.40)]">Explore Services <ChevronRight size={18}/></a></div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#879b95]"><span className="flex items-center gap-2"><Check size={15} className="text-[#d8b45a]"/> Curated talent</span><span className="flex items-center gap-2"><Check size={15} className="text-[#d8b45a]"/> Ready-to-sell services</span><span className="flex items-center gap-2"><Check size={15} className="text-[#d8b45a]"/> Built for entrepreneurs</span></div>
        </div>
        <div className="relative mx-auto w-full max-w-[500px]">
          <div className="card glow relative overflow-hidden rounded-[28px] p-5">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4"><div><div className="text-xs uppercase tracking-[.18em] text-[#718781]">DropVerse platform</div><div className="mt-1 font-display font-bold">Your service engine</div></div><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(216,180,90,0.10)] text-[#d8b45a]"><Zap size={17}/></div></div>
            <div className="space-y-3">
              {[['Talent','Skilled freelancers','01'],['Service','Ready-to-sell offers','02'],['Client','Your next opportunity','03'],['Sale','Revenue generated','04']].map(([a,b,n],i)=><div key={a} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[.025] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(216,180,90,0.10)] text-xs font-bold text-[#d8b45a]">{n}</div><div className="flex-1"><div className="font-semibold">{a}</div><div className="text-sm text-[#81948e]">{b}</div></div>{i<3&&<ArrowRight size={16} className="text-[#536963]"/>}{i===3&&<Sparkles size={16} className="text-[#d8b45a]"/>}</div>)}
            </div>
            <div className="mt-5 rounded-2xl border border-[rgba(216,180,90,0.15)] bg-[rgba(216,180,90,0.05)] p-4"><div className="flex items-center justify-between text-xs text-[#9aaba6]"><span>Business momentum</span><span className="text-[#d8b45a]">Growing</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full w-[78%] rounded-full bg-[#d8b45a]"/></div></div>
          </div>
        </div>
      </div>
    </section>

    <section id="about" className="border-y border-white/5 bg-[#0a2926] py-20"><div className="container grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">The DropVerse advantage</p><h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">You sell the vision.<br/>We help power the delivery.</h2></div><div className="grid gap-8 sm:grid-cols-2"><Feature icon={<Users/>} title="Professional Talent" text="Access skilled freelancers across the digital services clients already need."/><Feature icon={<Layers/>} title="Ready-to-Sell Services" text="Turn proven work into compelling offers without building every capability yourself."/><Feature icon={<Globe/>} title="Build Your Business" text="Create a scalable Drop Servicing operation around services with real demand."/><Feature icon={<Zap/>} title="One Platform" text="Keep talent, services and work samples organized as you grow."/></div></div></section>

    <section id="how" className="container py-24"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Simple by design</p><h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">From talent to transaction.</h2><p className="mt-5 text-[#91a39e]">Everything you need to turn a great service into a client-ready offer.</p></div><div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/5 bg-white/5 md:grid-cols-4">{[['01','Join DropVerse','Create your account and access the platform.'],['02','Choose a Service','Browse professional services and work samples.'],['03','Get Clients','Use samples to market services and approach prospects.'],['04','Make Sales','Close clients and use talent to fulfill the work.']].map(([n,t,d])=><div key={n} className="bg-[#071f1d] p-7"><div className="text-sm font-bold text-[#d8b45a]">{n}</div><h3 className="font-display mt-10 text-xl font-bold">{t}</h3><p className="mt-3 text-sm leading-6 text-[#83958f]">{d}</p></div>)}</div></section>

    <section id="services" className="bg-[#0a2926] py-24"><div className="container"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Explore the ecosystem</p><h2 className="font-display mt-4 text-4xl font-extrabold sm:text-5xl">Services built to sell.</h2></div><a href="#services" className="flex items-center gap-2 text-sm font-bold text-[#d8b45a]">Explore all services <ArrowRight size={16}/></a></div><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{services.map(([title,text],i)=><div key={title} className="card group rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-[rgba(216,180,90,0.40)]"><div className="flex items-center justify-between"><span className="text-xs font-bold text-[#667c75]">0{i+1}</span><ArrowRight size={17} className="text-[#6e817c] transition group-hover:translate-x-1 group-hover:text-[#d8b45a]"/></div><h3 className="font-display mt-10 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#849792]">{text}</p></div>)}</div></div></section>

    <section id="samples" className="container py-24"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">The work library</p><h2 className="font-display mt-4 text-4xl font-extrabold sm:text-5xl">See what you can sell.</h2><p className="mt-5 max-w-xl text-[#8fa29c]">Browse professional work samples, discover talent and find the service that fits your next client.</p></div><a href="#samples" className="flex items-center gap-2 text-sm font-bold text-[#d8b45a]">View sample library <ArrowRight size={16}/></a></div><div className="mt-12 grid gap-5 md:grid-cols-3">{samples.map(([title,cat,n])=><div key={title} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]"><div className="relative aspect-[16/10] overflow-hidden bg-[#102d29]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(216,180,90,.22),transparent_35%),linear-gradient(135deg,#153d37,#071f1d)]"/><div className="absolute inset-0 flex items-center justify-center"><div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(216,180,90,0.30)] bg-[rgba(7,31,29,0.70)] text-[#d8b45a] backdrop-blur"><Play size={19} fill="currentColor"/></div></div><span className="absolute left-4 top-4 rounded-full bg-[rgba(7,31,29,0.80)] px-3 py-1 text-xs font-semibold text-[#e5d08c] backdrop-blur">{cat}</span></div><div className="p-5"><div className="flex items-center justify-between"><h3 className="font-display font-bold">{title}</h3><span className="text-xs text-[#667c75]">Sample {n}</span></div><button className="mt-5 flex items-center gap-2 text-sm font-bold text-[#d8b45a]">View sample <ArrowRight size={15}/></button></div></div>)}</div></section>

    <section id="start" className="relative overflow-hidden border-y border-[rgba(216,180,90,0.10)] bg-[#0a2926] py-24"><div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(216,180,90,0.05)] blur-[100px]"/><div className="container relative text-center"><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Start building</p><h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">Your next sale starts with the right service.</h2><p className="mx-auto mt-6 max-w-xl text-[#95a7a1]">Join DropVerse and turn professional talent into a business.</p><Link href="/login" className="mt-9 inline-flex items-center gap-3 rounded-full bg-[#d8b45a] px-7 py-4 font-bold text-[#10221f] hover:bg-[#f0d98b]">Get Started <ArrowRight size={18}/></Link></div></section>

    <footer className="py-12"><div className="container flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between"><div><div className="inline-flex items-center gap-3"><Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover"/><div className="font-display text-xl font-extrabold tracking-[.16em]">DROP<span className="text-[#d8b45a]">VERSE</span></div></div><p className="mt-2 text-xs uppercase tracking-[.2em] text-[#6f827c]">Linking talent to sales</p></div><div className="flex flex-wrap gap-6 text-sm text-[#80938d]"><a href="#services">Services</a><a href="#how">How It Works</a><a href="#samples">Work Samples</a><a href="#">Privacy</a><a href="#">Terms</a></div><p className="text-xs text-[#5f726c]">© 2026 DropVerse. All rights reserved.</p></div></footer>
  </main>
}

function Feature({icon,title,text}:{icon:React.ReactNode,title:string,text:string}){return <div><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] text-[#d8b45a]">{icon}</div><h3 className="font-display font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#83958f]">{text}</p></div>}
