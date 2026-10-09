import { NextRequest } from 'next/server'
import { adminClient, adminJson } from '@/lib/adminCore'

export async function POST(request: NextRequest) {
  return adminJson(async () => {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return { error: 'MISSING_FILE' }
    if (file.size > 25 * 1024 * 1024) return { error: 'FILE_TOO_LARGE' }
    const admin = adminClient()
    const bucket = 'samples'
    const existing = await admin.storage.getBucket(bucket)
    if (existing.error) {
      const created = await admin.storage.createBucket(bucket, { public: true })
      if (created.error) return { error: created.error.message }
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const path = `${Date.now()}-${safeName}`
    const bytes = Buffer.from(await file.arrayBuffer())
    const uploaded = await admin.storage.from(bucket).upload(path, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (uploaded.error) return { error: uploaded.error.message }
    const { data } = admin.storage.from(bucket).getPublicUrl(path)
    return { ok: true, url: data.publicUrl }
  })
}
