import { redirect } from 'next/navigation'
import { AdminOnlyError, requireAdmin } from '../../lib/adminCore'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin()
  } catch (error) {
    if (error instanceof AdminOnlyError && error.code === 'NOT_AUTHENTICATED') {
      redirect('/login?redirect=/admin')
    }
    redirect('/dashboard')
  }
  return children
}
