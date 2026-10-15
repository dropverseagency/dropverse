/**
 * Agency landing pages — paid-plan feature.
 * Server-side entitlement and helpers. Never trust client plan claims.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { planAllowsAgencyLanding } from '../planConfig'
import type { OrgRole } from '../planConfig'

export type AgencyLandingPage = {
  id: string
  organization_id: string
  slug: string
  display_name: string
  headline: string
  description: string
  logo_url: string | null
  primary_color: string
  published: boolean
  created_at: string
  updated_at: string
}

export function slugifyAgency(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function isValidAgencySlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 48
}

export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
}

export async function requireAgencyLandingAccess(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<
  | { ok: true; org: { id: string; name: string; plan: string; owner_id: string; status: string }; role: OrgRole }
  | { ok: false; error: 'NOT_MEMBER' | 'ORG_INACTIVE' | 'PLAN_REQUIRED' | 'FORBIDDEN_ROLE' }
> {
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, plan, owner_id, status')
    .eq('id', organizationId)
    .maybeSingle()

  if (!org || org.status !== 'active') {
    return { ok: false, error: 'ORG_INACTIVE' }
  }

  const { data: mem } = await supabase
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!mem || mem.status !== 'active') {
    return { ok: false, error: 'NOT_MEMBER' }
  }

  if (!planAllowsAgencyLanding(org.plan)) {
    return { ok: false, error: 'PLAN_REQUIRED' }
  }

  const role = mem.role as OrgRole
  if (role !== 'OWNER' && role !== 'ADMIN') {
    return { ok: false, error: 'FORBIDDEN_ROLE' }
  }

  return {
    ok: true,
    org: {
      id: org.id,
      name: org.name,
      plan: org.plan,
      owner_id: org.owner_id,
      status: org.status,
    },
    role,
  }
}

export type PublicPackage = {
  id: string
  name: string
  description: string
  retail_price: number
  currency: string
}

export type PublicServiceBlock = {
  id: string
  title: string
  slug: string
  description: string
  packages: PublicPackage[]
}
