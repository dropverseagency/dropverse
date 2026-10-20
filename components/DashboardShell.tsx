'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Wallet,
  Link2,
  Users,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
  ListChecks,
  Building2,
  Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

export const DASHBOARD_SECTIONS = [
  { id: 'overview', label: 'Overview', href: '/dashboard', group: 'Workspace', icon: LayoutDashboard },
  { id: 'projects', label: 'New project', href: '/dashboard/create-project', group: 'Workspace', icon: Plus },
  { id: 'leads', label: 'Lead packs', href: '/dashboard/leads', group: 'Workspace', icon: ListChecks },
  { id: 'landing', label: 'Agency page', href: '/dashboard/landing', group: 'Workspace', icon: Building2 },
  { id: 'payouts', label: 'Payouts', href: '/dashboard/payouts', group: 'Money', icon: Wallet },
  { id: 'affiliate', label: 'Affiliate', href: '/dashboard/affiliate', group: 'Money', icon: Link2 },
  { id: 'billing', label: 'Billing', href: '/dashboard/billing', group: 'Money', icon: Receipt },
  { id: 'team', label: 'Team', href: '/dashboard/team', group: 'Account', icon: Users },
  { id: 'settings', label: 'Settings', href: '/dashboard/settings', group: 'Account', icon: Settings },
] as const

const GROUPS = ['Workspace', 'Money', 'Account'] as const

const GROUP_STYLE = {
  Workspace: {
    label: 'text-[#e4c979]',
    dot: 'bg-[#d8b45a]',
    chip: 'bg-[#24382b] text-[#f3d98a]',
    chipActive: 'bg-[#d8b45a] text-[#10221f]',
  },
  Money: {
    label: 'text-[#7ee0cf]',
    dot: 'bg-[#3ec4b0]',
    chip: 'bg-[#12342f] text-[#9ef0e2]',
    chipActive: 'bg-[#3ec4b0] text-[#06221e]',
  },
  Account: {
    label: 'text-[#a9c4ff]',
    dot: 'bg-[#7c9cff]',
    chip: 'bg-[#17243a] text-[#c5d6ff]',
    chipActive: 'bg-[#7c9cff] text-[#0d1733]',
  },
} as const

function matchSection(pathname: string) {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'overview'
  const hit = DASHBOARD_SECTIONS.find((s) => s.id !== 'overview' && pathname.startsWith(s.href))
  return hit?.id ?? 'overview'
}

export default function DashboardShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title?: string
  subtitle?: string
}) {
  const pathname = usePathname() || '/dashboard'
  const current = matchSection(pathname)
  const currentLabel = DASHBOARD_SECTIONS.find((s) => s.id === current)?.label ?? 'Overview'
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    await createClient().auth.signOut()
    window.location.assign('/login')
  }

  const nav = (
    <nav className="flex flex-col gap-6 px-3 py-4">
      {GROUPS.map((group) => {
        const tone = GROUP_STYLE[group]
        return (
          <div key={group}>
            <div className={`mb-2 flex items-center gap-2 px-2 text-[11px] font-extrabold uppercase tracking-[0.18em] ${tone.label}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
              {group}
            </div>
            <div className="flex flex-col gap-1">
              {DASHBOARD_SECTIONS.filter((s) => s.group === group).map((s) => {
                const active = current === s.id
                const Icon = s.icon
                return (
                  <Link
                    key={s.id}
                    href={s.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm ${
                      active ? 'bg-[#16312b] font-semibold text-white' : 'text-[#c5d2cc] hover:bg-[#102923]'
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
      <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-64 overflow-y-auto border-r border-[#1e3d36] bg-[#0b2420] lg:block">
        <div className="border-b border-[#1e3d36] px-4 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e4c979]">DropVerse</div>
          <div className="mt-1 text-sm font-semibold text-white">Workspace</div>
        </div>
        {nav}
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-[#1e3d36] bg-[#071915]/80 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3a4f38] bg-[#16312b] text-[#f0d98b] lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
              <Link href="/dashboard" className="inline-flex shrink-0 items-center gap-2" aria-label="DropVerse dashboard">
                <Image
                  src="/dropverse-icon.svg"
                  alt="DropVerse"
                  width={36}
                  height={36}
                  className="h-9 w-9 object-contain"
                  priority
                  unoptimized
                />
                <span className="font-display text-lg font-extrabold tracking-tight">
                  <span className="text-white">DROP</span>
                  <span className="text-[#d8b45a]">VERSE</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/payouts"
                className="hidden rounded-full border border-[rgba(216,180,90,0.4)] bg-[rgba(216,180,90,0.12)] px-3 py-2 text-xs font-bold text-[#f0d98b] sm:inline-flex"
              >
                Request payout
              </Link>
              <Link href="/" className="rounded-full border border-[#2c403a] px-3 py-2 text-xs font-semibold text-[#d9e0dc]">
                Site
              </Link>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#2c403a] px-3 py-2 text-xs font-semibold text-[#d9e0dc] disabled:opacity-60"
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">{signingOut ? 'Signing out' : 'Sign out'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          {(title || subtitle) && (
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d8b45a]">Workspace</p>
              <h1 className="mt-1 font-display text-3xl font-extrabold text-white">{title || currentLabel}</h1>
              {subtitle ? <p className="mt-1 max-w-2xl text-sm text-[#8fa29c]">{subtitle}</p> : null}
            </div>
          )}
          {children}
        </main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[86%] flex-col bg-[#0b2420] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e3d36] px-4 py-4">
              <span className="font-display font-extrabold tracking-[.12em] text-white">
                DROP<span className="text-[#d8b45a]">VERSE</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3a4f38] text-[#f0d98b]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto">{nav}</div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1e3d36] bg-[#071915] px-2 py-2 lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {DASHBOARD_SECTIONS.filter((s) => ['overview', 'projects', 'payouts', 'affiliate', 'settings'].includes(s.id)).map((s) => {
            const active = current === s.id
            const Icon = s.icon
            const tone = GROUP_STYLE[s.group]
            return (
              <Link
                key={s.id}
                href={s.href}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold ${
                  active ? 'text-[#f0d98b]' : 'text-[#8ea09a]'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? tone.chipActive : tone.chip}`}>
                  <Icon size={14} />
                </span>
                {s.label === 'New project' ? 'Project' : s.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
