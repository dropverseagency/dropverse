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
    displayName: 'Solo',
    price: 0,
    currency: 'USD',
    maxMembers: 1,
    features: [
      'Access DropVerse services',
      'Browse work samples',
      'Access freelancer marketplace',
      'Personal projects',
      'Client management',
      'Referral program',
      'Personal dashboard',
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
      'Everything in Solo',
      'Agency workspace',
      'Up to 5 team members',
      'Team management',
      'Shared clients',
      'Shared projects',
      'Team performance dashboard',
      'Agency referral tracking',
      'Shared work samples',
      'Basic analytics',
    ],
    limits: { analytics: 'basic' },
    enterprise: false,
    cta: 'Start Agency',
  },
  {
    id: 'AGENCY_PRO',
    displayName: 'Agency Pro',
    price: 149,
    currency: 'USD',
    maxMembers: 20,
    features: [
      'Everything in Agency',
      'Up to 20 team members',
      'Advanced team permissions',
      'Advanced analytics',
      'Sales performance tracking',
      'Project assignment',
      'Team revenue analytics',
      'Priority support',
      'Advanced referral analytics',
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
      'Everything in Agency Pro',
      'Custom team limits',
      'Multiple workspaces',
      'Advanced permissions',
      'Dedicated support',
      'Custom onboarding',
      'Custom integrations',
      'White-label infrastructure',
      'Custom billing',
    ],
    limits: { analytics: 'advanced' },
    enterprise: true,
    cta: 'Contact Sales',
  },
]

export const planById = (id: PlanId): PlanConfig =>
  PLAN_CONFIG.find((p) => p.id === id) ?? PLAN_CONFIG[0]

export const AGENCY_TYPES = [
  'Marketing Agency',
  'Creative Agency',
  'Web Agency',
  'Social Media Agency',
  'Video Agency',
  'General Agency',
  'Other',
] as const

export const TEAM_SIZES = ['1–5', '6–20', '21–50', '50+'] as const

/** Minimum team headcount implied by a team-size option. */
export function minTeamHeadcount(size: string): number {
  switch (size) {
    case '1–5': return 1
    case '6–20': return 6
    case '21–50': return 21
    case '50+': return 51
    default: return 1
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
