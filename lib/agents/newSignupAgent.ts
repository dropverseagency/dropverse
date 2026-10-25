import { adminClient } from '@/lib/adminCore'
import { escapeHtml } from '@/lib/agents/sampleReviewPrecheck'
import { notifyAdminChannels } from '@/lib/agents/notifyAdmin'

export type NewSignupAgentResult = {
  processed: boolean
  skipped?: string
}

function agentsEnabled(): boolean {
  return process.env.AGENTS_ENABLED === 'true'
}

const TYPE_LABELS: Record<string, string> = {
  lead_generator: 'Lead Generator',
  drop_servicer: 'Drop Servicer',
  freelancer: 'Freelancer',
}

function formatTypes(types: unknown): string {
  if (!Array.isArray(types) || types.length === 0) return 'not set'
  return types
    .map((t) => TYPE_LABELS[String(t)] || String(t))
    .join(', ')
}

/** Best-effort idempotency via agent_events when the table exists. */
async function claimEvent(idempotencyKey: string, userId: string): Promise<'claimed' | 'duplicate' | 'no_table'> {
  try {
    const admin = adminClient()
    const { error } = await admin.from('agent_events').insert({
      idempotency_key: idempotencyKey,
      agent: 'new_signup',
      entity_id: userId,
    })
    if (!error) return 'claimed'
    if (error.code === '23505') return 'duplicate'
    if (/does not exist|relation|permission/i.test(error.message || '')) return 'no_table'
    console.error('[newSignupAgent] claimEvent', error.message)
    return 'no_table'
  } catch (e) {
    console.error('[newSignupAgent] claimEvent failed', e)
    return 'no_table'
  }
}

export async function runNewSignupAgent(input: {
  userId: string
  email?: string | null
}): Promise<NewSignupAgentResult> {
  if (!agentsEnabled()) {
    return { processed: false, skipped: 'AGENTS_DISABLED' }
  }

  const claim = await claimEvent(`new_signup:${input.userId}`, input.userId)
  if (claim === 'duplicate') {
    return { processed: false, skipped: 'DUPLICATE' }
  }

  const admin = adminClient()
  const [{ data: profile }, { data: freel }] = await Promise.all([
    admin
      .from('profiles')
      .select('full_name, username, user_type, user_types, telegram_username')
      .eq('id', input.userId)
      .maybeSingle(),
    admin
      .from('freelancer_profiles')
      .select('category, niches, other_niche, display_name')
      .eq('user_id', input.userId)
      .maybeSingle(),
  ])

  const name =
    (profile?.full_name && String(profile.full_name).trim()) ||
    (freel?.display_name && String(freel.display_name).trim()) ||
    (profile?.username && String(profile.username).trim()) ||
    '—'
  const email = (input.email && String(input.email).trim()) || '—'
  const types = formatTypes(
    Array.isArray(profile?.user_types) && profile!.user_types.length
      ? profile!.user_types
      : profile?.user_type
        ? [profile.user_type]
        : [],
  )

  const isFreelancer =
    (Array.isArray(profile?.user_types) && profile!.user_types.includes('freelancer')) ||
    profile?.user_type === 'freelancer'

  let nicheLine = 'n/a'
  if (isFreelancer) {
    const niches = Array.isArray(freel?.niches) ? freel!.niches.map(String) : []
    if (niches.length) {
      nicheLine = niches
        .map((n) => (n === 'Other' && freel?.other_niche ? `Other (${freel.other_niche})` : n))
        .join(', ')
    } else if (freel?.category) {
      nicheLine = String(freel.category)
    } else {
      nicheLine = 'not set yet'
    }
  }

  const plain = [
    'New user signup',
    `Name: ${name}`,
    `Email: ${email}`,
    `Categories: ${types}`,
    `Freelancer niche: ${nicheLine}`,
    `User id: ${input.userId}`,
  ].join('\n')

  const html = [
    '<b>New user signup</b>',
    `<b>Name</b>: ${escapeHtml(name)}`,
    `<b>Email</b>: ${escapeHtml(email)}`,
    `<b>Categories</b>: ${escapeHtml(types)}`,
    `<b>Freelancer niche</b>: ${escapeHtml(nicheLine)}`,
    `<b>Id</b>: <code>${escapeHtml(input.userId)}</code>`,
  ].join('\n')

  await notifyAdminChannels(html, plain)
  return { processed: true }
}
