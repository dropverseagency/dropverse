/**
 * DropVerse Admin Core — server-side only.
 *
 * - `adminClient()` builds a Supabase client with the SERVICE-ROLE key.
 *   NEVER expose this key to the browser (never import in a Client Component).
 * - `requireAdmin()` re-validates the caller from their session cookie JWT
 *   (untrusted, but verified against the Supabase JWKS via getUser) and
 *   confirms the profile role is 'admin'. Returns the admin's user id or throws.
 * - `audit()` writes an immutable row to audit_logs.
 * - Commission math always happens here / in server actions — never client-side.
 */
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export const ADMIN_ROLE = 'admin'

export function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}

export async function sessionClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    },
  )
}

export class AdminOnlyError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
    this.name = 'AdminOnlyError'
  }
}

/**
 * Re-validates the current session and confirms the profile role is admin.
 * Throws AdminOnlyError for everyone else.
 */
export async function requireAdmin(): Promise<{ userId: string; email: string | null }> {
  const supabase = await sessionClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    throw new AdminOnlyError('NOT_AUTHENTICATED')
  }
  const admin = adminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== ADMIN_ROLE) {
    throw new AdminOnlyError('ADMIN_ONLY')
  }
  return { userId: user.id, email: user.email ?? null }
}

export type AuditInput = {
  actorId: string | null
  actorEmail: string | null
  action: string
  entity: string
  entityId?: string | null
  oldValue?: unknown
  newValue?: unknown
}

export async function audit(input: AuditInput) {
  try {
    await adminClient().from('audit_logs').insert({
      actor_id: input.actorId,
      actor_email: input.actorEmail,
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      old_value: input.oldValue !== undefined ? JSON.parse(JSON.stringify(input.oldValue)) : null,
      new_value: input.newValue !== undefined ? JSON.parse(JSON.stringify(input.newValue)) : null,
    })
  } catch {
    /* audit writes never break the request */
  }
}

export function jsonOk(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
}

export async function adminJson(handler: (ctx: { userId: string; email: string | null }) => Promise<unknown> | unknown) {
  try {
    const ctx = await requireAdmin()
    return jsonOk(await handler(ctx))
  } catch (e) {
    if (e instanceof AdminOnlyError) {
      if (e.code === 'NOT_AUTHENTICATED') return jsonOk({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
      return jsonOk({ error: 'ADMIN_ONLY' }, { status: 403 })
    }
    console.error('[admin] request failed', e)
    return jsonOk({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

/** Paginated list helper: validates page/limit server-side. */
export function parsePage(searchParams: URLSearchParams) {
  let page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  let limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') ?? '25', 10) || 25))
  return { offset: (page - 1) * limit, limit }
}

export function invalidate() {
  revalidatePath('/admin', 'page')
  revalidatePath('/admin/[page]', 'page')
  revalidatePath('/dashboard/affiliate', 'page')
  revalidatePath('/dashboard', 'page')
}
