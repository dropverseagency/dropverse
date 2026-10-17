'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Menu,
  Play,
  Sparkles,
  Users,
  Zap,
  Globe,
  Layers,
  X,
  LogOut,
  ShieldCheck,
  Clock,
} from 'lucide-react'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { ctaFor } from '../lib/authCta'
import Brand from '../components/Brand'
import DodoSampleCheckout from '../components/DodoSampleCheckout'

const fallbackServices = [
  ['Video Editing', 'Reels, TikTok, Shorts, ads & long-form content.'],
  ['Graphic Design', 'Branding, social creatives, ads & marketing assets.'],
  ['Web Design', 'Modern landing pages, stores and conversion-focused websites.'],
  ['Social Media Content', 'Content systems built to keep brands consistent.'],
  ['UGC Content', 'Authentic creator content designed to drive action.'],
  ['Copywriting', 'Hooks, scripts, landing pages and sales copy.'],
  ['Branding', 'Visual identities that make businesses memorable.'],
  ['Motion Graphics', 'Animated visuals, promos and high-impact content.'],
]

const fallbackSamples = [
  { title: 'Short-Form Video', category: 'Video Editing', media_url: '' },
  { title: 'Luxury Brand Creative', category: 'Graphic Design', media_url: '' },
  { title: 'SaaS Landing Page', category: 'Web Design', media_url: '' },
]

