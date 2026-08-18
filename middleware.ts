import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Protects authenticated-only routes.
 * /dashboard requires a Supabase session cookie (set after login).
 *
 * IMPORTANT: long Supabase sessions are stored as SPLIT cookies whose names
 * end with a chunk index, e.g. `sb-<ref>-auth-token.0`, `.1`, ...
 * A plain `request.cookies.get(name)` only matches exact names, so the raw
 * session cookie is never visible to middleware. This helper reassembles all
 * chunks for a given cookie prefix into the full token.
 */
const protectedPaths = ['/dashboard']

const SESSION_COOKIE_PREFIXES = [
  'sb-ekarcueygmmpgdveryrp-auth-token', // default @supabase/ssr >= 0.5 cookie (may be chunked)
  'sb-access-token',
  'access-token',
]

/**
 * Returns the full session JWT for a cookie name that may be split into
 * numbered chunks (`name.0`, `name.1`, ...), in correct order.
 */
function getSessionToken(request: NextRequest, baseName: string): string | undefined {
  const chunks: { index: number; value: string }[] = []
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name === baseName) {
      chunks.push({ index: -1, value: cookie.value })
      continue
    }
    if (cookie.name.startsWith(`${baseName}.`)) {
      const index = parseInt(cookie.name.slice(baseName.length + 1), 10)
      if (Number.isInteger(index)) chunks.push({ index, value: cookie.value })
    }
  }
  if (chunks.length === 0) return undefined
  // If a whole (non-chunked) cookie exists, prefer it.
  const whole = chunks.find((c) => c.index === -1)
  if (whole) return whole.value
  chunks.sort((a, b) => a.index - b.index)
  return chunks.map((c) => c.value).join('')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!protectedPaths.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const token = SESSION_COOKIE_PREFIXES.map((name) => getSessionToken(request, name)).find(Boolean)

  if (!token) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = { matcher: ['/dashboard', '/dashboard/:path*'] }
