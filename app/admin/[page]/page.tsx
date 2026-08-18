import AdminRouter from '@/components/admin/AdminRouter'

export default async function AdminSectionPage({ params }: { params: Promise<{ page: string }> }) {
  const page = (await params).page || 'overview'
  const allowed = ['overview', 'users', 'agencies', 'projects', 'payments', 'affiliates', 'commissions', 'services', 'freelancers', 'audit', 'settings']
  return <AdminRouter page={allowed.includes(page) ? page : 'overview'} />
}
