import { NextResponse } from 'next/server'
import { adminJson, requireAdmin } from '@/lib/adminCore'

/**
 * GET /api/admin/me
 * Returns { isAdmin: true, email } for an admin session, 401 otherwise.
 * Used by headers site-wide to show the "Admin" entry link only to admins.
 */
export async function GET() {
  try {
    const ctx = await requireAdmin()
    return NextResponse.json({ isAdmin: true, email: ctx.email })
  } catch {
    return NextResponse.json({ isAdmin: false, email: null }, { status: 401 })
  }
}
