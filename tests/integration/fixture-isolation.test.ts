import { test } from 'vitest'
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { Client } from 'pg'
import type { Payload } from 'payload'
import { createTestDatabase, localTestDatabaseURL } from '../helpers/database'
import { applicationConfig, createTestCMS } from '../helpers/payload'

test('concurrent fixtures isolate records and removing one leaves the other usable', async () => {
  const first = await createTestDatabase()
  const second = await createTestDatabase()
  const a = new Client({ connectionString: first.url })
  const b = new Client({ connectionString: second.url })
  try {
    assert.notEqual(first.name, second.name)
    await Promise.all([a.connect(), b.connect()])
    await Promise.all([
      a.query('CREATE TABLE owned_fixture (value text)'),
      b.query('CREATE TABLE owned_fixture (value text)'),
    ])
    await a.query("INSERT INTO owned_fixture VALUES ('first')")
    await b.query("INSERT INTO owned_fixture VALUES ('second')")
    assert.equal((await a.query('SELECT value FROM owned_fixture')).rows[0].value, 'first')
    assert.equal((await b.query('SELECT value FROM owned_fixture')).rows[0].value, 'second')
    await a.end()
    await first.close()
    assert.equal((await b.query('SELECT value FROM owned_fixture')).rows[0].value, 'second')
  } finally {
    await Promise.allSettled([a.end(), b.end()])
    await Promise.all([first.close(), second.close()])
  }
})

test.each(['configuration', 'initialization'])(
  'failed CMS %s removes its owned database and media directory and restores the connection',
  async (phase) => {
    const previous = process.env.DATABASE_URL
    let name = ''
    let directory = ''
    let initialized: Payload | undefined
    const url = localTestDatabaseURL(process.env)
    url.pathname = '/postgres'
    const admin = new Client({ connectionString: url.href })
    await admin.connect()
    try {
      await assert.rejects(
        createTestCMS(async (databaseURL, mediaDirectory) => {
          name = new URL(databaseURL).pathname.slice(1)
          directory = mediaDirectory
          if (phase === 'configuration') throw new Error('Synthetic configuration failure')
          const config = await applicationConfig(databaseURL, mediaDirectory)
          config.onInit = async (instance) => {
            initialized = instance
            // Fail after the real adapter has opened its PostgreSQL pool.
            throw new Error('Synthetic initialization failure')
          }
          return config
        }),
        new RegExp(`Synthetic ${phase} failure`),
      )
      assert.equal(process.env.DATABASE_URL, previous)
      await assert.rejects(access(directory), { code: 'ENOENT' })
      assert.equal(
        (await admin.query('SELECT datname FROM pg_database WHERE datname = $1', [name])).rowCount,
        0,
      )
    } finally {
      // Even a failing cleanup regression leaves only its own temporary database removed.
      if (initialized && !initialized.db.pool.ended) await initialized.db.pool.end()
      try {
        if (/^lunia_test_[a-f0-9]{32}$/.test(name))
          await admin.query(`DROP DATABASE IF EXISTS "${name}"`)
      } finally {
        await admin.end()
      }
    }
  },
)
