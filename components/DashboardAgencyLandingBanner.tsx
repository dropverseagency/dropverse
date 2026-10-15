'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AgencyLandingNavLink from './AgencyLandingNavLink'
import { createClient } from '../lib/supabase'

/**
 * Shows the agency landing entry on dashboard routes for eligible orgs.
 * UI only — APIs enforce plan entitlement.
 */
export default function DashboardAgencyLandingBanner() {
  const pathname = usePathname()
  const [plan, setPlan] = useState<string | null>(null)

  useEffect(() => {
    if (pathname?.startsWith('/dashboard/landing')) return
    if (!pathname?.startsWith('/dashboard')) return

    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) return

      const { data: orgRows } = await supabase
        .from('organizations')
        .select('plan')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5)

      if (cancelled || !orgRows?.length) return

      const rank: Record<string, number> = {
        ENTERPRISE: 3,
        AGENCY_PRO: 2,
        AGENCY: 1,
      }
      let best: string | null = null
      let bestRank = 0
      for (const o of orgRows) {
        const p = String(o.plan || '')
        const r = rank[p] || 0
        if (r > bestRank) {
          bestRank = r
          best = p
        }
      }
      if (best) setPlan(best)
    })()

    return () => {
      cancelled = true
    }
  }, [pathname])

  if (!plan || pathname?.startsWith('/dashboard/landing')) return null

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-4 sm:px-0">
      <AgencyLandingNavLink plan={plan} />
    </div>
  )
}
