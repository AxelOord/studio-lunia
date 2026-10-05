import { test, expect } from 'vitest'
import { createLocalReq } from 'payload'
import { createTestCMS, testMigrations } from '../helpers/payload'
import { up, down } from '../../src/migrations/20261005_211842_customer_followups'

test('follow-up migration preserves existing customer data and can roll back its own empty test schema', async () => {
  const fixture = await createTestCMS(undefined, { migrate: false })
  const payload = fixture.payload
  try {
    const index = testMigrations.findIndex(
      (item) => item.name === '20261005_211842_customer_followups',
    )
    expect(index).toBeGreaterThan(0)
    await payload.db.migrate({ shouldPrompt: false, migrations: testMigrations.slice(0, index) })
    const before = (
      await payload.db.pool.query(
        "INSERT INTO contacts (name,email,notes) VALUES ('Synthetic existing customer','migration@example.test','Private original note') RETURNING *",
      )
    ).rows[0]
    const req = await createLocalReq({}, payload)
    const args = { db: payload.db.drizzle, payload, req }
    await up(args)
    const after = (await payload.db.pool.query('SELECT * FROM contacts WHERE id = $1', [before.id]))
      .rows[0]
    const { follow_ups_stopped, ...preserved } = after
    expect(follow_ups_stopped).toBe(false)
    expect(preserved).toEqual(before)
    expect(
      (await payload.count({ collection: 'follow-up-rules', overrideAccess: true })).totalDocs,
    ).toBe(0)
    await down(args)
    expect(
      (await payload.db.pool.query('SELECT * FROM contacts WHERE id = $1', [before.id])).rows[0],
    ).toEqual(before)
    await up(args)
    expect(
      (await payload.count({ collection: 'follow-ups', overrideAccess: true })).totalDocs,
    ).toBe(0)
  } finally {
    await fixture.close()
  }
})
