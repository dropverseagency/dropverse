import { NextResponse } from 'next/server'
import { AdminOnlyError, requireAdmin, reportAdminError } from '@/lib/adminCore'

/**
 * GET /api/admin/me
 * Returns { isAdmin: true, email } for an admin session, 401 otherwise.
 * Used by headers site-wide to show the "Admin" entry link only to admins.
 */
export async function GET() {
  try {
    const ctx = await requireAdmin()
    return NextResponse.json({ isAdmin: true, email: ctx.email })
  } catch (error) {
    if (error instanceof AdminOnlyError) {
      return NextResponse.json({ isAdmin: false, email: null }, { status: 401 })
    }
    await reportAdminError(error, '/api/admin/me', 'GET')
    return NextResponse.json({ isAdmin: false, email: null }, { status: 503 })
  }
}
