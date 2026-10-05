import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { buildConfig, getPayload } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import { Users } from '../../src/collections/Users'
import { Pages } from '../../src/collections/Pages'
import { Media } from '../../src/collections/Media'
import { initializePreview } from '../../scripts/prepare-preview'

// A fresh local-only database verifies the real migration/bootstrap path without
// touching the developer's editor or pages. No provider credentials are used.
test('fresh preview migrates and initializes once, then preserves editor password and content', async () => {
  const source = new URL(process.env.DATABASE_URL!)
  assert.ok(['localhost', '127.0.0.1'].includes(source.hostname), 'Test requires local database')
  const database = `lunia_preview_test_${Date.now()}`
  const client = new Client({ connectionString: source.href })
  await client.connect()
  await client.query(`CREATE DATABASE "${database}"`)
  source.pathname = `/${database}`
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  try {
    payload = await getPayload({
      config: buildConfig({
        secret: 'synthetic-bootstrap-test-only-long-secret',
        db: postgresAdapter({
          pool: { connectionString: source.href },
          push: false,
          migrationDir: `${process.cwd()}/src/migrations`,
        }),
        collections: [Users, Pages, Media],
        sharp,
      }),
    })
    const result = await payload.db.migrate({ shouldPrompt: false })
    assert.ok(!result?.cancelled)
    await initializePreview(payload, 'bootstrap@example.test')
    const users = await payload.find({ collection: 'users', overrideAccess: true })
    assert.equal(users.totalDocs, 1)
    const home = (
      await payload.find({
        collection: 'pages',
        where: { slug: { equals: 'home' } },
        overrideAccess: true,
      })
    ).docs[0]
    assert.equal(home.layout.length, 6)
    const password = 'synthetic-chosen-password-for-test'
    await payload.update({
      collection: 'users',
      id: users.docs[0].id,
      data: { password },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'pages',
      id: home.id,
      data: { title: 'Preserved editor change' },
      draft: true,
      overrideAccess: true,
    })
    const again = await payload.db.migrate({ shouldPrompt: false })
    assert.equal(again?.migrated.length, 0)
    await initializePreview(payload, 'bootstrap@example.test')
    assert.equal((await payload.find({ collection: 'users', overrideAccess: true })).totalDocs, 1)
    assert.equal((await payload.find({ collection: 'media', overrideAccess: true })).totalDocs, 2)
    assert.equal(
      (
        await payload.findByID({
          collection: 'pages',
          id: home.id,
          draft: true,
          overrideAccess: true,
        })
      ).title,
      'Preserved editor change',
    )
    assert.ok(
      (
        await payload.login({
          collection: 'users',
          data: { email: 'bootstrap@example.test', password },
        })
      ).user,
    )
    await assert.rejects(initializePreview(payload, 'different@example.test'))
    for (const media of (await payload.find({ collection: 'media', overrideAccess: true })).docs)
      await payload.delete({ collection: 'media', id: media.id, overrideAccess: true })
  } finally {
    if (payload) {
      const pool = payload.db.pool
      await payload.destroy()
      await pool?.end()
    }
    await client.query(`DROP DATABASE "${database}"`)
    await client.end()
  }
})
