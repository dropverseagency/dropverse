import { redirect } from 'next/navigation'
import { requireAdmin, AdminOnlyError } from '@/lib/adminCore'

/**
 * Server-side gate for every /admin page.
 * UI hiding is not the security boundary — requireAdmin uses getUser() + profiles.role.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin()
  } catch (e) {
    if (e instanceof AdminOnlyError) {
      if (e.code === 'NOT_AUTHENTICATED') redirect('/login?redirect=/admin')
      redirect('/dashboard')
    }
    redirect('/login?redirect=/admin')
  }
  return <>{children}</>
}
