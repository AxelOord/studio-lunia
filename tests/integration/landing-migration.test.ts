import { test, expect } from 'vitest'
import { createLocalReq } from 'payload'
import { createTestCMS, testMigrations } from '../helpers/payload'
import { up, down } from '../../src/migrations/20261005_231620_service_inquiry_landings'

test('landing migration preserves existing published pages, service IDs and private draft versions', async () => {
  const fixture = await createTestCMS(undefined, { migrate: false })
  const { payload } = fixture
  try {
    const index = testMigrations.findIndex(
      (item) => item.name === '20261005_231620_service_inquiry_landings',
    )
    expect(index).toBeGreaterThan(0)
    await payload.db.migrate({ shouldPrompt: false, migrations: testMigrations.slice(0, index) })
    const db = payload.db.pool
    await db.query(
      "INSERT INTO pages (id,title,slug,description,_status) VALUES (1,'Synthetic original','synthetic-original','Published description','published')",
    )
    await db.query(
      "INSERT INTO pages_blocks_services (_order,_parent_id,_path,id,heading) VALUES (0,1,'layout','original-block','Original services')",
    )
    await db.query(
      "INSERT INTO pages_blocks_services_items (_order,_parent_id,id,title,body) VALUES (0,'original-block','original-item','Original service','Original body')",
    )
    await db.query(
      "INSERT INTO _pages_v (id,parent_id,version_title,version_slug,version_description,version__status,latest) VALUES (1,1,'Private draft','synthetic-original','Private description','draft',true)",
    )
    await db.query(
      "INSERT INTO _pages_v_blocks_services (id,_order,_parent_id,_path,heading,_uuid) VALUES (1,0,1,'layout','Private services','original-block')",
    )
    await db.query(
      "INSERT INTO _pages_v_blocks_services_items (_order,_parent_id,title,body,_uuid) VALUES (0,1,'Private service','Private body','original-item')",
    )
    const tables = [
      'pages',
      'pages_blocks_services',
      'pages_blocks_services_items',
      '_pages_v',
      '_pages_v_blocks_services',
      '_pages_v_blocks_services_items',
    ]
    const before = await Promise.all(
      tables.map(async (table) => (await db.query(`SELECT * FROM "${table}" ORDER BY id`)).rows),
    )
    const req = await createLocalReq({}, payload)
    const args = { db: payload.db.drizzle, payload, req }
    await up(args)
    for (const [index, table] of tables.entries()) {
      const after = (await db.query(`SELECT * FROM "${table}" ORDER BY id`)).rows
      expect(after).toHaveLength(before[index].length)
      expect(after[0]).toMatchObject(before[index][0])
    }
    expect((await db.query('SELECT inquiry_service FROM pages')).rows[0].inquiry_service).toBeNull()
    await down(args)
    for (const [index, table] of tables.entries())
      expect((await db.query(`SELECT * FROM "${table}" ORDER BY id`)).rows).toEqual(before[index])
    await up(args)
    // The application config follows the latest schema. Preserve this migration's
    // exact up/down assertions above, then apply later additions before the public read.
    for (const migration of testMigrations.slice(index + 1)) await migration.up(args)
    expect(
      (await payload.find({ collection: 'pages', overrideAccess: false })).docs[0].layout[0],
    ).toMatchObject({
      heading: 'Original services',
      items: [{ id: 'original-item', title: 'Original service' }],
    })
  } finally {
    await fixture.close()
  }
})
