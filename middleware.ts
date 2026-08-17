import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Protects authenticated-only routes.
 * /dashboard requires a Supabase access_token cookie (set after login).
 * Unauthenticated visitors are redirected to /login with a redirect URL.
 */
const protectedPaths = ['/dashboard']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!protectedPaths.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const token =
    request.cookies.get('access-token')?.value ||
    request.cookies.get('sb-access-token')?.value

  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard', '/dashboard/:path*'] }
