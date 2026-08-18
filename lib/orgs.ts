import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrgRole } from './planConfig'

export interface OrgRow {
  id: string
  name: string
  slug: string | null
  type: 'personal' | 'agency'
  plan: string
  owner_id: string
  logo_url: string | null
  description: string | null
  industry: string | null
  team_size: string | null
  status: 'active' | 'suspended' | 'deleted'
  created_at: string
  updated_at: string
}

export interface OrgMember {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
  status: 'invited' | 'active' | 'suspended'
  joined_at: string | null
}

const ORG_SELECT = 'id, name, slug, type, plan, owner_id, logo_url, description, industry, team_size, status, created_at, updated_at'

export async function listMyOrgs(supabase: SupabaseClient): Promise<OrgRow[]> {
  const { data } = await supabase
    .from('organizations')
    .select(ORG_SELECT)
    .eq('status', 'active')
    .order('type', { ascending: true })
    .order('created_at', { ascending: false })
  return (data as OrgRow[] | null) ?? []
}

export async function myMembership(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<OrgMember | null> {
  const { data } = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role, status, joined_at')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  return (data as OrgMember | null) ?? null
}

export function isManager(role: OrgRole): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

export function canManageBilling(role: OrgRole): boolean {
  return role === 'OWNER'
}

export function canViewFinancials(role: OrgRole): boolean {
  return role !== 'SALES'
}

export function canManageTeam(role: OrgRole): boolean {
  return isManager(role)
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
