'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Brand from '../../../components/Brand'
import { Users, Gift, TrendingUp } from 'lucide-react'

/**
 * Referral landing page: https://dropverse10v.vercel.app/r/DV-XXXXXXXX
 * Visiting records the click (for the affiliate), stores the pending code in a
 * cookie, and invites the visitor to sign up and be attributed to the referrer.
 */
export default function ReferralLanding() {
  const params = useParams()
  const code = String(params?.code ?? '').toUpperCase()
  const [recorded, setRecorded] = useState(false)
  const [referralInfo, setReferralInfo] = useState<{
    referrerName?: string | null
    valid: boolean
  } | null>(null)

  useEffect(() => {
    if (!code) return
    // Record the click (anon-safe endpoint) and stash the pending code cookie.
    fetch('/api/affiliate/clicks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, landingPath: `/r/${code}` }),
    }).catch(() => undefined)
    fetch(`/api/referral/pending?code=${encodeURIComponent(code)}`).then(async (r) => {
      const j = await r.json()
      setRecorded(j.ok === true)
    }).catch(() => undefined)
  }, [code])

  const valid = recorded && !referralInfo?.valid === false // recorded implies code accepted by click endpoint; code existence checked on signup

  return (
    <main className="min-h-screen grid-bg flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <Brand />
        <div className="card mt-8 rounded-3xl p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(216,180,90,0.14)]">
            <Gift className="text-[#d8b45a]" size={24} />
          </div>
          <h1 className="font-display mt-5 text-3xl font-extrabold">You were invited to DropVerse</h1>
          <p className="mt-3 text-sm leading-6 text-[#8fa29c]">
            A friend shared their personal invite link with you. Sign up with your own account to get started — and your friend gets rewarded when your paid projects generate revenue.
          </p>
          <div className="mt-5 rounded-xl border border-[rgba(216,180,90,0.25)] bg-[rgba(216,180,90,0.08)] px-4 py-3">
            <div className="text-xs uppercase tracking-wider text-[#9aa8a3]">Invite code</div>
            <div className="mt-0.5 font-mono text-lg font-bold tracking-[.18em] text-[#f0d98b]">{code || '—'}</div>
            <div className="mt-1 text-xs text-[#81948e]">This code is saved automatically — just finish creating your account.</div>
          </div>
          <div className="mt-5 grid gap-2">
            {[
              { icon: Users, text: 'Join the DropVerse partner ecosystem' },
              { icon: TrendingUp, text: 'Earn commissions from your referred projects' },
              { icon: Gift, text: 'Your invite code is applied instantly at signup' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm text-[#c8d4d0]">
                <Icon size={16} className="shrink-0 text-[#d8b45a]" /> {text}
              </div>
            ))}
          </div>
          <Link
            href={`/login?redirect=%2Fdashboard&ref=${encodeURIComponent(code)}`}
            className="mt-6 block w-full rounded-xl bg-[#d8b45a] px-5 py-3.5 text-center font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
          >
            Create My Account →
          </Link>
          <p className="mt-4 text-center text-xs text-[#81948e]">Already have an account? {valid ? 'Your invite code is saved.' : ''} <Link href="/login" className="text-[#d8b45a] hover:text-[#f0d98b]">Sign in</Link></p>
        </div>
      </div>
    </main>
  )
}
