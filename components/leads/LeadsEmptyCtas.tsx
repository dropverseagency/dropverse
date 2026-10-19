'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../../lib/useAuth'

/** Empty-state CTAs: primary sell action for everyone; sign-in only for guests. */
export default function LeadsEmptyCtas() {
  const auth = useAuth()
  const signedIn = !auth.loading && Boolean(auth.user)
  const guest = !auth.loading && !auth.user

  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <Link
        href={signedIn ? '/dashboard/leads' : '/login?redirect=/dashboard/leads'}
        className="inline-flex items-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b]"
      >
        List your first pack <ArrowRight size={16} />
      </Link>
      {guest ? (
        <Link
          href="/login?redirect=/dashboard/leads"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-[#c5d0cb] hover:border-white/25"
        >
          Sign in to sell
        </Link>
      ) : null}
    </div>
  )
}
