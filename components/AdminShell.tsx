'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import {
  LayoutDashboard, Users, Briefcase, FolderKanban, CreditCard, Users2,
  Coins, Package, Wrench, ScrollText, Settings, LogOut, ShieldCheck, Menu, X,
} from 'lucide-react'

export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Overview', group: 'Work', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', group: 'Work', icon: FolderKanban },
  { id: 'payments', label: 'Payments', group: 'Work', icon: CreditCard },
  { id: 'services', label: 'Services', group: 'Work', icon: Package },
  { id: 'freelancers', label: 'Freelancers', group: 'Work', icon: Wrench },
  { id: 'users', label: 'Users', group: 'People', icon: Users },
  { id: 'agencies', label: 'Agencies', group: 'People', icon: Briefcase },
  { id: 'affiliates', label: 'Affiliates', group: 'People', icon: Users2 },
  { id: 'commissions', label: 'Commissions', group: 'System', icon: Coins },
  { id: 'audit', label: 'Audit Logs', group: 'System', icon: ScrollText },
  { id: 'settings', label: 'Settings', group: 'System', icon: Settings },
] as const

const GROUPS = ['Work', 'People', 'System'] as const

const GROUP_STYLE = {
  Work: {
    label: 'text-[#e4c979]',
    chip: 'bg-[rgba(216,180,90,0.18)] text-[#f3d98a]',
    chipActive: 'bg-[#d8b45a] text-[#10221f]',
  },
  People: {
    label: 'text-[#7ee0cf]',
    chip: 'bg-[rgba(62,196,176,0.18)] text-[#9ef0e2]',
    chipActive: 'bg-[#3ec4b0] text-[#06221e]',
  },
  System: {
    label: 'text-[#a9c4ff]',
    chip: 'bg-[rgba(120,156,255,0.18)] text-[#c5d6ff]',
    chipActive: 'bg-[#7c9cff] text-[#0d1733]',
  },
} as const

export default function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname()
  const page = (pathname ?? '/admin').split('/admin/')[1] ?? 'overview'
  const current = ADMIN_SECTIONS.find((s) => s.id === page)?.id ?? 'overview'
  const currentLabel = ADMIN_SECTIONS.find((s) => s.id === current)?.label ?? 'Overview'
  const [signingOut, setSigningOut] = useState(false)
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<{ email: string | null } | null>(null)

  useEffect(() => {
    fetch('/api/admin/data?section=overview').then((r) => r.json()).then((j) => {
      if (j?.me) setMe(j.me)
    }).catch(() => undefined)
  }, [])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    await createClient().auth.signOut()
    window.location.assign('/')
  }

  function href(id: string) {
    return id === 'overview' ? '/admin' : `/admin/${id}`
  }

  const nav = (
    <nav className="flex flex-col gap-6 px-3 py-4">
      {GROUPS.map((group) => {
        const tone = GROUP_STYLE[group]
        return (
          <div key={group}>
            <div className={`mb-2 flex items-center gap-2 px-2 text-[11px] font-extrabold uppercase tracking-[0.18em] ${tone.label}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${group === 'Work' ? 'bg-[#d8b45a]' : group === 'People' ? 'bg-[#3ec4b0]' : 'bg-[#7c9cff]'}`} />
              {group}
            </div>
            <div className="flex flex-col gap-1">
              {ADMIN_SECTIONS.filter((s) => s.group === group).map((s) => {
                const active = current === s.id
                const Icon = s.icon
                return (
                  <Link
                    key={s.id}
                    href={href(s.id)}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm transition ${
                      active
                        ? 'bg-gradient-to-r from-[rgba(216,180,90,0.22)] to-[rgba(216,180,90,0.04)] font-semibold text-[#fff8e4] shadow-[inset_3px_0_0_#d8b45a]'
                        : 'text-[#c5d2cc] hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? tone.chipActive : tone.chip}`}>
                      <Icon size={16} />
                    </span>
                    {s.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-[#071915] text-[#d9e0dc]">
      <header className="sticky top-0 z-40 border-b border-[rgba(216,180,90,0.16)] bg-[rgba(7,25,21,0.94)] backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#f0d98b] lg:hidden" aria-label="Open menu">
              <Menu size={18} />
            </button>
            <Link href="/dashboard" className="inline-flex items-center gap-2.5" aria-label="DropVerse home">
              <Image src="/dropverse-logo.jpeg" alt="DropVerse" width={36} height={36} className="rounded-lg object-cover" priority />
              <span className="font-display text-lg font-extrabold tracking-[.14em]">DROP<span className="text-[#d8b45a]">VERSE</span></span>
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.12)] px-3 py-1 text-xs font-bold text-[#f0d98b] sm:inline-flex">
              <ShieldCheck size={13} /> Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[14rem] truncate text-xs text-[#9aaca6] md:block">{me?.email ?? ''}</span>
            <Link href="/dashboard" className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold hover:border-[rgba(216,180,90,0.35)] hover:text-[#f0d98b]">Dashboard</Link>
            <button onClick={handleSignOut} disabled={signingOut} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold hover:border-[rgba(216,180,90,0.35)] hover:text-[#f0d98b] disabled:opacity-60">
              <LogOut size={13} /> <span className="hidden sm:inline">{signingOut ? 'Signing out' : 'Sign out'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] overflow-y-auto border-r border-[rgba(216,180,90,0.14)] bg-[linear-gradient(180deg,#0d2e28_0%,#071915_55%,#061410_100%)] lg:block">
          <div className="mx-3 mt-4 rounded-2xl border border-[rgba(216,180,90,0.22)] bg-[rgba(216,180,90,0.08)] px-3 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e4c979]">DropVerse</div>
            <div className="mt-1 text-sm font-semibold text-white">Control center</div>
          </div>
          {nav}
        </aside>
        <main className="min-w-0 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d8b45a]">Control center</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold text-white">{title || currentLabel}</h1>
          </div>
          <div className="[&_table]:min-w-[680px]">{children}</div>
        </main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col bg-[linear-gradient(180deg,#0d2e28,#071915)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[rgba(216,180,90,0.18)] px-4 py-4">
              <span className="font-display font-extrabold tracking-[.12em]">DROP<span className="text-[#d8b45a]">VERSE</span></span>
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(216,180,90,0.30)] text-[#f0d98b]" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto">{nav}</div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(216,180,90,0.18)] bg-[rgba(7,25,21,0.96)] px-2 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {ADMIN_SECTIONS.filter((s) => ['overview', 'projects', 'users', 'commissions', 'services'].includes(s.id)).map((s) => {
            const active = current === s.id
            const Icon = s.icon
            const tone = GROUP_STYLE[s.group]
            return (
              <Link key={s.id} href={href(s.id)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold ${
                active ? 'bg-[rgba(216,180,90,0.16)] text-[#f0d98b]' : 'text-[#8ea09a]'
              }`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? tone.chipActive : tone.chip}`}>
                  <Icon size={14} />
                </span>
                {s.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
