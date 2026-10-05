import 'dotenv/config'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { buildConfig } from 'payload'
import { createTestCMS, testMigrations as migrations } from '../helpers/payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
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
test('additive migration preserves every legacy enquiry field, backfills separate contacts and honest historical facts once', async () => {
  const fixture = await createTestCMS(
    (url, directory) =>
      buildConfig({
        secret: 'synthetic-migration-test-only-long-secret',
        db: postgresAdapter({ pool: { connectionString: url, max: 5 }, push: false }),
        collections: [
          Users,
          Pages,
          { ...Media, upload: { ...(Media.upload as object), staticDir: directory } },
          Enquiries,
          Contacts,
          Bookings,
          RevenueEntries,
          CustomerActivities,
          EmailTemplates,
          EmailMessages,
        ],
      }),
    { migrate: false },
  )
  const payload = fixture.payload
  try {
    await payload.db.migrate({
      shouldPrompt: false,
      migrations: migrations.slice(
        0,
        migrations.findIndex(
          (migration) => migration.name === '20261005_181401_customer_records_email_history',
        ),
      ),
    })
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
    await fixture.close()
  }
})
