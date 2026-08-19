import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServiceClient } from '../../../../lib/supabaseService'

async function authedClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    },
  )
}

let serviceSupabase: ReturnType<typeof createServiceClient> | null = null
function getServiceSupabase() {
  return (serviceSupabase ??= createServiceClient())
}

async function currentUser() {
  const supabase = await authedClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

/** Invoice numbering: INV-NNNNNN (global counter). */
async function nextInvoiceNumber(): Promise<string> {
  const { count, error } = await getServiceSupabase()
    .from('invoices')
    .select('*', { count: 'exact', head: true })
  if (error) throw new Error('count failed')
  const num = (count ?? 0) + 1
  return `INV-${String(num).padStart(6, '0')}`
}

/** List invoices for the signed-in user. */
export async function GET() {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }
  const { data, error } = await getServiceSupabase()
    .from('invoices')
    .select(
      `
      id,
      invoice_number,
      client_name,
      currency,
      amount,
      status,
      created_at,
      project:projects!inner (
        id,
        title,
        client_contact_email
      )
    `,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({
    invoices: (data || []).map((row: any) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      clientName: row.client_name,
      currency: row.currency,
      amount: Number(row.amount),
      status: row.status,
      createdAt: row.created_at,
      projectId: row.project.id,
      projectTitle: row.project.title,
      clientContactEmail: row.project.client_contact_email,
    })),
  })
}

/**
 * Create an invoice for a project.
 * Rules:
 *  - owner of the project only (or admin)
 *  - amount must equal the project's client_price (single source of truth)
 *  - client_name comes from the project's client_contact_email display, or user-supplied
 *  - one invoice per project (reuses the existing one if present)
 */
export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }

  const body = (await request.json()) as {
    projectId?: string
    clientName?: string
  }
  const projectId = String(body.projectId || '').trim()
  if (!projectId) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  }

  const isAdmin = user.id === process.env.ADMIN_USER_ID

  // Own the project first.
  const { data: project, error: getError } = await getServiceSupabase()
    .from('projects')
    .select('id, title, client_price, currency, status, payment_status, client_contact_email')
    .eq('id', projectId)
    .single()

  if (getError || !project) {
    return NextResponse.json({ error: 'PROJECT_NOT_FOUND' }, { status: 404 })
  }
  if ((project as any).user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'NOT_OWNER' }, { status: 403 })
  }

  // Reuse existing invoice if one already exists for this project.
  const { data: existing } = await getServiceSupabase()
    .from('invoices')
    .select('id')
    .eq('project_id', projectId)
    .single()

  if (existing) {
    return NextResponse.json({ invoiceId: (existing as any).id, reused: true })
  }

  const clientPrice = Number((project as any).client_price)
  if (!(clientPrice > 0)) {
    return NextResponse.json({ error: 'INVALID_PROJECT_PRICE' }, { status: 400 })
  }

  let invoiceNumber = ''
  try {
    invoiceNumber = await nextInvoiceNumber()
  } catch {
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  const payload = {
    project_id: projectId,
    user_id: user.id,
    invoice_number: invoiceNumber,
    client_name: (body.clientName || String((project as any).client_contact_email || '')).trim() || null,
    client_email: (project as any).client_contact_email || null,
    currency: ((project as any).currency as string) || 'USD',
    amount: clientPrice,
    status: 'PENDING',
    spaceremit_payment_id: null,
  }

  const { data: inserted, error } = await getServiceSupabase()
    .from('invoices')
    .insert(payload)
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('invoice insert error:', error?.message)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ invoiceId: (inserted as any).id, reused: false })
}

/**
 * Delete (cancel) an invoice — owner only, sets status to CANCELLED.
 */
export async function DELETE(request: NextRequest) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }
  const url = new URL(request.url)
  const id = url.searchParams.get('id') || ''
  if (!id) {
    return NextResponse.json({ error: 'MISSING_PARAMS' }, { status: 400 })
  }

  const isAdmin = user.id === process.env.ADMIN_USER_ID

  const { data, error } = await getServiceSupabase()
    .from('invoices')
    .select('id, user_id, status')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'INVOICE_NOT_FOUND' }, { status: 404 })
  }
  if ((data as any).user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'NOT_OWNER' }, { status: 403 })
  }
  if ((data as any).status === 'PAID') {
    return NextResponse.json({ error: 'CANNOT_CANCEL_PAID' }, { status: 400 })
  }

  const { error: updateError } = await getServiceSupabase()
    .from('invoices')
    .update({ status: 'CANCELLED' })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
