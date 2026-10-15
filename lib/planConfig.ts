/**
 * Centralized plan configuration for DropVerse workspaces/organizations.
 * Source of truth for the client UI; the authoritative limits live in the
 * `plan_config` Supabase table and are enforced server-side (RLS + DB trigger).
 * Edit this file (and/or the DB rows) to change pricing — no other component
 * should hardcode plan details.
 */
export type PlanId = 'SOLO' | 'AGENCY' | 'AGENCY_PRO' | 'ENTERPRISE'
export type OrgRole = 'OWNER' | 'ADMIN' | 'SALES' | 'ACCOUNT_MANAGER' | 'MEMBER'
export type OrgStatus = 'invited' | 'active' | 'suspended'

export interface PlanConfig {
  id: PlanId
  displayName: string
  price: number
  currency: string
  maxMembers: number | null // null = unlimited
  features: string[]
  limits: Record<string, unknown>
  enterprise: boolean
  cta: string
  highlight?: boolean
}

export const PLAN_CONFIG: PlanConfig[] = [
  {
    id: 'SOLO',
    displayName: 'Starter',
    price: 0,
    currency: 'USD',
    maxMembers: 1,
    features: [
      'B2B workspace license',
      'Digital asset library access',
      'Asset management tools',
      'Project workspace',
      'Client operations templates',
      'Partner referral tools',
      'Workspace dashboard',
    ],
    limits: { analytics: 'basic' },
    enterprise: false,
    cta: 'Start Free',
  },
  {
    id: 'AGENCY',
    displayName: 'Agency',
    price: 49,
    currency: 'USD',
    maxMembers: 5,
    features: [
      'Everything in Starter',
      'Multi-user workspace license',
      'Up to 5 licensed team members',
      'Team access management',
      'Shared client records',
      'Collaborative project boards',
      'Team performance analytics',
      'Partner referral tracking',
      'Shared digital asset library',
      'Basic workspace analytics',
      'Branded agency landing page',
    ],
    limits: { analytics: 'basic' },
    enterprise: false,
    cta: 'Start Agency',
  },
  {
    id: 'AGENCY_PRO',
    displayName: 'Pro',
    price: 149,
    currency: 'USD',
    maxMembers: 20,
    features: [
      'Everything in Agency',
      'Up to 20 licensed team members',
      'Advanced workspace permissions',
      'Advanced workspace analytics',
      'Workflow performance tracking',
      'Project assignment tools',
      'Operational performance analytics',
      'Priority workspace support',
      'Advanced partner analytics',
      'Branded agency landing page',
    ],
    limits: { analytics: 'advanced' },
    enterprise: false,
    cta: 'Go Pro',
    highlight: true,
  },
  {
    id: 'ENTERPRISE',
    displayName: 'Enterprise',
    price: 0,
    currency: 'USD',
    maxMembers: null,
    features: [
      'Everything in Pro',
      'Custom license limits',
      'Multiple workspace environments',
      'Advanced access controls',
      'Dedicated software support',
      'Workspace onboarding',
      'API & integration access',
      'Enterprise workspace infrastructure',
      'Custom software billing',
      'Branded agency landing page',
    ],
    limits: { analytics: 'advanced' },
    enterprise: true,
    cta: 'Contact Sales',
  },
]

export const planById = (id: PlanId): PlanConfig =>
  PLAN_CONFIG.find((p) => p.id === id) ?? PLAN_CONFIG[0]

export const AGENCY_TYPES = [
  'Digital Operations Team',
  'Creative Operations Team',
  'Web Product Team',
  'Content Operations Team',
  'Video Production Team',
  'Digital Services Team',
  'Other',
] as const

export const TEAM_SIZES = ['1–5', '6–20', '21–50', '50+'] as const

/** Minimum team headcount implied by a team-size option. */
export function minTeamHeadcount(size: string): number {
  switch (size) {
    case '1–5':
      return 1
    case '6–20':
      return 6
    case '21–50':
      return 21
    case '50+':
      return 51
    default:
      return 1
  }
}

/** Roles permitted for invitations / assignment (owner/admin manage). */
export const MANAGEABLE_ROLES: OrgRole[] = ['ADMIN', 'SALES', 'ACCOUNT_MANAGER', 'MEMBER']

export const ROLE_LABELS: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  SALES: 'Sales',
  ACCOUNT_MANAGER: 'Account Manager',
  MEMBER: 'Member',
}

/**
 * Permission matrix used client-side for UI rendering (visibility only).
 * All authoritative enforcement happens via Supabase RLS policies — never
 * trust this map for security decisions.
 */
export const ROLE_PERMISSIONS: Record<OrgRole, string[]> = {
  OWNER: [
    'Manage billing',
    'Manage organization',
    'Manage team',
    'Manage clients',
    'Manage projects',
    'View revenue',
    'Manage referrals',
    'Manage settings',
    'Delete organization',
  ],
  ADMIN: [
    'Manage team',
    'Manage clients',
    'Manage projects',
    'Manage services',
    'Manage work samples',
    'View analytics',
  ],
  SALES: [
    'View services',
    'View work samples',
    'Manage assigned leads',
    'Manage assigned clients',
    'Create proposals',
    'Create projects',
  ],
  ACCOUNT_MANAGER: [
    'View assigned clients',
    'Manage assigned projects',
    'Communicate project status',
    'Manage client information',
  ],
  MEMBER: ['View assigned projects', 'View allowed services', 'View assigned work'],
}

export function membersLabelFor(plan: PlanConfig): string {
  if (plan.maxMembers === null) return 'Unlimited team members'
  if (plan.maxMembers === 1) return '1 user'
  return `Up to ${plan.maxMembers} team members`
}

/** Plans that unlock agency branded landing pages (server-side entitlement). */
export const AGENCY_LANDING_PLANS: readonly PlanId[] = ['AGENCY', 'AGENCY_PRO', 'ENTERPRISE'] as const

export function planAllowsAgencyLanding(plan: string | null | undefined): boolean {
  if (!plan) return false
  return (AGENCY_LANDING_PLANS as readonly string[]).includes(plan)
}
