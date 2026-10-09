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
    <nav className="flex flex-col gap-5 p-3">
      {GROUPS.map((group) => (
        <div key={group}>
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#6f827c]">{group}</div>
          <div className="flex flex-col gap-1">
            {ADMIN_SECTIONS.filter((s) => s.group === group).map((s) => {
              const active = current === s.id
              const Icon = s.icon
              return (
                <Link
                  key={s.id}
                  href={href(s.id)}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? 'bg-[rgba(216,180,90,0.16)] font-semibold text-[#f0d98b]'
                      : 'text-[#8ea09a] hover:bg-white/5 hover:text-[#d9e0dc]'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-[#d8b45a]' : ''} />
                  {s.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-[#071915] text-[#d9e0dc]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(7,25,21,0.92)] backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 lg:hidden" aria-label="Open menu">
              <Menu size={18} />
            </button>
            <Link href="/dashboard" className="inline-flex items-center gap-2.5" aria-label="DropVerse home">
              <Image src="/dropverse-logo.jpeg" alt="DropVerse" width={36} height={36} className="rounded-lg object-cover" priority />
              <span className="font-display text-lg font-extrabold tracking-[.14em]">DROP<span className="text-[#d8b45a]">VERSE</span></span>
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.10)] px-3 py-1 text-xs font-bold text-[#e4c979] sm:inline-flex">
              <ShieldCheck size={13} /> Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[14rem] truncate text-xs text-[#7f918c] md:block">{me?.email ?? ''}</span>
            <Link href="/dashboard" className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5">Dashboard</Link>
            <button onClick={handleSignOut} disabled={signingOut} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-60">
              <LogOut size={13} /> <span className="hidden sm:inline">{signingOut ? 'Signing out' : 'Sign out'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] overflow-y-auto border-r border-white/10 bg-[#061512] lg:block">
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
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-[#061512] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <span className="font-display font-extrabold tracking-[.12em]">DROP<span className="text-[#d8b45a]">VERSE</span></span>
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto">{nav}</div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgba(6,21,18,0.96)] px-2 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {ADMIN_SECTIONS.filter((s) => ['overview', 'projects', 'users', 'commissions', 'services'].includes(s.id)).map((s) => {
            const active = current === s.id
            const Icon = s.icon
            return (
              <Link key={s.id} href={href(s.id)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold ${active ? 'text-[#f0d98b]' : 'text-[#7f918c]'}`}>
                <Icon size={16} />
                {s.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
