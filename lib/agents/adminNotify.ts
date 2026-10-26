import { adminClient } from '@/lib/adminCore'
import { notifyAdminChannels } from '@/lib/agents/notifyAdmin'

function agentsEnabled(): boolean {
  return process.env.AGENTS_ENABLED === 'true'
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
}

async function claimEvent(idempotencyKey: string, agent: string, entityId: string): Promise<'claimed' | 'duplicate' | 'no_table'> {
  try {
    const admin = adminClient()
    const { error } = await admin.from('agent_events').insert({
      idempotency_key: idempotencyKey,
      agent,
      entity_id: entityId,
    })
    if (!error) return 'claimed'
    if (error.code === '23505') return 'duplicate'
    if (/does not exist|relation|permission/i.test(error.message || '')) return 'no_table'
    console.error('[adminNotify] claimEvent', error.message)
    return 'no_table'
  } catch (e) {
    console.error('[adminNotify] claimEvent failed', e)
    return 'no_table'
  }
}

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://dropverse-nu.vercel.app'
  ).replace(/\/$/, '')
}

export type AdminNotifyInput = {
  /** Stable agent name stored in agent_events */
  agent: string
  /** Unique key for this event instance */
  idempotencyKey: string
  entityId: string
  title: string
  lines: string[]
  adminPath?: string
}

/**
 * Best-effort admin Telegram/Discord notify. Never throws.
 * Skips when AGENTS_ENABLED is not exactly "true".
 * Idempotent when agent_events table exists.
 */
export async function notifyAdminEvent(input: AdminNotifyInput): Promise<void> {
  try {
    if (!agentsEnabled()) return
    const claim = await claimEvent(input.idempotencyKey, input.agent, input.entityId)
    if (claim === 'duplicate') return

    const adminUrl = input.adminPath ? `${siteBase()}${input.adminPath.startsWith('/') ? '' : '/'}${input.adminPath}` : null
    const plainParts = [input.title, ...input.lines]
    if (adminUrl) plainParts.push(`Admin: ${adminUrl}`)
    const plain = plainParts.join('\n')

    const htmlParts = [`<b>${escapeHtml(input.title)}</b>`, ...input.lines.map((l) => escapeHtml(l))]
    if (adminUrl) htmlParts.push(`<a href="${escapeHtml(adminUrl)}">Open admin</a>`)
    const html = htmlParts.join('\n')

    await notifyAdminChannels(html, plain)
  } catch (e) {
    console.error('[adminNotify]', e)
  }
}
