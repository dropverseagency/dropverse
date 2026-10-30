import type { SupabaseClient } from '@supabase/supabase-js'
import { notifyAdminChannels } from '@/lib/agents/notifyAdmin'

export type OpsErrorContext = {
  source: string
  path?: string
  method?: string
  route?: string
  routeType?: string
  requestId?: string | string[]
}

function safeText(value: unknown, max = 240): string {
  return String(value ?? '')
    .replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sb_secret|sk_live|sk_test|whsec|xoxb|gh[pousr]_)\S+/gi, '[redacted]')
    .replace(/([?&](?:token|secret|password|api_key|key)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, max)
}

function safePath(value: unknown): string {
  const path = String(value ?? '/unknown').split(/[?#]/, 1)[0] || '/unknown'
  return safeText(path, 180)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Send a deduplicated operational alert. Error details are sanitized and
 * truncated; stack traces, request bodies, cookies, and credentials are never sent.
 */
export async function reportOpsError(
  admin: SupabaseClient,
  error: unknown,
  context: OpsErrorContext,
): Promise<void> {
  try {
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    const rawMessage = error instanceof Error ? error.message : String(error)
    const message = safeText(rawMessage, 320)
    const path = safePath(context.path || context.route || '/unknown')
    const route = safeText(context.route || 'unknown', 120)
    const method = safeText(context.method || 'unknown', 12).toUpperCase()
    const source = safeText(context.source || 'server', 48)
    const requestId = safeText(context.requestId || 'n/a', 100)
    const fingerprint = await sha256Hex([source, path, route, method, errorName, message].join('|'))

    const { data: claimed, error: claimError } = await admin.rpc('claim_ops_alert', {
      p_key: fingerprint,
      p_cooldown_seconds: 900,
    })
    if (claimError) {
      console.error('[ops-alert] dedupe claim failed', claimError.code || 'unknown')
      return
    }
    if (claimed !== true) return

    const lines = [
      'DropVerse server error',
      `Source: ${source}`,
      `Route: ${route}`,
      `Path: ${path}`,
      `Method: ${method}`,
      `Error: ${safeText(errorName, 80)} — ${message || 'No message'}`,
      `Request ID: ${requestId}`,
    ]
    const plain = lines.join('\n')
    const html = lines.map((line, index) => index === 0
      ? `<b>${escapeHtml(line)}</b>`
      : escapeHtml(line)).join('\n')

    await notifyAdminChannels(html, plain)
  } catch (reportError) {
    console.error(
      '[ops-alert] reporter failed',
      reportError instanceof Error ? safeText(reportError.message, 180) : 'unknown',
    )
  }
}
