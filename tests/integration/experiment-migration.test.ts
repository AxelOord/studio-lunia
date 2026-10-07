import { test, expect } from 'vitest'
import { createLocalReq } from 'payload'
import { createEditor, createTestCMS, testMigrations } from '../helpers/payload'
import { up, down } from '../../src/migrations/20261006_022147_experiment_groundwork'

test('experiment migration preserves published and draft page content, reverses empty groundwork and protects saved plans', async () => {
  const fixture = await createTestCMS(undefined, { migrate: false })
  const { payload } = fixture
  try {
    const index = testMigrations.findIndex(
      (m) => m.name === '20261006_022147_experiment_groundwork',
    )
    expect(index).toBeGreaterThan(0)
    await payload.db.migrate({ shouldPrompt: false, migrations: testMigrations.slice(0, index) })
    const db = payload.db.pool
    const published = (
      await db.query(
        "INSERT INTO pages (title,slug,description,_status) VALUES ('Original published page','experiment-original','Original description','published') RETURNING *",
      )
    ).rows[0]
    const draft = (
      await db.query(
        "INSERT INTO _pages_v (parent_id,version_title,version_slug,version_description,version__status,latest) VALUES ($1,'Private original draft','experiment-original','Private description','draft',true) RETURNING *",
        [published.id],
      )
    ).rows[0]
    const args = { db: payload.db.drizzle, payload, req: await createLocalReq({}, payload) }
    await up(args)
    expect(
      (await db.query('SELECT * FROM pages WHERE id=$1', [published.id])).rows[0],
    ).toMatchObject({ ...published, inquiry_button_label: null })
    expect(
      (await db.query('SELECT * FROM _pages_v WHERE id=$1', [draft.id])).rows[0],
    ).toMatchObject({ ...draft, version_inquiry_button_label: null })
    expect((await db.query('SELECT * FROM experiments')).rows).toEqual([])
    await down(args)
    expect((await db.query('SELECT * FROM pages WHERE id=$1', [published.id])).rows[0]).toEqual(
      published,
    )
    expect((await db.query('SELECT * FROM _pages_v WHERE id=$1', [draft.id])).rows[0]).toEqual(
      draft,
    )
    await up(args)
    const user = await createEditor(payload)
    const plan = await payload.create({
      collection: 'experiments',
      user,
      overrideAccess: false,
      data: {
        name: 'Synthetic preserved plan',
        hypothesis: 'Synthetic planning only',
        page: published.id,
        treatmentLabel: 'Synthetic alternate CTA',
        mode: 'simulation',
        state: 'draft',
        treatmentPercent: 50,
        minimumPerVariant: 1000,
        durationDays: 14,
      },
    })
    expect(plan).toMatchObject({ mode: 'simulation', state: 'draft' })
    await expect(down(args)).rejects.toThrow('Experiment records exist')
    expect(
      (
        await payload.findByID({
          collection: 'experiments',
          id: plan.id,
          user,
          overrideAccess: false,
        })
      ).name,
    ).toBe('Synthetic preserved plan')
  } finally {
    await fixture.close()
  }
})
