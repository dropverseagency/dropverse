'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Check, ChevronRight, Menu, Play, Sparkles, Users, Zap, Globe, Layers, X, LogOut, ShieldCheck } from 'lucide-react'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { ctaFor } from '../lib/authCta'
import DodoSampleCheckout from '../components/DodoSampleCheckout'

const fallbackServices = [
  ['Video Editing','Reels, TikTok, Shorts, ads & long-form content.'],
  ['Graphic Design','Branding, social creatives, ads & marketing assets.'],
  ['Web Design','Modern landing pages, stores and conversion-focused websites.'],
  ['Social Media Content','Content systems built to keep brands consistent.'],
  ['UGC Content','Authentic creator content designed to drive action.'],
  ['Copywriting','Hooks, scripts, landing pages and sales copy.'],
  ['Branding','Visual identities that make businesses memorable.'],
  ['Motion Graphics','Animated visuals, promos and high-impact content.'],
]

const fallbackSamples = [
  { title: 'Short-Form Video', category: 'Video Editing', media_url: '' },
  { title: 'Luxury Brand Creative', category: 'Graphic Design', media_url: '' },
  { title: 'SaaS Landing Page', category: 'Web Design', media_url: '' },
]

const luxuryEase = [0.23, 1, 0.32, 1] as const
const reveal = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: luxuryEase } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.075 } } }
const staggerItem = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: luxuryEase } } }

