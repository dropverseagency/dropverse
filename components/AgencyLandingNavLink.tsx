'use client'

import Link from 'next/link'
import { Globe } from 'lucide-react'
import { planAllowsAgencyLanding } from '../lib/planConfig'

/** UI affordance only — server APIs enforce entitlement. */
export default function AgencyLandingNavLink({ plan }: { plan?: string | null }) {
  if (!planAllowsAgencyLanding(plan)) return null
  return (
    <Link
      href="/dashboard/landing"
      className="mt-4 flex items-center gap-3 rounded-2xl border border-[rgba(216,180,90,0.35)] bg-[rgba(216,180,90,0.08)] px-4 py-3 text-sm transition hover:bg-[rgba(216,180,90,0.14)]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(216,180,90,0.15)] text-[#d8b45a]">
        <Globe size={18} />
      </span>
      <span>
        <span className="block font-bold text-[#e4c979]">Agency landing page</span>
        <span className="block text-xs text-[#849792]">Branded storefront for DropVerse services</span>
      </span>
    </Link>
  )
}
