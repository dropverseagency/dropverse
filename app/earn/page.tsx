'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, ChevronRight, Copy, Facebook, Share2, TrendingUp, Users, Zap, Link2, DollarSign, Activity, X, Menu, ShieldCheck } from 'lucide-react'
import { REFERRAL_TIERS, referralLinkFor } from '../../lib/referralConfig'

// Affiliate partnership deadline: on Jan 1, 2027 (UTC) the lifetime-partner offer closes.
export const PARTNERSHIP_DEADLINE = '2027-01-01T00:00:00Z'

function useCountdown() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const deadline = new Date(PARTNERSHIP_DEADLINE).getTime()
  const remaining = Math.max(0, deadline - now)
  const d = Math.floor(remaining / 86_400_000)
  const h = Math.floor((remaining % 86_400_000) / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  const s = Math.floor((remaining % 60_000) / 1000)
  return { remaining, d, h, m, s, isClosed: remaining === 0 }
}

function CountdownBanner() {
  const { remaining, d, h, m, s, isClosed } = useCountdown()
  if (isClosed) return null
  const units: [number, string][] = [
    [d, 'days'], [h, 'hrs'], [m, 'min'], [s, 'sec'],
  ]
  return (
    <div className="mb-6 inline-flex flex-col items-center gap-2 rounded-2xl border border-[rgba(216,180,90,0.45)] bg-gradient-to-r from-[rgba(216,180,90,0.14)] to-[rgba(216,180,90,0.05)] px-6 py-4 sm:px-8 sm:py-5">
      <div className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-[.14em] text-[#f0d98b]">
        <Zap size={15} className="text-[#d8b45a]"/> Lifetime Partner Offer Ends
      </div>
      <div className="flex items-center gap-3">
        {units.map(([v, label]) => (
          <div key={label} className="flex flex-col items-center">
            <div className="min-w-[3rem] rounded-lg border border-[rgba(216,180,90,0.30)] bg-[rgba(7,31,29,0.65)] px-2 py-2 text-center font-display text-2xl font-extrabold tabular-nums text-[#f0d98b]">
              {String(v).padStart(2, '0')}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[.18em] text-[#879b95]">{label}</div>
          </div>
        ))}
      </div>
      <div className="max-w-md text-center text-xs text-[#aebcb7]">
        Become a DropVerse partner <span className="font-bold text-[#f0d98b]">for life</span> before&nbsp;
        <span className="font-bold text-white">Jan 1, 2027</span> — after that, the affiliate partnership closes.
      </div>
    </div>
  )
}
import { createClient } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { ctaFor } from '../../lib/authCta'

const shareUrl = referralLinkFor('YOURCODE')

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
            <X size={15} /> {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function EarnPage() {
  const [menu, setMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)

    // Admin check derived DIRECTLY from the signed-in session + profile role.
  useEffect(() => {
    let cancelled = false
    const supa = createClient()
    supa.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      supa.from('profiles').select('role').eq('id', user.id).single().then(({ data: prof }) => {
        if (!cancelled && prof && prof.role === 'admin') setIsAdmin(true)
      })
    })
    return () => { cancelled = true }
  }, [signedIn])
function copyLink() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <main className="overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[rgba(7,31,29,0.80)] backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="DropVerse home">
            <Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover" priority/>
            <span className="font-display text-xl font-extrabold tracking-[.16em]">DROP<span className="text-[#d8b45a]">VERSE</span></span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-[#c1cbc7] md:flex">
            <a href="#two-ways" className="hover:text-[#f0d98b]">Two Ways to Earn</a>
            <a href="#commissions" className="hover:text-[#f0d98b]">Commissions</a>
            <a href="#faq" className="hover:text-[#f0d98b]">FAQ</a>
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
            <a href="#start-earning" className="rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">Start Earning</a>
          </div>
          <div className="flex items-center gap-2.5 md:hidden">
            {isAdmin ? (
              <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.12)] text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.22)]" aria-label="Admin Panel" title="Admin Panel">
                <ShieldCheck size={17} />
              </Link>
            ) : null}
            <button onClick={() => setMenu(!menu)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[#c1cbc7]" aria-label="Menu">{menu ? <X size={17}/> : <Menu size={17}/>}</button>
          </div>
        </div>
        {menu && (
          <div className="border-t border-white/5 bg-[#071f1d] p-5 md:hidden">
            <div className="container flex flex-col gap-5 text-[#d9e0dc]">
              <a href="#two-ways" onClick={() => setMenu(false)}>Two Ways to Earn</a>
              <a href="#commissions" onClick={() => setMenu(false)}>Commissions</a>
              <a href="#faq" onClick={() => setMenu(false)}>FAQ</a>
              {isAdmin ? <Link href="/admin" className="font-bold text-[#f0d98b]" onClick={() => setMenu(false)}>Admin Panel →</Link> : null}
              {signedIn ? (
                <Link href="/dashboard" className="text-[#d8b45a]">Dashboard →</Link>
              ) : (
                <Link href="/login" className="text-[#d8b45a]">Start Earning →</Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="grid-bg relative flex min-h-screen items-center pt-20">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[rgba(216,180,90,0.05)] blur-[100px]"/>
        <div className="container relative grid items-center gap-14 py-24 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <CountdownBanner/>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] px-4 py-2 text-xs font-semibold uppercase tracking-[.2em] text-[#e4c979]">
              <Zap size={14}/> DropVerse Partner Program
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-[-.04em] sm:text-6xl lg:text-[72px]">
              Build Active Income.<br/>Build Passive Income.<br/><span className="gold-gradient">Or Build Both.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#aebcb7]">
              Sell digital services to clients, refer entrepreneurs to DropVerse, or combine both models into one scalable business.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={ctaFor(signedIn, '/login')} className="group flex items-center gap-3 rounded-full bg-[#d8b45a] px-6 py-3.5 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
                {signedIn ? 'Create Project' : 'Start Earning'} <ArrowRight size={18} className="transition group-hover:translate-x-1"/>
              </Link>
              <a href="#two-ways" className="flex items-center gap-2 rounded-full border border-white/10 px-6 py-3.5 font-semibold text-white transition hover:border-[rgba(216,180,90,0.40)]">
                See How It Works <ChevronRight size={18}/>
              </a>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#879b95]">
              <span className="flex items-center gap-2"><Check size={15} className="text-[#d8b45a]"/> Performance-based</span>
              <span className="flex items-center gap-2"><Check size={15} className="text-[#d8b45a]"/> Earn on real activity</span>
              <span className="flex items-center gap-2"><Check size={15} className="text-[#d8b45a]"/> Multiple revenue streams</span>
            </div>
          </div>

          {/* Income paths visual */}
          <div className="relative mx-auto w-full max-w-[500px]">
            <div className="card glow relative overflow-hidden rounded-[28px] p-5">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-[.18em] text-[#718781]">DropVerse Partner Program</div>
                  <div className="mt-1 font-display font-bold">Two income paths</div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(216,180,90,0.10)] text-[#d8b45a]"><Users size={17}/></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ['01', 'ACTIVE', ['Clients','Projects','Revenue']],
                  ['02', 'PASSIVE', ['Referrals','Active Users','Projects','Commissions']],
                ] as [string, string, string[]][]).map(([n, kind, steps], i) => (
                  <div key={n as string} className="rounded-2xl border border-white/5 bg-white/[.025] p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(216,180,90,0.10)] text-[10px] font-bold text-[#d8b45a]">{n}</div>
                      <div className="font-display text-xs font-bold uppercase tracking-[.14em] text-[#e4c979]">{kind}</div>
                    </div>
                    <div className="mt-4 space-y-1 text-sm text-[#9aaba6]">
                      <div className="font-semibold text-[#d9e0dc]">You</div>
                      <div className="pl-1 text-[#536963]">↓</div>
                      {steps.map((s, j) => (
                        <span key={s} className="block">
                          {j > 0 && <span className="text-[#536963]">→ </span>}{s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-[rgba(216,180,90,0.15)] bg-[rgba(216,180,90,0.05)] p-4 text-center">
                <span className="font-display text-sm font-bold tracking-wide text-[#f0d98b]">ACTIVE + PASSIVE = MULTIPLE REVENUE STREAMS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1 — TWO WAYS */}
      <section id="two-ways" className="border-y border-white/5 bg-[#0a2926] py-24">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">The two ways to earn</p>
            <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Two engines. One platform.</h2>
            <p className="mt-5 text-[#91a39e]">Choose the path that fits your strengths — or run both in parallel.</p>
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {/* ACTIVE */}
            <div className="card group rounded-3xl border border-white/5 bg-[#071f1d] p-8 transition duration-300 hover:-translate-y-1 hover:border-[rgba(216,180,90,0.40)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]"><Zap size={20}/></div>
                <div className="font-display text-xs font-bold uppercase tracking-[.16em] text-[#e4c979]">Active Income</div>
              </div>
              <h3 className="font-display mt-6 text-3xl font-extrabold">Sell. Deliver. Earn.</h3>
              <p className="mt-4 leading-7 text-[#8f9f9a]">
                You find clients and sell services available through DropVerse. You control the sales process while DropVerse gives you access to professional talent and services to help fulfill the work.
              </p>
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/5 bg-white/[.025]">
                {['Find a Client','Choose a Service','Close the Deal','DropVerse Talent Fulfills','You Earn'].map((s, i) => (
                  <div key={s} className="flex items-center gap-4 p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(216,180,90,0.10)] text-[11px] font-bold text-[#d8b45a]">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-semibold text-[#d9e0dc]">{s}</span>
                    {i < 4 && <ArrowRight size={15} className="ml-auto text-[#536963]"/>}
                  </div>
                ))}
              </div>
              <ul className="mt-6 grid gap-2 text-sm text-[#9aaba6] sm:grid-cols-2">
                {['You control your sales','Choose which services to sell','Build your own client base','Scale by selling more','No need to perform every service yourself'].map(b => (
                  <li key={b} className="flex items-center gap-2"><Check size={14} className="text-[#d8b45a]"/>{b}</li>
                ))}
              </ul>
              <Link href={ctaFor(signedIn, '/login')} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">{signedIn ? 'Create Project' : 'Start Selling'} <ArrowRight size={16}/></Link>
            </div>

            {/* PASSIVE */}
            <div className="card group rounded-3xl border border-white/5 bg-[#071f1d] p-8 transition duration-300 hover:-translate-y-1 hover:border-[rgba(216,180,90,0.40)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]"><TrendingUp size={20}/></div>
                <div className="font-display text-xs font-bold uppercase tracking-[.16em] text-[#e4c979]">Passive / Referral Income</div>
              </div>
              <h3 className="font-display mt-6 text-3xl font-extrabold">Refer. Grow. Earn.</h3>
              <p className="mt-4 leading-7 text-[#8f9f9a]">
                Share your personal DropVerse referral link with entrepreneurs who want to build their own Drop Servicing business. When referred users generate eligible activity and projects, you can earn referral commissions according to the DropVerse Partner Program.
              </p>
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/5 bg-white/[.025]">
                {['Share Your Link','Someone Joins','They Build Their Business','They Generate Projects','You Earn Eligible Commissions'].map((s, i) => (
                  <div key={s} className="flex items-center gap-4 p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(216,180,90,0.10)] text-[11px] font-bold text-[#d8b45a]">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-semibold text-[#d9e0dc]">{s}</span>
                    {i < 4 && <ArrowRight size={15} className="ml-auto text-[#536963]"/>}
                  </div>
                ))}
              </div>
              <ul className="mt-6 grid gap-2 text-sm text-[#9aaba6] sm:grid-cols-2">
                {['No need to sell every project','Build a network of active users','Earn from real platform activity','Create another potential revenue stream','Keep growing your referral network'].map(b => (
                  <li key={b} className="flex items-center gap-2"><Check size={14} className="text-[#d8b45a]"/>{b}</li>
                ))}
              </ul>
              <Link href={ctaFor(signedIn, '/login')} className="mt-8 inline-flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.06)] px-6 py-3 font-bold text-[#f0d98b] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.12)]">{signedIn ? 'My Dashboard' : 'Become a Partner'} <ArrowRight size={16}/></Link>
            </div>
          </div>
          <p className="mt-8 text-sm leading-6 text-[#7d908a]">
            <span className="font-semibold text-[#9aaba6]">Important:</span> Referral commissions are tied to eligible real activity and projects — not simply signing people up.
          </p>
        </div>
      </section>

      {/* SECTION 2 — WHY CHOOSE ONE */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(216,180,90,0.05)] blur-[100px]"/>
        <div className="container relative text-center">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Combine both models</p>
          <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Why Choose One?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-[#91a39e]">The smartest DropVerse users can combine both models.</p>
          <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
              <div className="font-display text-xs font-bold uppercase tracking-[.14em] text-[#e4c979]">Active</div>
              <div className="mt-2 text-sm text-[#9aaba6]">Client acquisition</div>
            </div>
            <div className="flex items-center justify-center text-2xl font-extrabold text-[#d8b45a]">+</div>
            <div className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
              <div className="font-display text-xs font-bold uppercase tracking-[.14em] text-[#e4c979]">Passive</div>
              <div className="mt-2 text-sm text-[#9aaba6]">Referral acquisition</div>
            </div>
          </div>
          <div className="mx-auto mt-4 max-w-xl rounded-full border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.06)] px-6 py-3 text-sm font-bold uppercase tracking-[.14em] text-[#f0d98b]">
            = Multiple Revenue Streams
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-[#8f9f9a]">
            You can actively sell services to your own clients while building a referral network in parallel.
          </p>
          <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-white/5 bg-white/[.025] p-7 text-left">
            <div className="text-xs font-bold uppercase tracking-[.16em] text-[#d8b45a]">How it looks in practice</div>
            <ol className="mt-5 space-y-3 text-sm leading-7 text-[#9aaba6]">
              {['You generate your own client projects.','At the same time, you refer another entrepreneur to DropVerse.','That entrepreneur starts using the platform.','They generate eligible projects.','You may earn referral commissions from their eligible activity.'].map((s, i) => (
                <li key={i} className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(216,180,90,0.10)] text-[11px] font-bold text-[#d8b45a]">{i + 1}</span>{s}</li>
              ))}
            </ol>
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-xl border border-white/5 bg-white/[.03] p-3 text-center text-sm font-semibold text-[#d9e0dc]">Your Sales</div>
              <div className="hidden text-center text-[#d8b45a] sm:block">+</div>
              <div className="rounded-xl border border-white/5 bg-white/[.03] p-3 text-center text-sm font-semibold text-[#d9e0dc]">Your Referral Network</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — CHOOSE YOUR PATH */}
      <section className="border-y border-white/5 bg-[#0a2926] py-24">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Choose your path</p>
            <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Three ways to play.</h2>
            <p className="mt-5 text-[#91a39e]">Pick one path or shift between them as your business evolves.</p>
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {[
              {
                tag: 'Option 1', title: 'Active Only', sub: 'For people who want to focus on selling.',
                items: ['Find clients','Sell services','Use DropVerse talent','Earn from your projects'],
                cta: signedIn ? 'Create Project' : 'Start Selling', href: ctaFor(signedIn, '/login'), featured: false,
              },
              {
                tag: 'Option 2', title: 'Passive / Referral Only', sub: 'For people who prefer building a referral network.',
                items: ['Get your referral link','Share it','Refer entrepreneurs','Earn eligible commissions from their activity'],
                cta: signedIn ? 'My Referrals' : 'Start Referring', href: ctaFor(signedIn, '/login'), featured: false,
              },
              {
                tag: 'Option 3', title: 'Hybrid', sub: 'For people who want to build both.', badge: 'Most Flexible',
                items: ['Sell your own services','Build your referral network','Generate project revenue','Build referral commissions'],
                cta: signedIn ? 'Create Project' : 'Build Both', href: ctaFor(signedIn, '/login'), featured: true,
              },
            ].map(o => (
              <div key={o.title} className={`card relative rounded-3xl border p-8 transition duration-300 hover:-translate-y-1 ${o.featured ? 'border-[rgba(216,180,90,0.35)] bg-[#071f1d] shadow-[0_0_60px_rgba(216,180,90,0.08)]' : 'border-white/5 bg-[#071f1d]'}`}>
                {o.badge && (
                  <span className="absolute right-6 top-6 rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.10)] px-3 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-[#f0d98b]">{o.badge}</span>
                )}
                <div className="text-xs font-bold uppercase tracking-[.16em] text-[#6e817c]">{o.tag}</div>
                <h3 className="font-display mt-3 text-2xl font-extrabold">{o.title}</h3>
                <p className="mt-2 text-sm text-[#8f9f9a]">{o.sub}</p>
                <ul className="mt-6 space-y-3 text-sm text-[#9aaba6]">
                  {o.items.map(i => (
                    <li key={i} className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-[#d8b45a]"/>{i}</li>
                  ))}
                </ul>
                <Link href={o.href} className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 font-bold transition ${o.featured ? 'bg-[#d8b45a] text-[#10221f] hover:bg-[#f0d98b]' : 'border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.06)] text-[#f0d98b] hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.12)]'}`}>
                  {o.cta} <ArrowRight size={16}/>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — REFERRAL PROGRAM */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(216,180,90,0.05)] blur-[100px]"/>
        <div className="container relative grid gap-14 lg:grid-cols-[1fr_.9fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">The referral system</p>
            <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Your Network Can Become Your Growth Engine.</h2>
            <p className="mt-6 leading-7 text-[#8f9f9a]">
              Every registered user can have a unique referral link. When someone joins through your link, the referral is tracked. When the referred user generates eligible projects and activity, you can earn a commission based on the current DropVerse Partner Program terms.
            </p>
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.025] p-5 font-mono text-sm tracking-wide text-[#f0d98b]">
              <div className="text-[10px] uppercase tracking-[.16em] text-[#718781] font-sans">Example link format</div>
              {referralLinkFor('YOURCODE')}
            </div>
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] p-5">
              <Check size={18} className="mt-0.5 shrink-0 text-[#d8b45a]"/>
              <p className="text-sm leading-6 text-[#b9c9c4]">
                The referral relationship remains eligible for commissions for up to <span className="font-bold text-[#f0d98b]">12 months</span>, subject to the program&apos;s terms.
              </p>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[460px]">
            <div className="card glow overflow-hidden rounded-[28px] p-5">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <div className="font-display font-bold">How tracking works</div>
                <Link2 size={17} className="text-[#d8b45a]"/>
              </div>
              <ol className="space-y-4 text-sm">
                {[
                  ['You share your unique link','The referral is tracked'],
                  ['They join and build','You keep building in parallel'],
                  ['They generate eligible projects','You may earn a commission'],
                ].map(([a, b], i) => (
                  <li key={a} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(216,180,90,0.10)] text-[11px] font-bold text-[#d8b45a]">{i + 1}</span>
                    <div className="flex-1 rounded-xl border border-white/5 bg-white/[.025] p-4">
                      <div className="font-semibold text-[#d9e0dc]">{a}</div>
                      <div className="mt-1 flex items-center gap-2 text-[#7d908a]"><ArrowRight size={13}/>{b}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — COMMISSION MODEL */}
      <section id="commissions" className="border-y border-white/5 bg-[#0a2926] py-24">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Transparent commission model</p>
            <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Earn more as you grow.</h2>
            <p className="mt-5 text-[#91a39e]">
              Commissions are a <span className="font-semibold text-[#f0d98b]">percentage of eligible DropVerse profit allocated to referral commissions</span> — not a percentage of total project value.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REFERRAL_TIERS.map(t => (
              <div key={t.name} className="card rounded-2xl border border-white/5 bg-[#071f1d] p-6 transition hover:border-[rgba(216,180,90,0.40)]">
                <div className="font-display text-xs font-bold uppercase tracking-[.14em] text-[#e4c979]">{t.name}</div>
                <div className="mt-6 font-display text-4xl font-extrabold text-[#f0d98b]">{t.ratePct}%</div>
                <div className="mt-3 text-sm text-[#9aaba6]">
                  {t.max === Infinity ? `${t.min}+ active referrals` : `${t.min}–${t.max} active referrals`}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-start">
            <div className="rounded-3xl border border-white/5 bg-white/[.025] p-8">
              <div className="text-xs font-bold uppercase tracking-[.16em] text-[#d8b45a]">Illustrative example</div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  ['Client Project', '$500'],
                  ['Eligible DropVerse Profit', '$150'],
                  ['Referral Commission at 20%', '$30'],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-2xl border border-white/5 bg-[#071f1d] p-5 text-center">
                    <div className="font-display text-2xl font-extrabold text-[#f0d98b]">{v}</div>
                    <div className="mt-2 text-xs leading-5 text-[#9aaba6]">{l}</div>
                  </div>
                ))}
              </div>
              <p className="mt-6 rounded-xl border border-[rgba(216,180,90,0.15)] bg-[rgba(216,180,90,0.04)] p-4 text-sm leading-6 text-[#93a5a0]">
                Example shown for illustration only. Actual earnings depend on eligible project activity, DropVerse economics and applicable program terms. Earnings are not guaranteed.
              </p>
            </div>
            <div className="rounded-3xl border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] p-8">
              <DollarSign size={22} className="text-[#d8b45a]"/>
              <h3 className="font-display mt-4 text-xl font-bold">Profit, not project value</h3>
              <p className="mt-3 text-sm leading-7 text-[#93a5a0]">
                A commission is never a percentage of the total project value you sell. It is calculated only from eligible DropVerse profit, after the platform&apos;s costs on that project. This keeps the program sustainable and aligned with real performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — CLIENT REFERRALS */}
      <section className="py-24">
        <div className="container grid gap-14 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Client referrals</p>
            <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Don&apos;t Have Entrepreneurs To Refer? <span className="gold-gradient">No problem.</span></h2>
            <p className="mt-6 leading-7 text-[#8f9f9a]">
              You can also refer clients. Users can potentially refer clients who need digital services to DropVerse — DropVerse handles fulfillment and you may receive eligible referral compensation.
            </p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/5 bg-white/[.025]">
              {['You Find a Client','Client Needs a Service','You Refer the Opportunity','DropVerse Handles Fulfillment','You Receive Eligible Referral Compensation'].map((s, i, arr) => (
                <div key={s} className="flex items-center gap-4 p-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(216,180,90,0.10)] text-[11px] font-bold text-[#d8b45a]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-semibold text-[#d9e0dc]">{s}</span>
                  {i < arr.length - 1 && <ArrowRight size={15} className="ml-auto text-[#536963]"/>}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-5">
            <div className="card rounded-3xl border border-white/5 bg-[#071f1d] p-7">
              <div className="flex items-center gap-3"><Users size={19} className="text-[#d8b45a]"/><span className="font-display text-sm font-bold uppercase tracking-[.14em] text-[#e4c979]">User Referrals</span></div>
              <p className="mt-4 text-sm leading-7 text-[#93a5a0]">Refer entrepreneurs who join DropVerse and build their own business. Commissions come from their eligible platform activity under the user referral structure.</p>
            </div>
            <div className="card rounded-3xl border border-white/5 bg-[#071f1d] p-7">
              <div className="flex items-center gap-3"><Link2 size={19} className="text-[#d8b45a]"/><span className="font-display text-sm font-bold uppercase tracking-[.14em] text-[#e4c979]">Client Referrals</span></div>
              <p className="mt-4 text-sm leading-7 text-[#93a5a0]">Refer clients who need digital services. Compensation comes from completed client projects under a separate client referral structure.</p>
            </div>
            <p className="text-sm text-[#7d908a]">The two structures are configured independently, so they will never be mixed.</p>
          </div>
        </div>
      </section>

      {/* SECTION 7 — REFERRAL DASHBOARD PREVIEW */}
      <section className="border-y border-white/5 bg-[#0a2926] py-24">
        <div className="container grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Your workspace</p>
            <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">A personal referral dashboard is coming.</h2>
            <p className="mt-5 leading-7 text-[#91a39e]">
              Once you join, you&apos;ll get a dedicated dashboard to track your referral link, network growth, generated projects and earned commissions. Preview below — this is a UI preview for now.
            </p>
          </div>
          <div className="mx-auto w-full max-w-[520px]">
            <div className="card glow overflow-hidden rounded-[28px] p-5">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <div className="font-display font-bold">Your Referral Dashboard</div>
                <span className="rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.10)] px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#f0d98b]">Preview</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(216,180,90,0.10)] text-[#d8b45a]"><Link2 size={16}/></span>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-[.14em] text-[#718781]">Your referral link</div>
                  <div className="mt-0.5 font-mono text-sm text-[#f0d98b]">{referralLinkFor('ABD123')}</div>
                </div>
                <button onClick={copyLink} className="rounded-lg bg-[#d8b45a] px-4 py-2 text-xs font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
                  {copied ? 'Copied!' : <span className="inline-flex items-center gap-1.5"><Copy size={13}/>Copy Link</span>}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[['Referrals','24'],['Active Users','11'],['Projects Generated','37'],['Revenue Generated','$4,850']].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-white/5 bg-white/[.025] p-3.5 text-center">
                    <div className="font-display text-lg font-extrabold text-[#f0d98b]">{v}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#7d908a]">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[['Your Earnings','$485'],['Pending','$120'],['Available','$365']].map(([l, v]) => (
                  <div key={l} className={`rounded-xl border p-3.5 text-center ${l === 'Your Earnings' ? 'border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.06)]' : 'border-white/5 bg-white/[.025]'}`}>
                    <div className="font-display text-lg font-extrabold text-[#f0d98b]">{v}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#7d908a]">{l}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4 text-xs text-[#9aaba6]">
                <span className="font-semibold uppercase tracking-[.1em] text-[#718781]">Share on:</span>
                {['WhatsApp','Facebook','X','Telegram'].map(s => (
                  <span key={s} className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 hover:border-[rgba(216,180,90,0.40)] hover:text-[#f0d98b] cursor-default">{s}</span>
                ))}
                <button onClick={copyLink} className="rounded-full border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.06)] px-3 py-1.5 font-semibold text-[#f0d98b] hover:border-[rgba(216,180,90,0.60)]">
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8 — REFERRAL GROWTH */}
      <section className="py-24">
        <div className="container text-center">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Referral growth</p>
          <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Your Growth Compounds With Real Activity.</h2>
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-4 gap-3">
            {['1 Referral','5 Referrals','20 Referrals','50+ Referrals'].map((s, i) => (
              <div key={s} className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
                <div className="font-display text-sm font-extrabold text-[#f0d98b]">{s}</div>
                {i < 3 && <ArrowRight size={15} className="mt-3 hidden text-[#536963] md:block"/>}
              </div>
            ))}
          </div>
          <div className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-[#9aaba6]">
            {['Network','Activity','Projects','Performance'].map(s => (
              <span key={s} className="flex items-center gap-2"><Activity size={14} className="text-[#d8b45a]"/>{s}</span>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-sm leading-7 text-[#83958f]">
            Growth here is driven by real platform activity — not by numbers on a page. There are no exaggerated income projections because sustainable growth is built on genuine projects and clients.
          </p>
        </div>
      </section>

      {/* SECTION 9 — PASSIVE INCOME POSITIONING */}
      <section className="relative overflow-hidden border-y border-[rgba(216,180,90,0.10)] bg-[#0a2926] py-24">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(216,180,90,0.05)] blur-[100px]"/>
        <div className="container relative text-center">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Passive income, honestly</p>
          <h2 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">Build It Once. <span className="gold-gradient">Keep Growing It.</span></h2>
          <p className="mx-auto mt-6 max-w-2xl leading-7 text-[#93a5a0]">
            The referral model is designed for people who want to build an additional revenue stream without personally handling every project.
          </p>
          <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-[rgba(216,180,90,0.20)] bg-[rgba(216,180,90,0.05)] p-8 text-left">
            <div className="text-xs font-bold uppercase tracking-[.16em] text-[#d8b45a]">What &quot;passive&quot; really means here</div>
            <p className="mt-4 leading-7 text-[#aebcb7]">
              Passive does not mean guaranteed or effortless income. Your referral earnings depend on referred users remaining active and generating eligible projects. We call it <span className="font-bold text-[#f0d98b]">potential passive income</span> — because it reflects what can happen when your network keeps producing real activity.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 10 — WHO IS THIS FOR */}
      <section className="py-24">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Who is this for?</p>
            <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Built for people who build.</h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Freelancers','Turn your network into another revenue stream.'],
              ['Sales People','Use your ability to find clients and opportunities.'],
              ['Marketers','Build referral traffic and monetize your audience.'],
              ['Content Creators','Share DropVerse with your audience.'],
              ['Entrepreneurs','Build your own Drop Servicing business while referring others.'],
              ['Agency Owners','Add DropVerse services and referral revenue to your ecosystem.'],
            ].map(([t, d]) => (
              <div key={t} className="card rounded-2xl border border-white/5 bg-white/[.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-[rgba(216,180,90,0.40)]">
                <h3 className="font-display text-lg font-bold">{t}</h3>
                <p className="mt-2 text-sm leading-6 text-[#849792]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 11 — FAQ */}
      <section id="faq" className="border-y border-white/5 bg-[#0a2926] py-24">
        <div className="container grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">FAQ</p>
            <h2 className="font-display mt-4 text-4xl font-extrabold tracking-tight">Straight answers.</h2>
            <p className="mt-5 text-[#91a39e]">The program is built on transparency — here&apos;s what you should know before you start.</p>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <button key={f.q} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full rounded-2xl border border-white/5 bg-[#071f1d] p-5 text-left transition hover:border-[rgba(216,180,90,0.30)]">
                <div className="flex items-start justify-between gap-4">
                  <span className="font-semibold text-[#d9e0dc]">{f.q}</span>
                  <ChevronRight size={17} className={`mt-1 shrink-0 text-[#d8b45a] transition-transform ${openFaq === i ? 'rotate-90' : ''}`}/>
                </div>
                {openFaq === i && <p className="mt-4 text-sm leading-7 text-[#93a5a0]">{f.a}</p>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="start-earning" className="relative overflow-hidden py-24">
        <div className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(216,180,90,0.06)] blur-[120px]"/>
        <div className="container relative text-center">
          <h2 className="font-display mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">Your Network. Your Sales. <span className="gold-gradient">Your DropVerse Business.</span></h2>
          <p className="mx-auto mt-6 max-w-xl text-[#95a7a1]">Choose your path. Sell actively, build referrals, or combine both.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href={ctaFor(signedIn, '/login')} className="group flex items-center gap-3 rounded-full bg-[#d8b45a] px-7 py-4 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">{signedIn ? 'Create Project' : 'Start Selling'} <ArrowRight size={18} className="transition group-hover:translate-x-1"/></Link>
            <Link href={ctaFor(signedIn, '/login')} className="flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.06)] px-7 py-4 font-bold text-[#f0d98b] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.12)]">{signedIn ? 'My Referrals' : 'Start Referring'} <ArrowRight size={18}/></Link>
          </div>
        </div>
      </section>

      <footer className="py-12"><div className="container flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between"><div><div className="inline-flex items-center gap-3"><Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover"/><div className="font-display text-xl font-extrabold tracking-[.16em]">DROP<span className="text-[#d8b45a]">VERSE</span></div></div><p className="mt-2 text-xs uppercase tracking-[.2em] text-[#6f827c]">Linking talent to sales</p><a href="mailto:dropverseagency@gmail.com" className="mt-2 block text-sm font-semibold text-[#d8b45a] hover:text-[#f0d98b]">dropverseagency@gmail.com</a></div><div className="flex flex-wrap gap-6 text-sm text-[#80938d]"><Link href="/">Home</Link><Link href="/#services">Services</Link><Link href={signedIn ? "/dashboard" : "/login"}>Login</Link><a href="mailto:dropverseagency@gmail.com">Contact</a><a href="#">Privacy</a><a href="#">Terms</a></div><p className="text-xs text-[#5f726c]">© 2026 DropVerse. All rights reserved.</p></div></footer>
    </main>
  )
}

const FAQS = [
  {
    q: 'What is the DropVerse Partner Program?',
    a: 'It is the official way to earn on DropVerse beyond your own sales. You can earn by actively selling digital services to clients, by referring entrepreneurs to the platform, or by combining both. Commissions are performance-based and tied to real platform activity under the program terms.',
  },
  {
    q: 'How does the referral link work?',
    a: 'Every registered user can have a unique referral link, like dropverse.com/r/YOURCODE. When someone joins through your link, the referral is tracked, and the relationship remains eligible for commissions for up to 12 months, subject to the program terms.',
  },
  {
    q: 'Do I earn money just for signing someone up?',
    a: 'No. Simply registering a user does not automatically generate a commission. Referral compensation is tied to eligible real platform activity and projects under the current Partner Program terms.',
  },
  {
    q: 'How are commissions calculated?',
    a: 'Commissions are a percentage of eligible DropVerse profit allocated to referral commissions — not a percentage of total project value. Your rate depends on your tier, which is based on your number of active referrals (10%, 15%, 20% or 25%). All calculations happen server-side.',
  },
  {
    q: 'How long does a referral remain eligible?',
    a: 'For the initial launch, the referral relationship remains eligible for commissions for up to 12 months, subject to the program terms. This may be reviewed as the program matures.',
  },
  {
    q: 'Can I earn from my own projects?',
    a: 'Yes — that is the active income path. You earn from the projects you sell and fulfill through DropVerse talent, independently of any referral commissions.',
  },
  {
    q: 'Can I earn from referring clients?',
    a: 'Yes. You can potentially refer clients who need digital services to DropVerse, and you may receive eligible referral compensation for completed client projects. Client referrals use a separate structure from user referrals.',
  },
  {
    q: 'Can I do active and referral income at the same time?',
    a: 'Absolutely. The hybrid path is designed exactly for that — sell services to your own clients while building a referral network in parallel.',
  },
  {
    q: 'Is passive income guaranteed?',
    a: 'No. Passive income here is potential passive income. Your referral earnings depend on referred users remaining active and generating eligible projects. Nothing about the program is guaranteed, and earnings are not promised in advance.',
  },
  {
    q: 'When can I withdraw my commissions?',
    a: 'Withdrawals will follow the platform payout rules, which are managed centrally and may be updated over time. Commissions move through pending and approved states before they become available.',
  },
  {
    q: 'Can I see my referrals and earnings?',
    a: 'A personal referral dashboard is in development. It will show your link, referral count, active users, projects generated and your earned, pending and available earnings.',
  },
]
