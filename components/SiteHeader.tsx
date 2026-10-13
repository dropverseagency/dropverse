'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, LogOut, ShieldCheck } from 'lucide-react'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { DROPVERSE_LOGO_SRC } from '../lib/dropverseLogo'

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
    return () => { cancelled = true }
  }, [signedIn])
const nav = (
    <>
      <a href="/#services" className="hover:text-[#f0d98b]">Services</a>
      <a href="/#how" className="hover:text-[#f0d98b]">How It Works</a>
      <a href="/#samples" className="hover:text-[#f0d98b]">Work Samples</a>
      <a href="/#about" className="hover:text-[#f0d98b]">About</a>
      <Link href="/earn" className={highlightEarn ? 'font-semibold text-[#e4c979] hover:text-[#f0d98b]' : 'hover:text-[#f0d98b]'}>Earn</Link>
      <Link href="/pricing" className="hover:text-[#f0d98b]">Pricing</Link>
    </>
  )

  return (
    <header className="fixed top-0 left-0 right-0 z-50 brand-header border-b border-white/5 bg-[rgba(7,31,29,0.80)] backdrop-blur-xl">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="inline-flex shrink-0 items-center" aria-label="DropVerse home">
          <Image
            src={DROPVERSE_LOGO_SRC}
            alt="DropVerse"
            width={120}
            height={48}
            className="h-10 w-auto max-h-12 object-contain sm:h-12"
            priority unoptimized
          />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-[#c1cbc7] lg:flex">{nav}</nav>
        <div className="hidden items-center gap-3 lg:flex">
          {signedIn && auth.user ? (
            <>
              {isAdmin && (
                <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.12)] px-3.5 py-2 text-sm font-bold text-[#f0d98b] transition hover:bg-[rgba(216,180,90,0.22)]" title="Admin Panel">
                  <ShieldCheck size={16} className="shrink-0 lg:hidden" aria-label="Admin Panel" />
                  <span className="hidden lg:inline">Admin</span>
                </Link>
              )}
              <UserMenu user={auth.user} isAdmin={isAdmin} />
            </>
          ) : (
            <Link href="/login" className="px-4 py-2 text-sm text-[#d9e0dc]">
              {auth.loading ? '' : 'Login'}
            </Link>
          )}
          <Link href="/pricing" className="brand-button-secondary rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]">
            Pricing
          </Link>
          {signedIn ? (
            <Link href="/dashboard" className="brand-button-primary rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="brand-button-primary rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
              Get Started
            </Link>
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-[#c1cbc7] lg:hidden"
          onClick={() => setMenu((m) => !m)}
          aria-label={menu ? 'Close menu' : 'Open menu'}
        >
          {menu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {menu && (
        <div className="border-t border-white/5 bg-[rgba(7,31,29,0.95)] px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3 text-sm text-[#c1cbc7]">{nav}</nav>
          <div className="mt-4 flex flex-col gap-2">
            {signedIn && auth.user ? (
              <>
                {isAdmin && (
                  <Link href="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.12)] px-3.5 py-2 text-sm font-bold text-[#f0d98b]">
                    <ShieldCheck size={16} /> Admin
                  </Link>
                )}
                <UserMenu user={auth.user} isAdmin={isAdmin} mobile />
              </>
            ) : (
              <Link href="/login" className="px-4 py-2 text-sm text-[#d9e0dc]">Login</Link>
            )}
            <Link href="/pricing" className="brand-button-secondary rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-center text-sm font-bold text-[#e4c979]">
              Pricing
            </Link>
            {signedIn ? (
              <Link href="/dashboard" className="brand-button-primary rounded-full bg-[#d8b45a] px-5 py-2.5 text-center text-sm font-bold text-[#10221f]">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="brand-button-primary rounded-full bg-[#d8b45a] px-5 py-2.5 text-center text-sm font-bold text-[#10221f]">
                Get Started
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function UserMenu({ user, isAdmin, mobile = false }: { user: { name?: string | null; email?: string | null }; isAdmin: boolean; mobile?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-[#d9e0dc]"
      >
        <span className="max-w-[10rem] truncate">{user.name || user.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-white/10 bg-[rgba(7,31,29,0.98)] py-1 shadow-xl">
          <Link href="/dashboard" className="block px-4 py-2 text-sm text-[#c1cbc7] hover:bg-white/5">Dashboard</Link>
          {isAdmin && <Link href="/admin" className="block px-4 py-2 text-sm text-[#f0d98b] hover:bg-white/5">Admin</Link>}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#c1cbc7] hover:bg-white/5"
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
