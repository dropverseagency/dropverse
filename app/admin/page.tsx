import AdminRouter from '@/components/admin/AdminRouter'

// /admin → Overview. Actual routing/rendering is client-side so the single
// page can cover every section; server authorization still happens in
// /api/admin/* (requireAdmin, service role).
export default function AdminPage() {
  return <AdminRouter page="overview" />
}
