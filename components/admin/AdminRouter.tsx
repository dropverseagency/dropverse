'use client'
import { useEffect, useState } from 'react'
import AdminShell from '@/components/AdminShell'
import OverviewSection from '@/components/admin/sections/OverviewSection'
import UsersSection from '@/components/admin/sections/UsersSection'
import AgenciesSection from '@/components/admin/sections/AgenciesSection'
import ProjectsSection from '@/components/admin/sections/ProjectsSection'
import PaymentsSection from '@/components/admin/sections/PaymentsSection'
import AffiliatesSection from '@/components/admin/sections/AffiliatesSection'
import CommissionsSection from '@/components/admin/sections/CommissionsSection'
import ServicesSection from '@/components/admin/sections/ServicesSection'
import FreelancersSection from '@/components/admin/sections/FreelancersSection'
import AuditSection from '@/components/admin/sections/AuditSection'
import SettingsSection from '@/components/admin/sections/SettingsSection'

const SECTION_TITLES: Record<string, string> = {
  overview: 'Admin Overview',
  users: 'Users',
  agencies: 'Agencies',
  projects: 'Projects',
  payments: 'Payments',
  affiliates: 'Affiliates & Referrals',
  commissions: 'Commission Ledger',
  services: 'Services Catalog',
  freelancers: 'Freelancers',
  audit: 'Audit Logs',
  settings: 'Platform Settings',
}

export default function AdminRouter({ page }: { page: string }) {
  const [authState, setAuthState] = useState<'loading' | 'ok' | 'denied'>('loading')

  useEffect(() => {
    let cancelled = false
    // Server-authorize: the overview endpoint only succeeds for admins.
    fetch('/api/admin/data?section=overview').then((r) => {
      if (cancelled) return
      if (r.status === 401 || r.status === 403) {
        setAuthState('denied')
        return
      }
      setAuthState('ok')
    }).catch(() => !cancelled && setAuthState('denied'))
    return () => { cancelled = true }
  }, [])

  if (authState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a211e] text-sm text-[#7f918c]">
        Verifying admin access...
      </div>
    )
  }
  if (authState === 'denied') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0a211e] px-5 text-center">
        <h1 className="font-display text-3xl font-extrabold text-[#f5a0a0]">403 — Admins only</h1>
        <p className="max-w-sm text-sm text-[#8fa29c]">
          This area is restricted to DropVerse administrators. If you believe you should have access, contact dropverseagency@gmail.com.
        </p>
        <a href="/dashboard" className="rounded-full bg-[#d8b45a] px-5 py-2.5 text-sm font-bold text-[#10221f] hover:bg-[#f0d98b]">
          Back to Dashboard
        </a>
      </div>
    )
  }

  const key = page || 'overview'
  const title = SECTION_TITLES[key] ?? SECTION_TITLES.overview

  let section: React.ReactNode = <OverviewSection />
  switch (key) {
    case 'users': section = <UsersSection />; break
    case 'agencies': section = <AgenciesSection />; break
    case 'projects': section = <ProjectsSection />; break
    case 'payments': section = <PaymentsSection />; break
    case 'affiliates': section = <AffiliatesSection />; break
    case 'commissions': section = <CommissionsSection />; break
    case 'services': section = <ServicesSection />; break
    case 'freelancers': section = <FreelancersSection />; break
    case 'audit': section = <AuditSection />; break
    case 'settings': section = <SettingsSection />; break
  }

  return <AdminShell title={title}>{section}</AdminShell>
}
