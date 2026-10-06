import { test, expect } from 'vitest'
import { createLocalReq } from 'payload'
import { createTestCMS, testMigrations } from '../helpers/payload'
import { up, down } from '../../src/migrations/20261005_234950_studio_days_session_slots'

test('studio migration preserves legacy booking commitments and supports reversal before studio data exists', async () => {
  const fixture = await createTestCMS(undefined, { migrate: false })
  const { payload } = fixture
  try {
    const index = testMigrations.findIndex(
      (item) => item.name === '20261005_234950_studio_days_session_slots',
    )
    expect(index).toBeGreaterThan(0)
    await payload.db.migrate({ shouldPrompt: false, migrations: testMigrations.slice(0, index) })
    const db = payload.db.pool
    await db.query(
      "INSERT INTO contacts (id,name,email) VALUES (1,'Synthetic original customer','studio-migration@example.test')",
    )
    await db.query(
      "INSERT INTO enquiries (id,contact_id,service_id,service_title,name,email,message,submission_hash,content_hash,attribution) VALUES (1,1,'1:synthetic','Synthetic original offer','Synthetic original customer','studio-migration@example.test','Private original note','original-submission','original-content','{}')",
    )
    const before = (
      await db.query(
        "INSERT INTO bookings (title,contact_id,enquiry_id,source,status,session_at,expected_minor,currency,attribution) VALUES ('Original commitment',1,1,'staff_enquiry','confirmed','2027-04-01T09:00:00Z',45600,'EUR','{\"status\":\"withheld\"}') RETURNING *",
      )
    ).rows[0]
    const args = { db: payload.db.drizzle, payload, req: await createLocalReq({}, payload) }
    await up(args)
    expect(
      (await db.query('SELECT * FROM bookings WHERE id = $1', [before.id])).rows[0],
    ).toMatchObject(before)
    expect(
      (await payload.count({ collection: 'studio-days', overrideAccess: true })).totalDocs,
    ).toBe(0)
    await down(args)
    expect((await db.query('SELECT * FROM bookings WHERE id = $1', [before.id])).rows[0]).toEqual(
      before,
    )
    await up(args)
    expect(
      (await payload.findByID({ collection: 'bookings', id: before.id, overrideAccess: true }))
        .status,
    ).toBe('confirmed')
  } finally {
    await fixture.close()
  }
})
