/**
 * Admin Telegram alerts. Skips if TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID missing.
 * Deduplicates via ops_alert_dedupe (fail-open without table).
 */

import { createServiceClient } from '../supabaseService'

type AlertInput = {
  key: string
  text: string
  dedupeSeconds?: number
}

export async function sendAdminAlert(input: AlertInput): Promise<{ sent: boolean }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) {
    console.warn('[telegram] credentials missing — skip alert')
    return { sent: false }
  }

  const dedupeSeconds = input.dedupeSeconds ?? 3600
  const supabase = createServiceClient()

  try {
    const { data: existing } = await supabase
      .from('ops_alert_dedupe')
      .select('last_sent_at')
      .eq('key', input.key)
      .maybeSingle()

    if (existing?.last_sent_at) {
      const last = new Date(existing.last_sent_at).getTime()
      if (Date.now() - last < dedupeSeconds * 1000) {
        return { sent: false }
      }
    }
  } catch {
    /* table may be missing */
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: input.text.slice(0, 3500),
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      console.warn('[telegram] send failed', res.status)
      return { sent: false }
    }
  } catch (e) {
    console.warn('[telegram] error', e instanceof Error ? e.message : 'error')
    return { sent: false }
  }

  try {
    await supabase.from('ops_alert_dedupe').upsert({ key: input.key, last_sent_at: new Date().toISOString() })
  } catch {
    /* ignore */
  }

  return { sent: true }
}
