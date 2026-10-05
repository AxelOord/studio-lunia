import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from 'pg'
import { buildConfig, getPayload } from 'payload'
import { postgresAdapter, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'
import { Users } from '../../src/collections/Users'
import { Pages } from '../../src/collections/Pages'
import { Media } from '../../src/collections/Media'
import { Enquiries } from '../../src/collections/Enquiries'
import {
  Contacts,
  Bookings,
  RevenueEntries,
  CustomerActivities,
} from '../../src/collections/CustomerRecords'
import { EmailTemplates, EmailMessages } from '../../src/collections/EmailRecords'
import { migrations as postgresMigrations } from '../../src/migrations'
// The adapter's migration API accepts unknown arguments; these generated files are PostgreSQL-specific.
const migrations = postgresMigrations.map((migration) => ({
  ...migration,
  up: (args: unknown) => migration.up(args as MigrateUpArgs),
  down: (args: unknown) => migration.down(args as MigrateDownArgs),
}))

test('additive migration preserves every legacy enquiry field, backfills separate contacts and honest historical facts once', async () => {
  const source = new URL(process.env.DATABASE_URL!)
  assert.ok(['localhost', '127.0.0.1'].includes(source.hostname))
  const database = `lunia_records_test_${Date.now()}`
  const client = new Client({ connectionString: source.href })
  await client.connect()
  await client.query(`CREATE DATABASE "${database}"`)
  source.pathname = `/${database}`
  let payload: Awaited<ReturnType<typeof getPayload>> | undefined
  try {
    payload = await getPayload({
      config: buildConfig({
        secret: 'synthetic-migration-test-only-long-secret',
        db: postgresAdapter({ pool: { connectionString: source.href }, push: false }),
        collections: [
          Users,
          Pages,
          Media,
          Enquiries,
          Contacts,
          Bookings,
          RevenueEntries,
          CustomerActivities,
          EmailTemplates,
          EmailMessages,
        ],
      }),
    })
    await payload.db.migrate({ shouldPrompt: false, migrations: migrations.slice(0, -1) })
    const before = await payload.db.pool
      .query(`INSERT INTO enquiries (service_id, service_title, name, email, message, follow_up, submission_hash, content_hash, attribution, notification_status, notification_attempts, notification_attempted_at, created_at, updated_at) VALUES
      ('synthetic:legacy', 'Synthetic legacy service', 'Synthetic legacy customer', 'legacy@example.test', 'Synthetic original message', 'contacted', 'synthetic-legacy-one', 'synthetic-hash-one', '{"status":"withheld","consent":"denied"}', 'accepted', 2, '2026-10-01T09:00:00Z', '2026-10-01T08:00:00Z', '2026-10-02T10:00:00Z'),
      ('synthetic:legacy', 'Synthetic legacy service', 'Synthetic different customer', 'legacy@example.test', 'Synthetic original second message', 'new', 'synthetic-legacy-two', 'synthetic-hash-two', '{"status":"unknown"}', 'failed', 1, NULL, '2026-10-01T10:00:00Z', '2026-10-01T10:00:00Z') RETURNING *`)
    await payload.db.migrate({ shouldPrompt: false, migrations })
    const after = await payload.db.pool.query('SELECT * FROM enquiries ORDER BY id')
    for (let i = 0; i < 2; i++) {
      const { contact_id, ...fields } = after.rows[i]
      assert.ok(contact_id)
      assert.deepEqual(fields, before.rows[i])
    }
    assert.notEqual(after.rows[0].contact_id, after.rows[1].contact_id)
    const events = await payload.find({
      collection: 'customer-activities',
      overrideAccess: true,
      limit: 100,
    })
    assert.equal(events.totalDocs, 4)
    assert.ok(events.docs.every((e) => e.source === 'migration'))
    assert.equal(
      (await payload.count({ collection: 'email-messages', overrideAccess: true })).totalDocs,
      0,
    )
    assert.equal(
      (await payload.find({ collection: 'email-templates', overrideAccess: true })).docs.filter(
        (t) => t.approved,
      ).length,
      0,
    )
    assert.equal(
      (await payload.db.migrate({ shouldPrompt: false, migrations }))?.migrated.length,
      0,
    )
    assert.equal(
      (await payload.count({ collection: 'contacts', overrideAccess: true })).totalDocs,
      2,
    )
  } finally {
    if (payload) {
      const pool = payload.db.pool
      await payload.destroy()
      await pool.end()
    }
    await client.query(`DROP DATABASE "${database}"`)
    await client.end()
  }
})
