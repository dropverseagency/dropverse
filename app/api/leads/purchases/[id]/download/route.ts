import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit } from '@/lib/adminCore'
import { requireUser } from '@/lib/leads/auth'

export const runtime = 'nodejs'

const BUCKET = 'lead-packs'
const SIGNED_SECONDS = 90

/** GET /api/leads/purchases/[id]/download — signed URL only if purchase is paid */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, email } = await requireUser()
    const { id: purchaseId } = await ctx.params
    if (!purchaseId) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

    const admin = adminClient()
    const { data: purchase, error } = await admin
      .from('lead_pack_purchases')
      .select('id, buyer_id, status, pack_id, lead_packs!inner(storage_path, title, file_content_type)')
      .eq('id', purchaseId)
      .single()

    if (error || !purchase) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }
    if (purchase.buyer_id !== userId) {
      return NextResponse.json({ error: 'NOT_ALLOWED' }, { status: 403 })
    }
    if (purchase.status !== 'paid') {
      return NextResponse.json({ error: 'NOT_PAID' }, { status: 403 })
    }

    const pack = purchase.lead_packs as {
      storage_path: string | null
      title: string
      file_content_type: string | null
    }
    if (!pack.storage_path) {
      return NextResponse.json({ error: 'FILE_MISSING' }, { status: 404 })
    }

    const signed = await admin.storage.from(BUCKET).createSignedUrl(pack.storage_path, SIGNED_SECONDS)
    if (signed.error || !signed.data?.signedUrl) {
      console.error('[leads] signed url', signed.error?.message)
      return NextResponse.json({ error: 'SIGN_FAILED' }, { status: 500 })
    }

    await audit({
      actorId: userId,
      actorEmail: email,
      action: 'lead_pack_download',
      entity: 'lead_pack_purchase',
      entityId: purchaseId,
      newValue: { pack_id: purchase.pack_id },
    })

    return NextResponse.json({
      url: signed.data.signedUrl,
      expiresIn: SIGNED_SECONDS,
      title: pack.title,
    })
  } catch (e) {
    if ((e as Error).message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    console.error('[leads] download', e)
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 })
  }
}