const luxuryEase = [0.23, 1, 0.32, 1] as const
const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.72, ease: luxuryEase } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.075 } } }
const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: luxuryEase } },
}

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
        className="flex items-center gap-2 rounded-full border border-[rgba(226,182,86,0.35)] bg-[rgba(226,182,86,0.08)] px-4 py-2 text-sm font-semibold text-[#e2b656] transition hover:border-[rgba(226,182,86,0.6)] hover:bg-[rgba(226,182,86,0.14)]"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e2b656] text-xs font-bold text-[#071f1d]">
          {(user.name || user.email || '?').trim().charAt(0).toUpperCase()}
        </span>
        <span className="max-w-[10rem] truncate">{user.name || user.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#101c19] shadow-xl">
          {isAdmin ? (
            <Link href="/admin" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm font-bold text-[#e2b656] transition hover:bg-white/5">
              Admin Panel
            </Link>
          ) : null}
          <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-[#e2e8f0] transition hover:bg-white/5">
            Dashboard
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[#e2e8f0] transition hover:bg-white/5 disabled:opacity-60"
          >
            <LogOut size={15} /> {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [menu, setMenu] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [liveServices, setLiveServices] = useState<[string, string][] | null>(null)
  const [liveSamples, setLiveSamples] = useState<{ id: string; title: string; category?: string; media_url?: string }[] | null>(null)
  const [sampleFilter, setSampleFilter] = useState<string>('All')
  const auth = useAuth()
  const services = liveServices ?? fallbackServices
  const samples = liveSamples ?? fallbackSamples
  const signedIn = !auth.loading && Boolean(auth.user)
  const reduceMotion = useReducedMotion()

  const sampleCategories = useMemo(() => {
    const cats = new Set<string>()
    samples.forEach((s) => {
      const cat = Array.isArray(s) ? String(s[1]) : s.category || 'Sample'
      cats.add(cat)
    })
    return ['All', ...Array.from(cats)]
  }, [samples])

  const filteredSamples = useMemo(() => {
    if (sampleFilter === 'All') return samples
    return samples.filter((s) => {
      const cat = Array.isArray(s) ? String(s[1]) : s.category || 'Sample'
      return cat === sampleFilter
    })
  }, [samples, sampleFilter])

  useEffect(() => {
    let cancelled = false
    fetch('/api/public/catalog')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (Array.isArray(j.services) && j.services.length) {
          setLiveServices(j.services.map((s: { title: string; description?: string }) => [s.title, s.description || 'Published service']))
        }
        if (Array.isArray(j.samples) && j.samples.length) setLiveSamples(j.samples)
      })
      .catch(() => undefined)
    const supa = createClient()
    supa.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      supa
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data: prof }) => {
          if (!cancelled && prof && prof.role === 'admin') setIsAdmin(true)
        })
    })
    return () => {
      cancelled = true
    }
  }, [signedIn])

  return (
    <main className="overflow-hidden bg-[#061916] text-white">
      <header className="brand-header fixed left-0 right-0 top-0 z-50 border-b border-white/5 backdrop-blur-xl">
        <div className="container flex h-[4.5rem] items-center justify-between">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-[#e2b656] sm:inline">
              Linking talent to sales
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-[#e2e8f0] md:flex">
            <a href="#services" className="hover:text-[#e2b656]">Services</a>
            <a href="#how" className="hover:text-[#e2b656]">How it works</a>
            <a href="#samples" className="hover:text-[#e2b656]">Work</a>
            <Link href="/earn" className="font-semibold text-[#e2b656] hover:text-[#f6de9d]">Earn</Link>
            <Link href="/pricing" className="hover:text-[#e2b656]">Pricing</Link>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            {signedIn && auth.user ? (
              <>
                {isAdmin && (
                  <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(226,182,86,0.4)] bg-[rgba(226,182,86,0.12)] px-3.5 py-2 text-sm font-bold text-[#e2b656] transition hover:bg-[rgba(226,182,86,0.22)]">
                    <ShieldCheck size={16} className="shrink-0 md:hidden" aria-label="Admin Panel" />
                    <span className="hidden md:inline">Admin</span>
                  </Link>
                )}
                <UserMenu user={auth.user} isAdmin={isAdmin} />
              </>
            ) : (
              <Link href="/login" className="px-4 py-2 text-sm text-[#e2e8f0]">{auth.loading ? '' : 'Log in'}</Link>
            )}
            <a href="#start" className="brand-button-primary rounded-full px-5 py-2.5 text-sm font-bold">Get started</a>
          </div>
          <div className="flex items-center gap-2.5 md:hidden">
            {isAdmin ? (
              <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(226,182,86,0.4)] bg-[rgba(226,182,86,0.12)] text-[#e2b656]" aria-label="Admin Panel">
                <ShieldCheck size={17} />
              </Link>
            ) : null}
            <button onClick={() => setMenu(!menu)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[#e2e8f0]" aria-label="Menu">
              {menu ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="border-t border-white/5 bg-[#071f1d] p-5 md:hidden">
            <div className="container flex flex-col gap-5 text-[#e2e8f0]">
              <a href="#services" onClick={() => setMenu(false)}>Services</a>
              <a href="#how" onClick={() => setMenu(false)}>How it works</a>
              <a href="#samples" onClick={() => setMenu(false)}>Work</a>
              <Link href="/earn" className="text-[#e2b656]" onClick={() => setMenu(false)}>Earn With DropVerse →</Link>
              <Link href="/pricing" onClick={() => setMenu(false)}>Pricing</Link>
              {isAdmin ? <Link href="/admin" className="font-bold text-[#e2b656]" onClick={() => setMenu(false)}>Admin Panel →</Link> : null}
              {signedIn ? (
                <Link href="/dashboard" className="text-[#e2b656]" onClick={() => setMenu(false)}>Dashboard →</Link>
              ) : (
                <Link href="/login" className="text-[#e2b656]">Get Started →</Link>
              )}
            </div>
          </div>
        )}
      </header>

      <section className="grid-bg relative flex min-h-[88vh] items-center pt-20">
        <div className="absolute left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[rgba(226,182,86,0.06)] blur-[100px]" />
        <div className="container relative grid items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div variants={reveal} initial={reduceMotion ? false : 'hidden'} animate="show">
            <motion.div variants={reveal} className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(226,182,86,0.25)] bg-[rgba(226,182,86,0.08)] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#e2b656]">
              <Sparkles size={13} /> Linking talent to sales
            </motion.div>
            <motion.h1 variants={reveal} className="font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-[3.6rem]">
              Bridge the gap between <span className="gold-gradient">freelance talent</span> &amp; high-paying clients
            </motion.h1>
            <motion.p variants={reveal} className="mt-6 max-w-lg text-base leading-7 text-[#e2e8f0] sm:text-lg">
              DropVerse is the workspace platform for digital teams — manage services, pitch samples, run projects, and scale fulfillment in one place.
            </motion.p>
            <motion.div variants={reveal} className="mt-8 flex flex-wrap gap-3">
              <Link href={ctaFor(signedIn, '/login')} className="brand-button-primary group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold">
                {signedIn ? 'Create project' : 'Start your journey'}
                <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#samples" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white transition hover:border-[rgba(226,182,86,0.4)]">
                Browse work samples <ChevronRight size={17} />
              </a>
            </motion.div>
            <motion.div variants={reveal} className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-sm text-[#e2e8f0]/90">
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#e2b656]" /> Centralized workspaces</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#e2b656]" /> Service catalog</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-[#e2b656]" /> Agency storefronts</span>
            </motion.div>
          </motion.div>

          <motion.div variants={reveal} initial={reduceMotion ? false : 'hidden'} animate="show" className="relative hidden lg:block">
            <div className="glow float-slow rounded-3xl border border-[rgba(226,182,86,0.18)] bg-[#101c19] p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e2b656]">Project board</p>
                <span className="rounded-full bg-[rgba(226,182,86,0.12)] px-2.5 py-1 text-[10px] font-semibold text-[#e2b656]">Live</span>
              </div>
              <div className="space-y-3">
                {[['Video edit — product launch', 'In progress', '48h'], ['Brand kit refresh', 'In review', '3d'], ['Landing page — SaaS', 'Ready', '5d']].map(([title, status, eta]) => (
                  <div key={title} className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#061916]/70 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-xs text-[#e2e8f0]/70">{status}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#e2e8f0]">
                      <Clock size={11} /> {eta}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[['12', 'Active'], ['8', 'Services'], ['94%', 'On time']].map(([n, l]) => (
                  <div key={l} className="rounded-xl bg-[#061916]/80 px-3 py-2 text-center">
                    <p className="font-display text-lg font-bold text-[#e2b656]">{n}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[#e2e8f0]/70">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="about" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container">
          <p className="eyebrow">Platform tools</p>
          <h2 className="font-display mt-3 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">Everything digital teams need in one workspace</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={<Users size={18} />} title="Team collaboration" text="Shared workspaces, roles, and client-ready project views." />
            <Feature icon={<Layers size={18} />} title="Workflow templates" text="Reusable delivery systems for recurring digital services." />
            <Feature icon={<Zap size={18} />} title="Scale your workspace" text="Grow from solo operator to agency without switching tools." />
            <Feature icon={<Globe size={18} />} title="One platform" text="Catalog, orders, samples, and agency pages — connected." />
          </div>
        </div>
      </section>

      <section id="how" className="section-pad">
        <div className="container">
          <p className="eyebrow">How it works</p>
          <h2 className="font-display mt-3 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">From sample to sale in four steps</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-white/8 bg-white/5 md:grid-cols-4">
            {[['01', 'Pick a sample', 'Browse proven service formats and formats you can sell.'], ['02', 'Pitch the client', 'Share the sample, price, and turnaround with confidence.'], ['03', 'Fulfill the work', 'Run the project in DropVerse with clear status and assets.'], ['04', 'Keep the margin', 'You sell. DropVerse helps you deliver and scale.']].map(([n, t, d]) => (
              <div key={n} className="bg-[#101c19] p-7">
                <div className="text-sm font-bold text-[#e2b656]">{n}</div>
                <h3 className="font-display mt-10 text-xl font-bold">{t}</h3>
                <p className="mt-3 text-sm leading-6 text-[#e2e8f0]/75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="services" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Services</p>
              <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Built to sell</h2>
            </div>
            <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-bold text-[#e2b656]">View plans <ArrowRight size={16} /></Link>
          </div>
          <motion.div variants={stagger} initial={reduceMotion ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.12 }} className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map(([title, text], i) => (
              <motion.div key={title + String(i)} variants={staggerItem} className="bento-card group p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#e2e8f0]/50">0{i + 1}</span>
                  <ArrowRight size={16} className="text-[#e2e8f0]/40 transition group-hover:translate-x-1 group-hover:text-[#e2b656]" />
                </div>
                <h3 className="font-display mt-8 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#e2e8f0]/75">{text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <motion.section id="samples" variants={reveal} initial={reduceMotion ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount: 0.12 }} className="section-pad">
        <div className="container">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">Work library</p>
              <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">See what you can sell</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#e2e8f0]/75">Clean sample cards with category filters and checkout. Live samples appear when published.</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {sampleCategories.map((cat) => (
              <button key={cat} type="button" onClick={() => setSampleFilter(cat)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${sampleFilter === cat ? 'bg-[#e2b656] text-[#071f1d]' : 'border border-white/10 bg-white/[0.03] text-[#e2e8f0] hover:border-[rgba(226,182,86,0.35)]'}`}>{cat}</button>
            ))}
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {filteredSamples.map((sample, i) => {
              const title = Array.isArray(sample) ? sample[0] : sample.title
              const cat = Array.isArray(sample) ? sample[1] : sample.category || 'Sample'
              const media = Array.isArray(sample) ? '' : sample.media_url
              const sampleId = !Array.isArray(sample) && 'id' in sample ? sample.id : undefined
              return (
                <div key={title + String(i)} className="bento-card group overflow-hidden">
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#071f1d]">
                    {media ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={media} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(226,182,86,.18),transparent_40%),linear-gradient(135deg,#101c19,#071f1d)]" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(226,182,86,0.35)] bg-[rgba(7,31,29,0.75)] text-[#e2b656] backdrop-blur">
                        <Play size={18} fill="currentColor" />
                      </div>
                    </div>
                    <span className="absolute left-3 top-3 rounded-full bg-[rgba(7,31,29,0.85)] px-2.5 py-1 text-[11px] font-semibold text-[#e2b656] backdrop-blur">{cat}</span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-base font-bold">{title}</h3>
                      <span className="shrink-0 text-[11px] text-[#e2e8f0]/50">{media ? 'Live' : 'Format'}</span>
                    </div>
                    <div className="mt-4"><DodoSampleCheckout sampleId={sampleId} /></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </motion.section>

      <section id="start" className="section-pad border-t border-white/5 bg-[#071f1d]">
        <div className="container text-center">
          <p className="eyebrow">Get started</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to build?</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-[#e2e8f0]/75">Create your workspace and start managing digital projects, samples, and agency storefronts in one place.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href={ctaFor(signedIn, '/login')} className="brand-button-primary rounded-full px-8 py-3.5 text-sm font-bold">{signedIn ? 'Go to dashboard' : 'Create account'}</Link>
            <Link href="/pricing" className="rounded-full border border-white/15 px-8 py-3.5 text-sm font-semibold text-white transition hover:border-[rgba(226,182,86,0.4)]">View pricing</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <Brand compact />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#e2b656]/80">Linking talent to sales</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-[#e2e8f0]/70">
            <Link href="/privacy" className="hover:text-[#e2b656]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#e2b656]">Terms</Link>
            <Link href="/refund" className="hover:text-[#e2b656]">Refund</Link>
            <Link href="/pricing" className="hover:text-[#e2b656]">Pricing</Link>
          </div>
          <p className="text-sm text-[#e2e8f0]/50">© {new Date().getFullYear()} DropVerse</p>
        </div>
      </footer>
    </main>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="bento-card p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(226,182,86,0.2)] bg-[rgba(226,182,86,0.08)] text-[#e2b656]">{icon}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#e2e8f0]/75">{text}</p>
    </div>
  )
}
