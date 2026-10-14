'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X, LogOut, ShieldCheck } from 'lucide-react'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import Brand from './Brand'
import ThemeToggle from './ThemeToggle'

export default function SiteHeader({ highlightEarn = true }: { highlightEarn?: boolean }) {
  const [menu, setMenu] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)

  useEffect(() => {
    let cancelled = false
    const supa = createClient()
    supa.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      supa.from('profiles').select('role').eq('id', user.id).single().then(({ data: prof }) => {
        if (!cancelled && prof && prof.role === 'admin') setIsAdmin(true)
      })
    })
    return () => {
      cancelled = true
    }
  }, [signedIn])

  const nav = (
    <>
      <a href="/#services" className="transition-colors hover:text-primary">
        Services
      </a>
      <a href="/#how" className="transition-colors hover:text-primary">
        How It Works
      </a>
      <a href="/#samples" className="transition-colors hover:text-primary">
        Work Samples
      </a>
      <a href="/#about" className="transition-colors hover:text-primary">
        About
      </a>
      <Link
        href="/earn"
        className={
          highlightEarn
            ? 'font-semibold text-primary hover:opacity-80'
            : 'transition-colors hover:text-primary'
        }
      >
        Earn
      </Link>
      <Link href="/pricing" className="transition-colors hover:text-primary">
        Pricing
      </Link>
    </>
  )

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="container flex h-20 items-center justify-between">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">{nav}</nav>
        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          {signedIn && auth.user ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-bold text-foreground transition hover:bg-muted"
                  title="Admin Panel"
                >
                  <ShieldCheck size={16} className="shrink-0 lg:hidden" aria-label="Admin Panel" />
                  <span className="hidden lg:inline">Admin</span>
                </Link>
              )}
              <UserMenu user={auth.user} isAdmin={isAdmin} />
            </>
          ) : (
            <Link href="/login" className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              {auth.loading ? '' : 'Login'}
            </Link>
          )}
          <Link
            href="/pricing"
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            Pricing
          </Link>
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
              Get Started
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground"
            onClick={() => setMenu((m) => !m)}
            aria-label={menu ? 'Close menu' : 'Open menu'}
          >
            {menu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      {menu && (
        <div className="border-t border-border bg-background/95 px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3 text-sm text-muted-foreground">{nav}</nav>
          <div className="mt-4 flex flex-col gap-2">
            {signedIn && auth.user ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-bold text-foreground"
                  >
                    <ShieldCheck size={16} /> Admin
                  </Link>
                )}
                <UserMenu user={auth.user} isAdmin={isAdmin} mobile />
              </>
            ) : (
              <Link href="/login" className="px-4 py-2 text-sm text-muted-foreground">
                Login
              </Link>
            )}
            <Link
              href="/pricing"
              className="rounded-full border border-border px-4 py-2 text-center text-sm font-semibold text-foreground"
            >
              Pricing
            </Link>
            {signedIn ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-primary px-5 py-2.5 text-center text-sm font-bold text-primary-foreground"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-primary px-5 py-2.5 text-center text-sm font-bold text-primary-foreground"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function UserMenu({
  user,
  isAdmin,
  mobile = false,
}: {
  user: { name?: string | null; email?: string | null }
  isAdmin: boolean
  mobile?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground"
      >
        <span className="max-w-[10rem] truncate">{user.name || user.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-border bg-card py-1 shadow-lg">
          <Link href="/dashboard" className="block px-4 py-2 text-sm text-foreground hover:bg-muted">
            Dashboard
          </Link>
          {isAdmin && (
            <Link href="/admin" className="block px-4 py-2 text-sm text-primary hover:bg-muted">
              Admin
            </Link>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-muted"
            onClick={async () => {
              const supa = createClient()
              await supa.auth.signOut()
              window.location.href = '/'
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
