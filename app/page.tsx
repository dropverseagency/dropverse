'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, ChevronRight, Menu, Play, Sparkles, Users, Zap, Globe, Layers, X, LogOut, ShieldCheck } from 'lucide-react'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { ctaFor } from '../lib/authCta'
import ThemeToggle from '../components/ThemeToggle'

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
  const [liveSamples,setLiveSamples]=useState<{title:string,category?:string,media_url?:string}[] | null>(null)
  const auth = useAuth()
  const services = liveServices ?? fallbackServices
  const samples = liveSamples ?? fallbackSamples
  const signedIn = !auth.loading && Boolean(auth.user)
  const reduceMotion = useReducedMotion()
    // Admin check derived DIRECTLY from the signed-in session + profile role.
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
return <main className="overflow-hidden">
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="container flex min-h-20 items-center justify-between gap-4">
        <Link href="/" className="inline-flex shrink-0 items-center gap-3 rounded-lg" aria-label="DropVerse home">
          <Image src="/dropverse-logo.jpeg" alt="" width={42} height={42} className="rounded-xl object-cover shadow-soft" priority />
          <span className="font-display text-lg font-extrabold tracking-[.12em] sm:text-xl">DROP<span className="text-accent">VERSE</span></span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex xl:gap-8">
          <a href="#services" className="transition-colors hover:text-foreground">Services</a>
          <a href="#how" className="transition-colors hover:text-foreground">How It Works</a>
          <a href="#samples" className="transition-colors hover:text-foreground">Work Samples</a>
          <a href="#about" className="transition-colors hover:text-foreground">About</a>
          <Link href="/earn" className="font-semibold text-accent transition-colors hover:opacity-80">Earn With DropVerse</Link>
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          {signedIn && auth.user ? (
            <>
              {isAdmin && <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted"><ShieldCheck size={16} /><span>Admin</span></Link>}
              <UserMenu user={auth.user} isAdmin={isAdmin} />
            </>
          ) : (
            <Link href="/login" className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{auth.loading ? '' : 'Login'}</Link>
          )}
          <Link href="/earn" className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted">Earn</Link>
          <a href="#start" className="brand-button-primary rounded-full px-5 py-2.5 text-sm font-bold">Get Started</a>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          {isAdmin ? <Link href="/admin" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground" aria-label="Open admin panel" title="Admin Panel"><ShieldCheck size={17} /></Link> : null}
          <button type="button" onClick={() => setMenu((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted" aria-label={menu ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menu} aria-controls="mobile-navigation">
            {menu ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div id="mobile-navigation" hidden={!menu} className="border-t border-border bg-background/95 p-5 backdrop-blur-xl lg:hidden">
        <nav aria-label="Mobile navigation" className="container flex flex-col gap-1 text-foreground">
          <a href="#services" onClick={() => setMenu(false)} className="rounded-lg px-3 py-3 hover:bg-muted">Services</a>
          <a href="#how" onClick={() => setMenu(false)} className="rounded-lg px-3 py-3 hover:bg-muted">How It Works</a>
          <a href="#samples" onClick={() => setMenu(false)} className="rounded-lg px-3 py-3 hover:bg-muted">Work Samples</a>
          <a href="#about" onClick={() => setMenu(false)} className="rounded-lg px-3 py-3 hover:bg-muted">About</a>
          <Link href="/earn" onClick={() => setMenu(false)} className="rounded-lg px-3 py-3 font-semibold text-accent hover:bg-muted">Earn With DropVerse</Link>
          {signedIn ? <Link href="/dashboard" onClick={() => setMenu(false)} className="rounded-lg px-3 py-3 hover:bg-muted">Dashboard</Link> : <Link href="/login" onClick={() => setMenu(false)} className="rounded-lg px-3 py-3 hover:bg-muted">Login</Link>}
          <a href="#start" onClick={() => setMenu(false)} className="brand-button-primary mt-3 rounded-full px-5 py-3 text-center font-bold">Get Started</a>
        </nav>
      </div>
    </header>

    <section className="relative isolate flex min-h-[88svh] items-center overflow-hidden bg-background pt-10 sm:pt-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgb(var(--primary)/.16),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgb(var(--accent)/.07),transparent_45%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(var(--background)/.15),rgb(var(--background)/.8))]" />
      <div className="container relative grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-[1.05fr_.95fr] lg:gap-16">
        <motion.div variants={reveal} initial={reduceMotion ? false : "hidden"} animate="show" className="max-w-2xl">
          <motion.div variants={reveal} className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-xs font-semibold uppercase tracking-[.16em] text-accent shadow-soft">
            <Sparkles size={14} aria-hidden="true" /> Linking talent to sales
          </motion.div>
          <motion.h1 variants={reveal} className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-.04em] text-foreground sm:text-6xl lg:text-7xl">
            Turn Great Work<br /><span className="text-primary">Into Real Sales.</span>
          </motion.h1>
          <motion.p variants={reveal} className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Access professional service samples, discover talented freelancers, and build your own Drop Servicing business with DropVerse.
          </motion.p>
          <motion.div variants={reveal} className="mt-9 flex flex-wrap gap-3">
            <Link href={ctaFor(signedIn, '/login')} className="brand-button-primary group inline-flex min-h-12 items-center gap-3 rounded-full px-6 py-3.5 font-bold">
              {signedIn ? 'Create Project' : 'Start Your Journey'}
              <ArrowRight size={18} aria-hidden="true" className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
            </Link>
            <a href="#services" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-transparent px-6 py-3.5 font-semibold text-foreground transition-colors hover:bg-muted">
              Explore Services <ChevronRight size={18} aria-hidden="true" />
            </a>
          </motion.div>
          <motion.div variants={reveal} className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted-foreground sm:mt-12">
            <span className="flex items-center gap-2"><Check size={15} className="text-accent" aria-hidden="true" /> Curated talent</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-accent" aria-hidden="true" /> Ready-to-sell services</span>
            <span className="flex items-center gap-2"><Check size={15} className="text-accent" aria-hidden="true" /> Built for entrepreneurs</span>
          </motion.div>
        </motion.div>
        <motion.div className="relative mx-auto w-full max-w-[500px]" initial={reduceMotion ? false : { opacity: 0, x: 26, scale: .97 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: reduceMotion ? 0 : .9, delay: reduceMotion ? 0 : .18, ease: luxuryEase }}>
          <motion.div className="card relative overflow-hidden rounded-3xl p-5 shadow-elevated sm:p-6" animate={reduceMotion ? undefined : { y: [0, -5, 0] }} transition={reduceMotion ? undefined : { duration: 7, repeat: Infinity, ease: "easeInOut" }}>
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <div><div className="text-xs uppercase tracking-[.16em] text-muted-foreground">DropVerse platform</div><div className="mt-1 font-display font-bold text-foreground">Your service engine</div></div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-accent"><Zap size={17} aria-hidden="true" /></div>
            </div>
            <div className="space-y-3">
              {[['Talent','Skilled freelancers','01'],['Service','Ready-to-sell offers','02'],['Client','Your next opportunity','03'],['Sale','Revenue generated','04']].map(([a,b,n],i)=><div key={a} className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold text-accent">{n}</div><div className="min-w-0 flex-1"><div className="font-semibold text-card-foreground">{a}</div><div className="text-sm text-muted-foreground">{b}</div></div>{i<3&&<ArrowRight size={16} className="text-muted-foreground" aria-hidden="true"/>}{i===3&&<Sparkles size={16} className="text-accent" aria-hidden="true"/>}</div>)}
            </div>
            <div className="mt-5 rounded-2xl border border-border bg-muted/60 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Business momentum</span><span className="font-semibold text-accent">Growing</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-border"><div className="h-full w-[78%] rounded-full bg-accent" /></div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>

    <section id="about" className="border-y border-border bg-card/60 py-20 sm:py-24">
      <div className="container grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
        <div className="max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[.18em] text-accent">The DropVerse advantage</p>
          <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">You sell the vision.<br />We help power the delivery.</h2>
          <p className="mt-5 max-w-lg leading-7 text-muted-foreground">Build your offer around real services and skilled people—without having to do every part of the work yourself.</p>
        </div>
        <motion.div variants={stagger} initial={reduceMotion ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: .12 }} className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
          <motion.div variants={staggerItem}><Feature icon={<Users />} title="Professional Talent" text="Access skilled freelancers across the digital services clients already need." /></motion.div>
          <motion.div variants={staggerItem}><Feature icon={<Layers />} title="Ready-to-Sell Services" text="Turn proven work into compelling offers without building every capability yourself." /></motion.div>
          <motion.div variants={staggerItem}><Feature icon={<Globe />} title="Build Your Business" text="Create a scalable Drop Servicing operation around services with real demand." /></motion.div>
          <motion.div variants={staggerItem}><Feature icon={<Zap />} title="One Platform" text="Keep talent, services and work samples organized as you grow." /></motion.div>
        </motion.div>
      </div>
    </section>

    <section id="how" className="container py-20 sm:py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-accent">Simple by design</p>
        <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">From talent to transaction.</h2>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">Everything you need to turn a great service into a client-ready offer.</p>
      </div>
      <motion.div variants={stagger} initial={reduceMotion ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: .12 }} className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4">
        {[['01','Join DropVerse','Create your account and access the platform.'],['02','Choose a Service','Browse professional services and work samples.'],['03','Get Clients','Use samples to market services and approach prospects.'],['04','Make Sales','Close clients and use talent to fulfill the work.']].map(([n,t,d])=><motion.div variants={staggerItem} key={n} className="card rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none sm:p-7"><div className="text-sm font-bold text-accent">{n}</div><h3 className="font-display mt-7 text-xl font-bold text-card-foreground sm:mt-10">{t}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{d}</p></motion.div>)}
      </motion.div>
    </section>

    <section id="services" className="border-y border-border bg-card/60 py-20 sm:py-24">
      <div className="container">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><p className="text-sm font-bold uppercase tracking-[.18em] text-accent">Explore the ecosystem</p><h2 className="font-display mt-4 text-4xl font-extrabold text-foreground sm:text-5xl">Services built to sell.</h2></div>
          <a href="#samples" className="inline-flex items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-accent">Explore work samples <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
        <motion.div variants={stagger} initial={reduceMotion ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: .12 }} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map(([title,text],i)=><motion.div variants={staggerItem} key={title+String(i)} className="card group rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-accent/50 motion-reduce:transform-none"><div className="flex items-center justify-between"><span className="text-xs font-bold text-muted-foreground">{String(i+1).padStart(2,'0')}</span><ArrowRight size={17} aria-hidden="true" className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-accent"/></div><h3 className="font-display mt-8 text-lg font-bold text-card-foreground sm:mt-10">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></motion.div>)}
        </motion.div>
      </div>
    </section>

    <motion.section id="samples" variants={reveal} initial={reduceMotion ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: .12 }} className="container py-20 sm:py-24">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div><p className="text-sm font-bold uppercase tracking-[.18em] text-accent">The work library</p><h2 className="font-display mt-4 text-4xl font-extrabold text-foreground sm:text-5xl">See what you can sell.</h2><p className="mt-5 max-w-xl leading-7 text-muted-foreground">These cards are service formats, not finished client jobs. Real samples are added when a project is published.</p></div>
        <a href="#samples" className="inline-flex items-center gap-2 text-sm font-bold text-foreground transition-colors hover:text-accent">Format preview library <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {samples.map((sample,i)=>{ const title=Array.isArray(sample)?sample[0]:sample.title; const cat=Array.isArray(sample)?sample[1]:(sample.category||'Sample'); const media=Array.isArray(sample)?'':sample.media_url; return <div key={title+String(i)} className="card group overflow-hidden rounded-3xl transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none"><div className="relative aspect-[16/10] overflow-hidden bg-muted">{media ? <img src={media} alt={title} className="h-full w-full object-cover"/> : <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(var(--accent)/.18),transparent_35%),linear-gradient(135deg,rgb(var(--primary)/.28),rgb(var(--background)))]"/>}<div className="absolute inset-0 flex items-center justify-center"><div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card/90 text-accent shadow-card backdrop-blur"><Play size={19} fill="currentColor" aria-hidden="true"/></div></div><span className="absolute left-4 top-4 rounded-full border border-border bg-card/90 px-3 py-1 text-xs font-semibold text-accent backdrop-blur">{cat}</span></div><div className="flex items-center justify-between gap-3 p-5"><h3 className="font-display font-bold text-card-foreground">{title}</h3><span className="shrink-0 text-xs text-muted-foreground">{media ? 'Live' : 'Format'}</span></div></div>})}
      </div>
    </motion.section>

    <section id="start" className="relative isolate overflow-hidden border-y border-border bg-background py-20 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(var(--primary)/.13),transparent_65%),radial-gradient(ellipse_at_top_right,rgb(var(--accent)/.07),transparent_45%)]" />
      <div className="container relative mx-auto max-w-4xl text-center">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-accent">Start building</p>
        <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">Your next sale starts with the right service.</h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">Join DropVerse and turn professional talent into a business.</p>
        <Link href={ctaFor(signedIn, '/login')} className="brand-button-primary mt-9 inline-flex min-h-12 items-center gap-3 rounded-full px-7 py-4 font-bold">
          {signedIn ? 'Create Project' : 'Get Started'} <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>

    <footer className="border-t border-border bg-background py-10 sm:py-12">
      <div className="container flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-3"><Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover shadow-soft"/><div className="font-display text-xl font-extrabold tracking-[.12em] text-foreground">DROP<span className="text-accent">VERSE</span></div></div>
          <p className="mt-2 text-xs uppercase tracking-[.16em] text-muted-foreground">Linking talent to sales</p>
          <a href="mailto:dropverseagency@gmail.com" className="mt-3 inline-block text-sm font-semibold text-foreground transition-colors hover:text-accent">dropverseagency@gmail.com</a>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <a href="#services" className="transition-colors hover:text-foreground">Services</a><a href="#how" className="transition-colors hover:text-foreground">How It Works</a><a href="#samples" className="transition-colors hover:text-foreground">Work Samples</a><Link href="/earn" className="transition-colors hover:text-foreground">Earn With DropVerse</Link><a href="mailto:dropverseagency@gmail.com" className="transition-colors hover:text-foreground">Contact</a><Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link><Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
        </nav>
        <p className="text-xs text-muted-foreground">© 2026 DropVerse. All rights reserved.</p>
      </div>
    </footer>
  </main>
}

function Feature({icon,title,text}:{icon:React.ReactNode,title:string,text:string}){return <div><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-primary">{icon}</div><h3 className="font-display font-bold text-foreground">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>}
