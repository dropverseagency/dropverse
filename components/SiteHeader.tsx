'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, LogOut } from 'lucide-react'
import { createClient } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

export default function SiteHeader({ highlightEarn = true }: { highlightEarn?: boolean }) {
  const [menu, setMenu] = useState(false)
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)

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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[rgba(7,31,29,0.80)] backdrop-blur-xl">
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="DropVerse home">
          <Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover" priority />
          <span className="font-display text-xl font-extrabold tracking-[.16em]">
            DROP<span className="text-[#d8b45a]">VERSE</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-[#c1cbc7] lg:flex">{nav}</nav>
        <div className="hidden items-center gap-3 lg:flex">
          {signedIn && auth.user ? (
            <UserMenu user={auth.user} />
          ) : (
            <Link href="/login" className="px-4 py-2 text-sm text-[#d9e0dc]">
              {auth.loading ? '' : 'Login'}
            </Link>
          )}
          <Link href="/pricing" className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]">
            Pricing
          </Link>
          {signedIn ? (
            <Link href="/dashboard" className="rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
              Get Started
            </Link>
          )}
        </div>
        <button onClick={() => setMenu(!menu)} className="lg:hidden" aria-label="Menu">
          {menu ? <X /> : <Menu />}
        </button>
      </div>
      {menu && (
        <div className="border-t border-white/5 bg-[#071f1d] p-5 lg:hidden">
          <div className="container flex flex-col gap-5 text-[#d9e0dc]">
            <a href="/#services" onClick={() => setMenu(false)}>Services</a>
            <a href="/#how" onClick={() => setMenu(false)}>How It Works</a>
            <a href="/#samples" onClick={() => setMenu(false)}>Work Samples</a>
            <a href="/#about" onClick={() => setMenu(false)}>About</a>
            <Link href="/earn" className="text-[#d8b45a]" onClick={() => setMenu(false)}>Earn With DropVerse →</Link>
            <Link href="/pricing" className="text-[#d8b45a]" onClick={() => setMenu(false)}>Pricing →</Link>
            {signedIn ? (
              <Link href="/dashboard" className="text-[#d8b45a]" onClick={() => setMenu(false)}>Dashboard →</Link>
            ) : (
              <Link href="/login" className="text-[#d8b45a]" onClick={() => setMenu(false)}>Get Started →</Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function UserMenu({ user }: { user: { name?: string | null; email?: string } }) {
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
          <Link href="/dashboard" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-[#d9e0dc] transition hover:bg-white/5">
            Dashboard
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[#d9e0dc] transition hover:bg-white/5 disabled:opacity-60"
          >
            <LogOut size={15} /> {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
