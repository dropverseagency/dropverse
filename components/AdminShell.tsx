'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'
import { DROPVERSE_LOGO_SRC } from '@/lib/dropverseLogo'
import ThemeToggle from '@/components/ThemeToggle'
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
    fetch('/api/admin/data?section=overview')
      .then((r) => r.json())
      .then((j) => {
        if (j?.me) setMe(j.me)
      })
      .catch(() => undefined)
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
      {GROUPS.map((group) => (
        <div key={group}>
          <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
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
                  className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm ${
                    active
                      ? 'bg-primary/15 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon size={16} />
                  </span>
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
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-64 overflow-y-auto border-r border-border bg-card lg:block">
        <div className="border-b border-border px-4 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">DropVerse</div>
          <div className="mt-1 text-sm font-semibold text-foreground">Control center</div>
        </div>
        {nav}
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-primary lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={18} />
              </button>
              <Link href="/dashboard" className="inline-flex shrink-0 items-center" aria-label="DropVerse home">
                <Image
                  src={DROPVERSE_LOGO_SRC}
                  alt="DropVerse"
                  width={52}
                  height={36}
                  className="h-8 w-auto max-h-9 object-contain sm:h-9"
                  priority
                  unoptimized
                />
              </Link>
              <span className="hidden items-center gap-1.5 rounded-full border border-border bg-primary/10 px-3 py-1 text-xs font-bold text-primary sm:inline-flex">
                <ShieldCheck size={13} /> Admin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground md:block">
                {me?.email ?? ''}
              </span>
              <Link
                href="/dashboard"
                className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground"
              >
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
              >
                <LogOut size={13} />{' '}
                <span className="hidden sm:inline">{signingOut ? 'Signing out' : 'Sign out'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="min-w-0 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Control center</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold text-foreground">{title || currentLabel}</h1>
          </div>
          <div className="overflow-x-auto">{children}</div>
        </main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-background/70" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[86%] flex-col border-r border-border bg-card shadow-elevated">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <span className="font-display font-extrabold tracking-[.12em] text-foreground">
                DROP<span className="text-primary">VERSE</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto">{nav}</div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-2 py-2 lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {ADMIN_SECTIONS.filter((s) =>
            ['overview', 'projects', 'users', 'commissions', 'services'].includes(s.id),
          ).map((s) => {
            const active = current === s.id
            const Icon = s.icon
            return (
              <Link
                key={s.id}
                href={href(s.id)}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    active ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
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
