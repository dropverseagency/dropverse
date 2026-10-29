import { NextResponse } from 'next/server'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'

const MAX_REPORT_BYTES = 16 * 1024
const MAX_REPORTS_PER_REQUEST = 5

async function readBoundedBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) return ''

  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_REPORT_BYTES) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

function safeText(value: unknown, maxLength = 160): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.replace(/[\r\n\t]/g, ' ').trim().slice(0, maxLength) || undefined
}

function safeUrl(value: unknown): string | undefined {
  const raw = safeText(value, 1000)
  if (!raw) return undefined
  try {
    const parsed = new URL(raw)
    // Never log query strings, fragments, data payloads, or blob identifiers.
    if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') return parsed.protocol
    const safePath = parsed.pathname.split('/').map((segment) => {
      if (segment.length > 48 || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) || /^\d{5,}$/.test(segment) || segment.includes('@')) {
        return '[redacted]'
      }
      return segment.slice(0, 80)
    }).join('/')
    return `${parsed.origin}${safePath}`.slice(0, 300)
  } catch {
    // CSP also reports tokens such as "inline" and "eval", which are not URLs.
    return raw.replace(/[?#].*$/, '').slice(0, 120)
  }
}

function compactReport(value: unknown): Record<string, string | undefined> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const report = value as Record<string, unknown>
  return {
    violated: safeText(report['violated-directive'] ?? report.violatedDirective ?? report.effectiveDirective),
    blocked: safeUrl(report['blocked-uri'] ?? report.blockedURL),
    document: safeUrl(report['document-uri'] ?? report.documentURL),
    disposition: safeText(report.disposition, 40),
  }
}

/**
 * CSP violation reports are untrusted input. Bound body size and request rate,
 * accept both legacy and Reporting API formats, and never log query strings.
 */
export async function POST(request: Request) {
  const rate = await rateLimit(`csp-report:${clientIp(request)}`, { limit: 30, windowMs: 60_000 })
  if (!rate.success) return rateLimitResponse(rate, 'Too many CSP reports.')

  const raw = await readBoundedBody(request).catch(() => null)
  if (raw === null) return new NextResponse(null, { status: 413 })
  if (!raw) return new NextResponse(null, { status: 204 })

  try {
    const body: unknown = JSON.parse(raw)
    const values = Array.isArray(body)
      ? body.slice(0, MAX_REPORTS_PER_REQUEST).map((entry) => {
          if (entry && typeof entry === 'object' && 'body' in entry) {
            return (entry as { body?: unknown }).body
          }
          return entry
        })
      : [body && typeof body === 'object' && 'csp-report' in body
          ? (body as { 'csp-report'?: unknown })['csp-report']
          : body]

    for (const value of values) {
      const report = compactReport(value)
      if (report) console.warn('[csp-report]', JSON.stringify(report))
    }
  } catch {
    // Ignore malformed reports; this endpoint must not affect normal browsing.
  }

  return new NextResponse(null, { status: 204 })
}
