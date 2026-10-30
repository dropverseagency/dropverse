import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const backupRoot = process.env.BACKUP_ROOT || 'backup'
const storageRoot = path.join(backupRoot, 'storage')
const pageSize = 1000

if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const authHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
}

function encodeObjectPath(value) {
  return String(value).split('/').map(encodeURIComponent).join('/')
}

function safeDirectoryName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '_')
}

function resolveInside(root, objectPath) {
  const resolved = path.resolve(root, ...String(objectPath).split('/'))
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Storage object path escaped the backup directory')
  }
  return resolved
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init.headers || {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    throw new Error(`Supabase Storage API returned HTTP ${response.status}`)
  }
  return response.json()
}

async function downloadObject(bucketName, objectPath, destination) {
  const url = `${supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(bucketName)}/${encodeObjectPath(objectPath)}`
  const response = await fetch(url, { headers: authHeaders })
  if (!response.ok || !response.body) {
    throw new Error(`Storage download failed for ${bucketName}/${objectPath}: HTTP ${response.status}`)
  }
  await mkdir(path.dirname(destination), { recursive: true })
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination))
}

const buckets = await requestJson(`${supabaseUrl}/storage/v1/bucket`)
if (!Array.isArray(buckets)) throw new Error('Unexpected Storage bucket response')

const manifest = {
  version: 1,
  createdAt: new Date().toISOString(),
  buckets: [],
  files: [],
}

for (const bucket of buckets) {
  const directory = safeDirectoryName(bucket.name || bucket.id)
  const bucketRoot = path.join(storageRoot, 'objects', directory)
  await mkdir(bucketRoot, { recursive: true })

  manifest.buckets.push({
    id: bucket.id || bucket.name,
    name: bucket.name,
    public: Boolean(bucket.public),
    file_size_limit: bucket.file_size_limit ?? null,
    allowed_mime_types: bucket.allowed_mime_types ?? null,
    directory,
  })

  const visited = new Set()
  async function walk(prefix = '') {
    if (visited.has(prefix)) return
    visited.add(prefix)

    let offset = 0
    while (true) {
      const items = await requestJson(
        `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket.name)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            prefix,
            limit: pageSize,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          }),
        },
      )
      if (!Array.isArray(items)) throw new Error(`Unexpected object list for bucket ${bucket.name}`)

      for (const item of items) {
        if (item?.id == null && item?.metadata == null) {
          if (item?.name) await walk(`${prefix}${item.name}/`)
          continue
        }

        const objectPath = `${prefix}${item.name}`
        const destination = resolveInside(bucketRoot, objectPath)
        await downloadObject(bucket.name, objectPath, destination)
        manifest.files.push({
          bucket: bucket.name,
          directory,
          path: objectPath,
          contentType: item.metadata?.mimetype || 'application/octet-stream',
          size: item.metadata?.size ?? null,
          lastModified: item.updated_at || item.created_at || null,
        })
      }

      if (items.length < pageSize) break
      offset += items.length
    }
  }

  await walk('')
}

await mkdir(storageRoot, { recursive: true })
await writeFile(
  path.join(storageRoot, 'manifest.json'),
  JSON.stringify(manifest, null, 2),
  { mode: 0o600 },
)

console.log(`Storage backup complete: ${manifest.buckets.length} buckets, ${manifest.files.length} objects`)
