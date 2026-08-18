'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Layers,
  Users,
  Bookmark,
  Zap,
  ArrowRight,
  LogOut,
  User,
  Phone,
  AtSign,
  Settings as SettingsIcon,
} from 'lucide-react'
import Brand from '../../components/Brand'
import { createClient } from '../../lib/supabase'

interface Profile {
  id: string
  full_name: string | null
  username: string | null
  phone: string | null
  telegram_username: string | null
  role: string
  created_at: string
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    async function load() {
      // Retry a few times: after sign-in the session cookie may still be
      // persisting on the client side, and an immediate read can return null.
      let session = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const {
          data: { session: current },
        } = await supabase.auth.getSession()
        if (current) {
          session = current
          break
        }
        if (attempt < 4) await new Promise((r) => setTimeout(r, 800))
      }
      if (!session) {
        window.location.assign('/login?redirect=%2Fdashboard')
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone, telegram_username, role, created_at')
        .eq('id', session.user.id)
        .single()
      if (cancelled) return
      if (data) setProfile(data as Profile)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.assign('/login')
  }

  return (
    <main className="min-h-screen grid-bg px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-5xl">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Brand compact />
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979] disabled:opacity-60"
          >
            <LogOut size={15} /> {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>

        {loading ? (
          <div className="mt-24 text-center text-sm text-[#718781]">Loading your workspace...</div>
        ) : (
          <>
            {/* Welcome header — user's name on top */}
            <div className="card mt-10 rounded-3xl p-7 sm:p-9">
              <p className="text-sm text-[#d8b45a]">Your workspace</p>
              <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">
                Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#8fa29c]">
                Your DropVerse account is active. Explore services, browse work samples and turn
                your network into a revenue stream.
              </p>

              {/* Profile details */}
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <ProfileRow                     icon={<User size={15} />} label="Username" value={profile?.username || '—'} />
                <ProfileRow icon={<SettingsIcon size={15} />} label="Account" value={
                  <Link href="/dashboard/settings" className="underline decoration-dotted underline-offset-4 hover:text-[#e4c979]">Manage →</Link>
                } />
                <ProfileRow icon={<User size={15} />} label="Full name" value={profile?.full_name || '—'} />
                <ProfileRow icon={<Phone size={15} />} label="Mobile" value={profile?.phone || '—'} />
                <ProfileRow icon={<AtSign size={15} />} label="Telegram" value={profile?.telegram_username || 'Not added'} />
              </div>
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat icon={<Layers />} label="Services available" value="8" />
              <Stat icon={<Users />} label="Partner program" value="Active" />
              <Stat icon={<Bookmark />} label="Saved samples" value="0" />
              <Stat icon={<Zap />} label="Momentum" value="Ready" />
            </div>

            {/* Quick actions + next step */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_.7fr]">
              <div className="card rounded-3xl p-7">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold">Quick actions</h2>
                  <span className="text-xs text-[#687d76]">Your workspace</span>
                </div>
                <div className="mt-6 space-y-3">
                  <Action
                    title="Settings"
                    text="Update your name, username, contact details or email."
                    href="/dashboard/settings"
                  />
                  <Action
                    title="Explore services"
                    text="Find services you can package and sell."
                    href="/#services"
                  />
                  <Action
                    title="Browse work samples"
                    text="Discover examples from professional talent."
                    href="/#samples"
                  />
                  <Action
                    title="Earn With DropVerse"
                    text="Turn your network and sales into another revenue stream."
                    href="/earn"
                  />
                </div>
              </div>

              <div className="card rounded-3xl p-7">
                <p className="text-sm text-[#d8b45a]">Next step</p>
                <h2 className="font-display mt-2 text-2xl font-bold">Find a service worth selling.</h2>
                <p className="mt-3 text-sm leading-6 text-[#81948e]">
                  Explore the library, save strong samples and start building your offer.
                </p>
                <Link
                  href="/#services"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#d8b45a]"
                >
                  Explore services <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <p className="mt-10 text-center text-xs text-[#687d76]">
              Need help? Contact us at{' '}
              <a href="mailto:dropverseagency@gmail.com" className="text-[#9aaca6] hover:text-[#d8b45a]">
                dropverseagency@gmail.com
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3.5">
      <span className="text-[#d8b45a]">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-[#718781]">{label}</div>
        <div className="truncate text-sm font-semibold text-[#d9e0dc]">{value}</div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card rounded-2xl p-5">
      <div className="text-[#d8b45a]">{icon}</div>
      <div className="mt-5 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-[#758983]">{label}</div>
    </div>
  )
}

function Action({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[.025] p-4 transition hover:border-[rgba(216,180,90,0.30)]"
    >
      <div>
        <div className="font-semibold">{title}</div>
        <div className="mt-1 text-sm text-[#7f938d]">{text}</div>
      </div>
      <ArrowRight size={17} className="text-[#d8b45a]" />
    </Link>
  )
}
