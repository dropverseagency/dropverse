import DashboardAgencyLandingBanner from '../../components/DashboardAgencyLandingBanner'
import DashboardShell from '../../components/DashboardShell'

/**
 * Dashboard segment layout — admin-style shell for all workspace pages.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <DashboardAgencyLandingBanner />
      {children}
    </DashboardShell>
  )
}
