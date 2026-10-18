/**
 * Resend-backed email queue. Skips gracefully if RESEND_API_KEY is missing.
 */

import { createServiceClient } from '../supabaseService'

export type EmailTemplate =
  | 'welcome'
  | 'order_received'
  | 'payment_confirmed'
  | 'in_progress'
  | 'delivered'
  | 'revision_requested'
  | 'completed'
  | 'payment_failed'

type EnqueueInput = {
  to: string
  template: EmailTemplate
  subject: string
  payload?: Record<string, unknown>
  projectId?: string
  idempotencyKey?: string
}

function admin() {
  return createServiceClient()
}

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL || 'DropVerse <onboarding@resend.dev>'
}

async function sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY missing — skip send')
    return { ok: false, error: 'RESEND_API_KEY_MISSING' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, html }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `RESEND_${res.status}:${text.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'SEND_FAILED' }
  }
}

function renderHtml(template: EmailTemplate, payload: Record<string, unknown>): string {
  const title = String(payload.title || template)
  const body = String(payload.body || '')
  const trackUrl = payload.trackUrl ? String(payload.trackUrl) : ''
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#061916;color:#e2e8f0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#0d2420;border-radius:12px;padding:24px;border:1px solid rgba(226,182,86,0.25)">
    <p style="color:#e2b656;font-weight:700;margin:0 0 12px">DropVerse</p>
    <h1 style="font-size:20px;margin:0 0 12px;color:#fff">${escapeHtml(title)}</h1>
    <p style="line-height:1.5;color:#c9d4cf">${escapeHtml(body)}</p>
    ${trackUrl ? `<p style="margin-top:20px"><a href="${escapeHtml(trackUrl)}" style="color:#061916;background:#e2b656;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:700">Track order</a></p>` : ''}
  </div>
  </body></html>`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function enqueueEmail(input: EnqueueInput): Promise<{ queued: boolean; sent: boolean }> {
  const supabase = admin()
  let queueId: string | null = null

  try {
    const { data, error } = await supabase
      .from('email_queue')
      .insert({
        to_email: input.to,
        template: input.template,
        subject: input.subject,
        payload: input.payload ?? {},
        project_id: input.projectId ?? null,
        status: 'pending',
        idempotency_key: input.idempotencyKey ?? null,
      })
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.code === '23505') return { queued: false, sent: false }
      console.warn('[email] queue insert failed (apply migration?)', error.message)
      const html = renderHtml(input.template, input.payload ?? {})
      const result = await sendViaResend(input.to, input.subject, html)
      return { queued: false, sent: result.ok }
    }
    queueId = data?.id ?? null
  } catch (e) {
    console.warn('[email] queue unavailable', e instanceof Error ? e.message : 'error')
    const html = renderHtml(input.template, input.payload ?? {})
    const result = await sendViaResend(input.to, input.subject, html)
    return { queued: false, sent: result.ok }
  }

  const html = renderHtml(input.template, input.payload ?? {})
  const result = await sendViaResend(input.to, input.subject, html)

  if (queueId) {
    if (result.ok) {
      await supabase
        .from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: 1, updated_at: new Date().toISOString() })
        .eq('id', queueId)
    } else {
      await supabase
        .from('email_queue')
        .update({
          status: 'failed',
          attempts: 1,
          last_error: result.error ?? 'unknown',
          next_attempt_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', queueId)
    }
  }

  return { queued: Boolean(queueId), sent: result.ok }
}

export async function processEmailQueue(limit = 30): Promise<{ processed: number; sent: number }> {
  const supabase = admin()
  let processed = 0
  let sent = 0
  try {
    const { data: rows, error } = await supabase
      .from('email_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', new Date().toISOString())
      .lt('attempts', 5)
      .order('next_attempt_at', { ascending: true })
      .limit(limit)

    if (error || !rows) {
      if (error) console.warn('[email] process queue failed', error.message)
      return { processed: 0, sent: 0 }
    }

    for (const row of rows) {
      processed += 1
      const html = renderHtml(row.template as EmailTemplate, (row.payload as Record<string, unknown>) || {})
      const result = await sendViaResend(row.to_email, row.subject, html)
      const attempts = (row.attempts || 0) + 1
      if (result.ok) {
        sent += 1
        await supabase
          .from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString(), attempts, last_error: null, updated_at: new Date().toISOString() })
          .eq('id', row.id)
      } else {
        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            attempts,
            last_error: result.error ?? 'unknown',
            next_attempt_at: new Date(Date.now() + Math.min(24, attempts) * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
      }
    }
  } catch (e) {
    console.warn('[email] processEmailQueue error', e instanceof Error ? e.message : 'error')
  }
  return { processed, sent }
}