function UserMenu({ user, isAdmin = false }: { user: { name?: string | null; email?: string }; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    await createClient().auth.signOut()
    window.location.assign('/')
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-semibold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d8b45a] text-xs font-bold text-[#10221f]">
          {(user.name || user.email || '?').trim().charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[10rem] truncate">{user.name || user.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#0a2926] shadow-xl">
          {isAdmin ? <Link href="/admin" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm font-bold text-[#f0d98b] transition hover:bg-white/5">Admin Panel</Link> : null}
          <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-[#d9e0dc] transition hover:bg-white/5">Dashboard</Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[#d9e0dc] transition hover:bg-white/5 disabled:opacity-60"
          >
            <LogOut size={15} /> {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [menu,setMenu]=useState(false)
  const [isAdmin,setIsAdmin]=useState(false)
  const [liveServices,setLiveServices]=useState<[string,string][] | null>(null)
  const [liveSamples,setLiveSamples]=useState<{id:string,title:string,category?:string,media_url?:string}[] | null>(null)
  const auth = useAuth()
  const services = liveServices ?? fallbackServices
  const samples = liveSamples ?? fallbackSamples
  const signedIn = !auth.loading && Boolean(auth.user)
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    let cancelled = false
    fetch('/api/public/catalog').then((r) => r.json()).then((j) => {
      if (cancelled) return
      if (Array.isArray(j.services) && j.services.length) {
        setLiveServices(j.services.map((s: { title: string; description?: string }) => [s.title, s.description || 'Published service']))
      }
      if (Array.isArray(j.samples) && j.samples.length) setLiveSamples(j.samples)
    }).catch(() => undefined)
    const supa = createClient()
    supa.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      supa.from('profiles').select('role').eq('id', user.id).single().then(({ data: prof }) => {
        if (!cancelled && prof && prof.role === 'admin') setIsAdmin(true)
      })
    })
    return () => { cancelled = true }
  }, [signedIn])
  return (
    <main className="overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 brand-header border-b border-white/5 bg-[rgba(7,31,29,0.80)] backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Brand />
          <nav className="hidden items-center gap-8 text-sm text-[#c1cbc7] md:flex">
            <a href="#services" className="hover:text-[#f0d98b]">Platform Tools</a><a href="#how" className="hover:text-[#f0d98b]">How It Works</a><a href="#samples" className="hover:text-[#f0d98b]">Work Samples</a><a href="#about" className="hover:text-[#f0d98b]">About</a><Link href="/earn" className="font-semibold text-[#e4c979] hover:text-[#f0d98b]">Earn <span className="hidden lg:inline">With DropVerse</span></Link>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {signedIn && auth.user ? (
              <>
                {isAdmin && <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.12)] px-3.5 py-2 text-sm font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.22)]"><ShieldCheck size={16} className="shrink-0 md:hidden" aria-label="Admin Panel" /><span className="hidden md:inline">Admin</span></Link>}
                <UserMenu user={auth.user} isAdmin={isAdmin} />
              </>
            ) : (
              <Link href="/login" className="px-4 py-2 text-sm text-[#d9e0dc]">{auth.loading ? '' : 'Login'}</Link>
            )}
            <Link href="/earn" className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]">Earn</Link>
            <a href="#start" className="brand-button-primary rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">Get Started</a>
          </div>
          <div className="flex items-center gap-2.5 md:hidden">
            {isAdmin ? (
              <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.12)] text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.22)]" aria-label="Admin Panel" title="Admin Panel">
                <ShieldCheck size={17} />
              </Link>
            ) : null}
            <button onClick={()=>setMenu(!menu)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[#c1cbc7]" aria-label="Menu">{menu?<X size={17}/>:<Menu size={17}/>}</button>
          </div>
        </div>
        {menu&&<div className="border-t border-white/5 bg-[#071f1d] p-5 md:hidden"><div className="container flex flex-col gap-5 text-[#d9e0dc]"><a href="#services" onClick={()=>setMenu(false)}>Platform Tools</a><a href="#how" onClick={()=>setMenu(false)}>How It Works</a><a href="#samples" onClick={()=>setMenu(false)}>Work Samples</a><a href="#about" onClick={()=>setMenu(false)}>About</a><Link href="/earn" className="text-[#d8b45a]" onClick={()=>setMenu(false)}>Earn With DropVerse →</Link>{isAdmin ? <Link href="/admin" className="font-bold text-[#f0d98b]" onClick={()=>setMenu(false)}>Admin Panel →</Link> : null}{signedIn ? <Link href="/dashboard" className="text-[#d8b45a]" onClick={()=>setMenu(false)}>Dashboard →</Link> : <Link href="/login" className="text-[#d8b45a]">Get Started →</Link>}</div></div>}
      </header>

      <section className="grid-bg relative flex min-h-screen items-center pt-20">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[rgba(216,180,90,0.05)] blur-[100px]"/>
        <div className="container relative grid items-center gap-14 py-24 lg:grid-cols-[1.05fr_.95fr]">
          <motion.div variants={reveal} initial={reduceMotion ? false : "hidden"} animate="show">
            <motion.div variants={reveal} className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] px-4 py-2 text-xs font-semibold uppercase tracking-[.2em] text-[#e4c979]"><Sparkles size={14}/> B2B SaaS workflow management</motion.div>
            <motion.h1 variants={reveal} className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-.04em] sm:text-6xl lg:text-[76px]">Project & Workspace Platform<br/><span className="gold-gradient">for Digital Teams</span></motion.h1>
            <motion.p variants={reveal} className="mt-7 max-w-xl text-lg leading-8 text-[#aebcb7]">Access automated digital workflow tools, client management templates, and collaborative workspaces.</motion.p>
            <motion.div variants={reveal} className="mt-9 flex flex-wrap gap-3"><Link href={ctaFor(signedIn, '/login')} className="brand-button-primary group flex items-center gap-3 rounded-full bg-[#d8b45a] px-6 py-3.5 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">{signedIn ? 'Create Project' : 'Start Your Journey'} <ArrowRight size={18} className="transition group-hover:translate-x-1"/></Link><a href="#services" className="flex items-center gap-2 rounded-full border border-white/10 px-6 py-3.5 font-semibold text-white transition hover:border-[rgba(216,180,90,0.40)]">Explore Services <ChevronRight size={18}/></a><Link href="/earn" className="brand-button-secondary flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-6 py-3.5 font-semibold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]">Earn With DropVerse <ChevronRight size={18}/></Link></motion.div>
            <motion.div variants={reveal} className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#879b95]"><span className="flex items-center gap-2"><Check size={15} className="text-[#d8b45a]"/> Centralized workspaces</span><span className="flex items-center gap-2"><Check size={15} className="text-[#d8b45a]"/> Automated workflows</span><span className="flex items-center gap-2"><Check size={15} className="text-[#d8b45a]"/> Built for digital teams</span></motion.div>
          </motion.div>
          <motion.div className="relative mx-auto w-full max-w-[500px]" initial={reduceMotion ? false : { opacity: 0, x: 26, scale: .97 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: .9, delay: .18, ease: luxuryEase }}>
            <motion.div className="card glow relative overflow-hidden rounded-[28px] p-5" animate={reduceMotion ? undefined : { y: [0, -7, 0] }} transition={reduceMotion ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}>
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4"><div><div className="text-xs uppercase tracking-[.18em] text-[#718781]">DropVerse platform</div><div className="mt-1 font-display font-bold">Your team workspace</div></div><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(216,180,90,0.10)] text-[#d8b45a]"><Zap size={17}/></div></div>
              <div className="space-y-3">
                {[['Talent','Collaborative team access','01'],['Service','Reusable workflow templates','02'],['Client','Client project pipeline','03'],['Sale','Workspace insights','04']].map(([a,b,n],i)=><div key={a} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[.025] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(216,180,90,0.10)] text-xs font-bold text-[#d8b45a]">{n}</div><div className="flex-1"><div className="font-semibold">{a}</div><div className="text-sm text-[#81948e]">{b}</div></div>{i<3&&<ArrowRight size={16} className="text-[#536963]"/>}{i===3&&<Sparkles size={16} className="text-[#d8b45a]"/>}</div>)}
              </div>
              <div className="mt-5 rounded-2xl border border-[rgba(216,180,90,0.15)] bg-[rgba(216,180,90,0.05)] p-4"><div className="flex items-center justify-between text-xs text-[#9aaba6]"><span>Business momentum</span><span className="text-[#d8b45a]">Growing</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full w-[78%] rounded-full bg-[#d8b45a]"/></div></div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section id="about" className="border-y border-white/5 bg-[#0a2926] py-20"><div className="container grid gap-12 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">The DropVerse advantage</p><h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Your team has the vision.<br/>We power the workflow.</h2></div><div className="grid gap-8 sm:grid-cols-2"><Feature icon={<Users/>} title="Team Collaboration" text="Give digital teams one structured workspace for people, projects, and assets."/><Feature icon={<Layers/>} title="Workflow Templates" text="Standardize repeatable workflows with reusable templates and operational tools."/><Feature icon={<Globe/>} title="Scale Your Workspace" text="Scale B2B delivery operations with visibility across projects, clients, and teams."/><Feature icon={<Zap/>} title="One Platform" text="Keep projects, client records, assets, and team activity organized as you grow."/></div></div></section>

      <section id="how" className="container py-24"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Simple by design</p><h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">From intake to delivery.</h2><p className="mt-5 text-[#91a39e]">Everything digital teams need to move work from intake to delivery.</p></div><div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-white/5 bg-white/5 md:grid-cols-4">{[['01','Create a workspace','Set up your account and access the platform.'],['02','Configure workflows','Use templates and tools for recurring operations.'],['03','Manage projects','Coordinate clients, tasks, assets, and team access.'],['04','Measure delivery','Track activity and workspace performance in one place.']].map(([n,t,d])=><div key={n} className="bg-[#071f1d] p-7"><div className="text-sm font-bold text-[#d8b45a]">{n}</div><h3 className="font-display mt-10 text-xl font-bold">{t}</h3><p className="mt-3 text-sm leading-6 text-[#83958f]">{d}</p></div>)}</div></section>

      <section id="services" className="bg-[#0a2926] py-24"><div className="container"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Explore the ecosystem</p><h2 className="font-display mt-4 text-4xl font-extrabold sm:text-5xl">Services built to sell.</h2></div><a href="#services" className="flex items-center gap-2 text-sm font-bold text-[#d8b45a]">Explore all services <ArrowRight size={16}/></a></div><motion.div variants={stagger} initial={reduceMotion ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: .12 }} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{services.map(([title,text],i)=><motion.div variants={staggerItem} key={title+String(i)} className="card group rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-[rgba(216,180,90,0.40)]"><div className="flex items-center justify-between"><span className="text-xs font-bold text-[#667c75]">0{i+1}</span><ArrowRight size={17} className="text-[#6e817c] transition group-hover:translate-x-1 group-hover:text-[#d8b45a]"/></div><h3 className="font-display mt-10 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#849792]">{text}</p></motion.div>)}</motion.div></div></section>

    <motion.section id="samples" variants={reveal} initial={reduceMotion ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: .12 }} className="container py-24"><div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">The work library</p><h2 className="font-display mt-4 text-4xl font-extrabold sm:text-5xl">See what you can sell.</h2><p className="mt-5 max-w-xl text-[#8fa29c]">These cards are service formats, not finished client jobs. Real samples are added when a project is published.</p></div><a href="#samples" className="flex items-center gap-2 text-sm font-bold text-[#d8b45a]">Format preview library <ArrowRight size={16}/></a></div><div className="mt-12 grid gap-5 md:grid-cols-3">{samples.map((sample,i)=>{ const title=Array.isArray(sample)?sample[0]:sample.title; const cat=Array.isArray(sample)?sample[1]:(sample.category||'Sample'); const media=Array.isArray(sample)?'':sample.media_url; const sampleId=!Array.isArray(sample) && 'id' in sample ? sample.id : undefined; return <div key={title+String(i)} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[.025]"><div className="relative aspect-[16/10] overflow-hidden bg-[#102d29]">{media ? <img src={media} alt="" className="h-full w-full object-cover"/> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(216,180,90,.22),transparent_35%),linear-gradient(135deg,#153d37,#071f1d)]"/>}<div className="absolute inset-0 flex items-center justify-center"><div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(216,180,90,0.30)] bg-[rgba(7,31,29,0.70)] text-[#d8b45a] backdrop-blur"><Play size={19} fill="currentColor"/></div></div><span className="absolute left-4 top-4 rounded-full bg-[rgba(7,31,29,0.80)] px-3 py-1 text-xs font-semibold text-[#e5d08c] backdrop-blur">{cat}</span></div><div className="p-5"><div className="flex items-center justify-between"><h3 className="font-display font-bold">{title}</h3><span className="text-xs text-[#667c75]">{media ? 'Live' : 'Format'}</span></div><DodoSampleCheckout sampleId={sampleId} /></div></div>})}</div></motion.section>

      <section id="start" className="border-t border-white/5 bg-[#0a2926] py-24"><div className="container text-center"><p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Get started</p><h2 className="font-display mt-4 text-4xl font-extrabold sm:text-5xl">Ready to build?</h2><p className="mx-auto mt-5 max-w-xl text-[#8fa29c]">Create your workspace and start managing digital projects in one place.</p><div className="mt-10 flex flex-wrap justify-center gap-3"><Link href={ctaFor(signedIn, '/login')} className="brand-button-primary rounded-full bg-[#d8b45a] px-8 py-3.5 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">{signedIn ? 'Go to Dashboard' : 'Create Account'}</Link><Link href="/pricing" className="rounded-full border border-white/10 px-8 py-3.5 font-semibold text-white transition hover:border-[rgba(216,180,90,0.40)]">View Pricing</Link></div></div></section>

      <footer className="border-t border-white/5 py-12"><div className="container flex flex-col items-center justify-between gap-6 sm:flex-row"><Brand compact /><div className="flex gap-6 text-sm text-[#83958f]"><Link href="/privacy" className="hover:text-[#d8b45a]">Privacy</Link><Link href="/terms" className="hover:text-[#d8b45a]">Terms</Link></div><p className="text-sm text-[#667c75]">© {new Date().getFullYear()} DropVerse</p></div></footer>
    </main>
  )
}

function Feature({icon,title,text}:{icon:React.ReactNode,title:string,text:string}){return <div><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] text-[#d8b45a]">{icon}</div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#849792]">{text}</p></div>}
