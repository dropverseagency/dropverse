import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * CSP violation reports — logs compact structured data only (no personal content).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const report = (body as { 'csp-report'?: Record<string, unknown> })?.['csp-report'] || body
    if (report && typeof report === 'object') {
      const r = report as Record<string, unknown>
      console.warn(
        '[csp-report]',
        JSON.stringify({
          violated: r['violated-directive'] || r.violatedDirective,
          blocked: r['blocked-uri'] || r.blockedURL,
          document: r['document-uri'] || r.documentURL,
          disposition: r.disposition,
        }),
      )
    }
  } catch {
    /* ignore malformed */
  }
  return new NextResponse(null, { status: 204 })
}
