import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../../lib/supabaseService'

/**
 * Public invoice lookup — NO authentication required.
 * Used by the client-facing payment page (https://dropverse10v.vercel.app/invoice/[id]).
 * Reads happen through the service role so nothing about RLS leaks, and only
 * the public invoice payload is returned (never owner-only fields).
 */
let serviceSupabase: ReturnType<typeof createServiceClient> | null = null
function getServiceSupabase() {
  return (serviceSupabase ??= createServiceClient())
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id
  const { data, error } = await getServiceSupabase()
    .from('invoices')
    .select(
      `
      id,
      invoice_number,
      client_name,
      client_email,
      currency,
      amount,
      status,
      project:projects!inner (
        id,
        title,
        description,
        category,
        project_type,
        delivery_notes,
        client_contact_email
      )
    `,
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'INVOICE_NOT_FOUND' }, { status: 404 })
  }

  const inv = data as unknown as {
    id: string
    invoice_number: string
    client_name: string | null
    client_email: string | null
    currency: string
    amount: number
    status: string
    project: {
      id: string
      title: string
      description: string
      category: string
      project_type: string
      delivery_notes: string
      client_contact_email: string | null
    }
  }

  // Only PENDING invoices can be paid; everything else is read-only info.
  return NextResponse.json({
    invoice: {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      clientName: inv.client_name,
      clientEmail: inv.client_email,
      currency: inv.currency,
      amount: Number(inv.amount),
      status: inv.status,
      service: {
        projectId: inv.project.id,
        title: inv.project.title,
        description: inv.project.description,
        category: inv.project.category,
        projectType: inv.project.project_type,
        deliveryNotes: inv.project.delivery_notes,
      },
      canPay: inv.status === 'PENDING',
    },
  })
}
