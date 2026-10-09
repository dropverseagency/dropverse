import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/adminCore'

export async function GET() {
  const admin = adminClient()
  const servicesQuery = await admin
    .from('services')
    .select('id, title, description')
    .eq('active', true)
    .order('title')
  const samplesQuery = await admin
    .from('work_samples')
    .select('id, title, description, media_url, thumbnail_url')
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(6)

  return NextResponse.json({
    services: servicesQuery.error ? [] : servicesQuery.data ?? [],
    samples: samplesQuery.error ? [] : samplesQuery.data ?? [],
  })
}
