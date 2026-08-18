import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Protects authenticated-only routes.
 * /dashboard requires a Supabase session cookie (set after login).
 * Default SSR cookie name is `sb-<project-ref>-auth-token`;
 * older names are also checked for backwards compatibility.
 * Unauthenticated visitors are redirected to /login with a redirect URL.
 */
const protectedPaths = ['/dashboard']

const SESSION_COOKIE_NAMES = [
  'sb-ekarcueygmmpgdveryrp-auth-token', // default @supabase/ssr >= 0.5 cookie
  'sb-access-token',
  'access-token',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!protectedPaths.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const token = SESSION_COOKIE_NAMES.map((name) => request.cookies.get(name)?.value).find(
    Boolean,
  )

  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard', '/dashboard/:path*'] }
