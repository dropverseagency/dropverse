import { NextRequest, NextResponse } from 'next/server'
import { adminClient, audit, requireAdmin, AdminOnlyError } from '@/lib/adminCore'
import { SAMPLE_COVER_BUCKET } from '@/lib/samples'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    const status = (request.nextUrl.searchParams.get('status') || 'pending_review').trim()
    const admin = adminClient()
    let query = admin
      .from('samples')
      .select('id, owner_id, title, slug, category, description, status, price_usd, commission_rate, turnaround_days, rejection_reason, cover_path, created_at, sample_costs(cost_usd), sample_files(id, kind, mime, size_bytes, storage_path)')
      .order('created_at', { ascending: true })
    if (status !== 'all') query = query.eq('status', status)
    const { data, error } = await query.limit(100)
    if (error) throw error
    const items = await Promise.all((data ?? []).map(async (sample: Record<string, any>) => {
      const [profile, files] = await Promise.all([
        admin.from('profiles').select('full_name, username, user_type, user_types').eq('id', sample.owner_id).maybeSingle(),
        Promise.resolve(sample.sample_files ?? []),
      ])
      const cover = sample.cover_path
        ? admin.storage.from(SAMPLE_COVER_BUCKET).getPublicUrl(sample.cover_path).data.publicUrl
        : null
      const filesWithLinks = await Promise.all(files.map(async (file: Record<string, any>) => {
        const signed = await admin.storage.from('sample-originals').createSignedUrl(String(file.storage_path), 60 * 30)
        return { ...file, signed_url: signed.data?.signedUrl ?? null }
      }))
      return {
        ...sample,
        cover_url: cover,
        freelancer: profile.data?.full_name || profile.data?.username || 'Freelancer',
        user_type: profile.data?.user_type || null,
        user_types: profile.data?.user_types || [],
        sample_files: filesWithLinks,
      }
    }))
    return NextResponse.json({ items })
  } catch (e) {
    if (e instanceof AdminOnlyError) {
      return NextResponse.json({ error: e.code }, { status: e.code === 'NOT_AUTHENTICATED' ? 401 : 403 })
    }
    console.error('[admin samples GET]', e)
    return NextResponse.json({ error: 'LOAD_FAILED' }, { status: 500 })
  }
}
