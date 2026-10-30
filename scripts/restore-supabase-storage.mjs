import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const backupRoot = process.env.BACKUP_ROOT || 'backup'

if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
}

function encodeObjectPath(value) {
  return String(value).split('/').map(encodeURIComponent).join('/')
}

function resolveInside(root, objectPath) {
  const resolved = path.resolve(root, ...String(objectPath).split('/'))
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Storage object path escaped the backup directory')
  }
  return resolved
}

const manifestPath = path.join(backupRoot, 'storage', 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

for (const bucket of manifest.buckets || []) {
  const createResponse = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: bucket.id || bucket.name,
      name: bucket.name,
      public: Boolean(bucket.public),
      file_size_limit: bucket.file_size_limit,
      allowed_mime_types: bucket.allowed_mime_types,
    }),
  })

  if (!createResponse.ok && createResponse.status !== 409) {
    throw new Error(`Could not create Storage bucket ${bucket.name}: HTTP ${createResponse.status}`)
  }
}

let restored = 0
for (const file of manifest.files || []) {
  const bucket = (manifest.buckets || []).find((item) => item.name === file.bucket)
  if (!bucket) throw new Error(`Missing bucket metadata for ${file.bucket}`)

  const bucketRoot = path.join(backupRoot, 'storage', 'objects', bucket.directory)
  const source = resolveInside(bucketRoot, file.path)
  const stream = createReadStream(source)
  const url = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(file.bucket)}/${encodeObjectPath(file.path)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': file.contentType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: stream,
    duplex: 'half',
  })

  if (!response.ok) {
    throw new Error(`Could not restore ${file.bucket}/${file.path}: HTTP ${response.status}`)
  }
  restored += 1
}

console.log(`Storage restore complete: ${restored} objects uploaded`)
