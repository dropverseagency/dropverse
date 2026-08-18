'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import {
  LayoutDashboard, Users, Briefcase, FolderKanban, CreditCard, Users2,
  Coins, Package, Wrench, ScrollText, Settings, LogOut, ShieldCheck,
} from 'lucide-react'

export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'agencies', label: 'Agencies', icon: Briefcase },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'affiliates', label: 'Affiliates', icon: Users2 },
  { id: 'commissions', label: 'Commissions', icon: Coins },
  { id: 'services', label: 'Services', icon: Package },
  { id: 'freelancers', label: 'Freelancers', icon: Wrench },
  { id: 'audit', label: 'Audit Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export default function AdminShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname()
  const page = (pathname ?? '/admin').split('/admin/')[1] ?? 'overview'
  const current = ADMIN_SECTIONS.find((s) => s.id === page)?.id ?? 'overview'
  const [signingOut, setSigningOut] = useState(false)
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

  return (
    <div className="min-h-screen bg-[#0a211e] text-[#d9e0dc]">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/5 bg-[rgba(7,31,29,0.92)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="inline-flex items-center gap-3" aria-label="DropVerse home">
              <Image src="/dropverse-logo.jpeg" alt="DropVerse" width={38} height={38} className="rounded-lg object-cover" priority />
              <span className="font-display text-lg font-extrabold tracking-[.16em]">
                DROP<span className="text-[#d8b45a]">VERSE</span>
              </span>
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.10)] px-3 py-1 text-xs font-bold text-[#e4c979] sm:inline-flex">
              <ShieldCheck size={13} /> Admin Control Center
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-[12rem] truncate text-[#7f918c] sm:block">{me?.email ?? ''}</span>
            <Link href="/dashboard" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#d9e0dc] transition hover:bg-white/5">Dashboard</Link>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-[#d9e0dc] transition hover:bg-white/5 disabled:opacity-60"
            >
              <LogOut size={13} /> {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar (desktop) */}
      <aside className="fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-56 flex-col border-r border-white/5 bg-[#071f1d] overflow-y-auto md:flex">
        <nav className="flex flex-col gap-0.5 p-3">
          {ADMIN_SECTIONS.map((s) => {
            const active = current === s.id
            const Icon = s.icon
            return (
              <Link
                key={s.id}
                href={`/admin/${s.id === 'overview' ? '' : s.id}`}
                className={`inline-flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-[rgba(216,180,90,0.14)] font-semibold text-[#f0d98b]'
                    : 'text-[#7f918c] hover:bg-white/5 hover:text-[#d9e0dc]'
                }`}
              >
                <Icon size={16} className={active ? 'text-[#d8b45a]' : ''} />
                {s.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile section picker */}
      <div className="sticky top-16 z-30 overflow-x-auto border-b border-white/5 bg-[#071f1d] md:hidden">
        <div className="flex gap-1 p-2">
          {ADMIN_SECTIONS.map((s) => {
            const active = current === s.id
            return (
              <Link
                key={s.id}
                href={`/admin/${s.id === 'overview' ? '' : s.id}`}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active ? 'bg-[rgba(216,180,90,0.16)] text-[#f0d98b]' : 'text-[#7f918c] hover:bg-white/5'
                }`}
              >
                {s.label}
              </Link>
            )
          })}
        </div>
      </div>

      <main className="pt-16 md:pl-56">
        <div className="container py-8">
          <h1 className="mb-6 font-display text-2xl font-extrabold tracking-wide text-[#f0f4f2]">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
