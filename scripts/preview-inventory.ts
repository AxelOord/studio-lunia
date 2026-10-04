import 'dotenv/config'
import { Client } from 'pg'
import { list, get } from '@vercel/blob'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

// Read-only manifest. This does not delete orphans, copy blobs, or claim to be a backup.
const output = process.argv[2]
if (!output) throw new Error('Provide a new private manifest filename.')
let database: URL
try {
  database = new URL(process.env.DATABASE_URL || '')
} catch {
  throw new Error('Invalid database configuration.')
}
if (process.env.LUNIA_OPERATOR_TARGET !== `${database.hostname}${database.pathname}`)
  throw new Error('Confirm the target database host/name before inventory.')
const client = new Client({ connectionString: process.env.DATABASE_URL })
try {
  await client.connect()
  const { rows } = await client.query<{
    filename: string
    prefix: string
    objectkey: string
    card: string
    hero: string
  }>(`
    SELECT filename, prefix, _objectkey AS objectkey, sizes_card_filename AS card, sizes_hero_filename AS hero FROM media
    UNION ALL
    SELECT version_filename, version_prefix, version__objectkey, version_sizes_card_filename, version_sizes_hero_filename FROM _media_v`)
  const references = new Set(
    rows.flatMap((row) =>
      [row.filename, row.card, row.hero]
        .filter(Boolean)
        .map((name) =>
          [row.prefix || 'preview-media', row.objectkey, name].filter(Boolean).join('/'),
        ),
    ),
  )
  const objects: {
    pathname: string
    size: number
    sha256: string
    referenced: boolean
    uploadedAt: Date
  }[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: 'preview-media/', cursor })
    for (const object of page.blobs) {
      const response = await get(object.pathname, { access: 'private', useCache: false })
      if (!response || response.statusCode !== 200)
        throw new Error('Object changed during inventory; quiesce writes and repeat.')
      const hash = createHash('sha256')
      const reader = response.stream.getReader()
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        hash.update(value)
        size += value.byteLength
      }
      if (size !== object.size) throw new Error('Object changed during inventory; repeat snapshot.')
      objects.push({
        pathname: object.pathname,
        size,
        sha256: hash.digest('hex'),
        referenced: references.has(object.pathname),
        uploadedAt: object.uploadedAt,
      })
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  const found = new Set(objects.map((o) => o.pathname))
  const missing = [...references].filter((key) => !found.has(key))
  await writeFile(
    output,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        target: process.env.LUNIA_OPERATOR_TARGET,
        objects,
        missing,
      },
      null,
      2,
    ),
    { flag: 'wx', mode: 0o600 },
  )
  console.log(
    `Private manifest created: ${objects.length} objects, ${missing.length} missing references. No objects deleted.`,
  )
  if (missing.length) process.exitCode = 1
} catch {
  console.error(
    'Inventory failed; no provider response or secret was logged. Verify target, access and write quiescence.',
  )
  process.exitCode = 1
} finally {
  try {
    await client.end()
  } catch {
    console.error('Inventory connection cleanup failed; provider details withheld.')
    process.exitCode = 1
  }
}
