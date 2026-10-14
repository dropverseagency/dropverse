'use client'

import Link from 'next/link'
import { ArrowRight, Users, Wallet, Share2, TrendingUp } from 'lucide-react'
import Brand from '../../components/Brand'
import SiteHeader from '../../components/SiteHeader'
import { useAuth } from '../../lib/useAuth'

export default function EarnPage() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)

  return (
    <main className="min-h-screen bg-[#071f1d]">
      <SiteHeader />

      <section className="container pb-20 pt-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-[#d8b45a]">Partner program</p>
          <h1 className="font-display mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Earn with DropVerse
          </h1>
          <p className="mt-5 text-[#8fa29c]">
            Share DropVerse, refer digital teams, and earn commissions when they grow their workspace.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={signedIn ? '/dashboard/affiliate' : '/login'}
              className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-7 py-3.5 font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
            >
              {signedIn ? 'Open affiliate dashboard' : 'Get started'} <ArrowRight size={18} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-7 py-3.5 font-semibold text-white transition hover:border-[rgba(216,180,90,0.40)]"
            >
              View plans
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Share2, 'Share your link', 'Get a unique referral link from your dashboard.'],
            [Users, 'Invite teams', 'Digital agencies and freelancers join through you.'],
            [TrendingUp, 'They grow', 'When referred workspaces upgrade, you earn.'],
            [Wallet, 'Get paid', 'Track commissions and request payouts anytime.'],
          ].map(([Icon, title, text]) => (
            <div key={title as string} className="rounded-2xl border border-white/5 bg-[#0a2926] p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(216,180,90,0.30)] bg-[rgba(216,180,90,0.08)] text-[#d8b45a]">
                <Icon size={18} />
              </div>
              <h3 className="font-display mt-4 text-base font-bold">{title as string}</h3>
              <p className="mt-2 text-sm text-[#849792]">{text as string}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
          <Brand compact />
          <div className="flex flex-wrap gap-6 text-sm text-[#83958f]">
            <Link href="/" className="hover:text-[#d8b45a]">Home</Link>
            <Link href="/pricing" className="hover:text-[#d8b45a]">Pricing</Link>
            <Link href="/privacy" className="hover:text-[#d8b45a]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#d8b45a]">Terms</Link>
          </div>
          <p className="text-sm text-[#667c75]">© {new Date().getFullYear()} DropVerse</p>
        </div>
      </footer>
    </main>
  )
}
