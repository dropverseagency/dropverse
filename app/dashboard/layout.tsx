import DashboardAgencyLandingBanner from '../../components/DashboardAgencyLandingBanner'

/**
 * Dashboard segment layout — injects agency landing entry for eligible plans
 * without editing the large main dashboard page.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardAgencyLandingBanner />
      {children}
    </>
  )
}
