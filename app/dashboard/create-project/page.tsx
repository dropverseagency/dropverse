'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Building2, Rocket, Users, Check } from 'lucide-react'
import { createClient } from '../../../lib/supabase'
import { useAuth } from '../../../lib/useAuth'

export default function CreateProjectPage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)

  // If the user is not signed in, send them to the login page.
  useEffect(() => {
    if (!auth.loading && !auth.user) {
      window.location.assign('/login')
    }
  }, [auth.loading, auth.user])

  // Check whether the user already belongs to a workspace.
  useEffect(() => {
    if (!auth.user) return
    const supabase = createClient()
    supabase
      .from('organization_members')
      .select('organization_id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) {
          setHasOrg(null)
        } else {
          setHasOrg((count ?? 0) > 0)
        }
      })
  }, [auth.user])

  const name = (auth.user as { user_metadata?: { full_name?: string; username?: string } } | null)?.user_metadata?.full_name ||
    (auth.user as { email?: string } | null)?.email?.split('@')[0] ||
    'there'

  return (
    <main className="min-h-screen bg-[#071f1d]">
      <header className="border-b border-white/5 bg-[rgba(7,31,29,0.80)] backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="DropVerse home">
            <Image src="/dropverse-logo.jpeg" alt="DropVerse" width={42} height={42} className="rounded-xl object-cover" priority />
            <span className="font-display text-xl font-extrabold tracking-[.16em]">DROP<span className="text-[#d8b45a]">VERSE</span></span>
          </Link>
          {signedIn && auth.user && (
            <Link href="/dashboard" className="rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-2 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)]">
              Dashboard
            </Link>
          )}
        </div>
      </header>

      <div className="container py-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-7 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
            <Rocket size={30} />
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Welcome, {name}.
          </h1>
          <p className="mt-5 text-lg leading-8 text-[#95a7a1]">
            Your account is ready. Choose how you want to start your Drop Servicing business.
          </p>
        </div>

        {hasOrg ? (
          /* User already has a workspace — straight to the dashboard. */
          <div className="mx-auto mt-14 max-w-2xl rounded-3xl border border-[rgba(216,180,90,0.25)] bg-[#0a2926] p-10 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.10)] text-[#d8b45a]">
              <Check size={26} />
            </div>
            <h2 className="font-display text-2xl font-extrabold">You already have a workspace</h2>
            <p className="mt-3 text-[#95a7a1]">
              Head straight to your dashboard to manage your workspace, team and earnings.
            </p>
            <Link href="/dashboard" className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#d8b45a] px-8 py-4 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
              Go to Dashboard <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          /* No workspace yet — pick a path. */
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <div className="card group rounded-3xl border border-[rgba(216,180,90,0.25)] bg-[#0a2926] p-8 shadow-[0_0_60px_rgba(216,180,90,0.08)] transition duration-300 hover:-translate-y-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.10)] text-[#d8b45a]">
                <Building2 size={22} />
              </div>
              <h2 className="font-display mt-6 text-2xl font-extrabold">Start an Agency</h2>
              <p className="mt-3 text-sm leading-6 text-[#8f9f9a]">
                Create a workspace for your agency: pick your plan, invite your team, and manage clients and earnings in one place.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-[#9aaba6]">
                {['Team workspace with roles', 'Client and earnings tracking', 'Invite members and assign roles'].map(b => (
                  <li key={b} className="flex items-center gap-2.5"><Check size={14} className="text-[#d8b45a]" />{b}</li>
                ))}
              </ul>
              <Link href="/dashboard/create-org" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3.5 font-bold text-[#10221f] transition hover:bg-[#f0d98b]">
                Create Agency <ArrowRight size={16} />
              </Link>
            </div>

            <div className="card group rounded-3xl border border-white/5 bg-[#0a2926] p-8 transition duration-300 hover:-translate-y-1 hover:border-[rgba(216,180,90,0.35)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#d9e0dc]">
                <Users size={22} />
              </div>
              <h2 className="font-display mt-6 text-2xl font-extrabold">Work Solo</h2>
              <p className="mt-3 text-sm leading-6 text-[#8f9f9a]">
                Start selling services on your own with a personal Solo workspace. Upgrade to an agency anytime you are ready to scale.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-[#9aaba6]">
                {['Personal Solo workspace', 'Track your sales and earnings', 'Upgrade or invite team later'].map(b => (
                  <li key={b} className="flex items-center gap-2.5"><Check size={14} className="text-[#d8b45a]" />{b}</li>
                ))}
              </ul>
              <Link href="/dashboard" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.06)] px-6 py-3.5 font-bold text-[#f0d98b] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.12)]">
                Start Solo <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        <div className="mx-auto mt-10 max-w-2xl rounded-2xl border border-white/5 bg-white/[.025] p-6 text-center">
          <p className="text-sm leading-6 text-[#8f9f9a]">
            Not sure yet? Browse the{' '}
            <Link href="/pricing" className="font-semibold text-[#d8b45a] hover:text-[#f0d98b]">pricing plans</Link>{' '}
            or the{' '}
            <Link href="/earn" className="font-semibold text-[#d8b45a] hover:text-[#f0d98b]">Partner Program</Link>{' '}
            and come back anytime.
          </p>
        </div>
      </div>
    </main>
  )
}
