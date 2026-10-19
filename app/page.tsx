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
import HeroBackdrop from '../components/HeroBackdrop'

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
            <Link href="/leads" className="hover:text-[#e2b656]">Lead Marketplace</Link>
            <Link href="/earn" className="font-semibold text-[#e2b656] hover:text-[#f6de9d]">Become a Partner</Link>
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
              <Link href="/leads" className="text-[#e2b656]" onClick={() => setMenu(false)}>Lead Marketplace →</Link>
              <Link href="/earn" className="text-[#e2b656]" onClick={() => setMenu(false)}>Become a Partner →</Link>
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

      <section className="grid-bg relative flex min-h-[88vh] items-center overflow-hidden pt-20">
        <HeroBackdrop />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[rgba(226,182,86,0.04)] blur-[100px]" />
        <div className="container relative grid items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div variants={reveal} initial={reduceMotion ? false : 'hidden'} animate="show">
            <motion.div variants={reveal} className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(226,182,86,0.25)] bg-[rgba(226,182,86,0.08)] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#e2b656]">
              <Sparkles size={13} /> Linking talent to sales
            </motion.div>
            <motion.h1 variants={reveal} className="font-display text-[2.35rem] font-extrabold leading-[1.08] tracking-[-0.04em] sm:text-[2.75rem] lg:text-[3.25rem]">
              Pitch Proven Samples.{" "}
              <span className="gold-gradient">Close High-Paying Clients.</span>{" "}
              Keep the Profit Margin.
            </motion.h1>
            <motion.p variants={reveal} className="mt-6 max-w-xl text-base leading-7 text-[#e2e8f0] sm:text-lg">
              DropVerse empowers agencies and drop-servicers to scale faster. Access a curated vault of verified freelancer portfolios, white-label client proposals, and automated client acquisition assets — zero upfront hiring needed.
            </motion.p>
            <motion.div variants={reveal} className="mt-8 flex flex-wrap gap-3">
              <Link href="/samples" className="brand-button-primary group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold">
                Explore Samples Vault
                <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </Link>
              <a href="#how" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-white transition hover:border-[rgba(226,182,86,0.4)]">
                How It Works <ChevronRight size={17} />
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
