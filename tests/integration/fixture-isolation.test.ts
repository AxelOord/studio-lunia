import { test } from 'vitest'
import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { Client } from 'pg'
import { createTestDatabase, localTestDatabaseURL } from '../helpers/database'
import { createTestCMS } from '../helpers/payload'

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

test('failed CMS setup removes its owned database and media directory and restores the connection', async () => {
  const previous = process.env.DATABASE_URL
  let name = ''
  let directory = ''
  await assert.rejects(
    createTestCMS(async (url, mediaDirectory) => {
      name = new URL(url).pathname.slice(1)
      directory = mediaDirectory
      throw new Error('Synthetic configuration failure')
    }),
    /Synthetic configuration failure/,
  )
  assert.equal(process.env.DATABASE_URL, previous)
  await assert.rejects(access(directory), { code: 'ENOENT' })
  const url = localTestDatabaseURL(process.env)
  url.pathname = '/postgres'
  const admin = new Client({ connectionString: url.href })
  try {
    await admin.connect()
    assert.equal(
      (await admin.query('SELECT datname FROM pg_database WHERE datname = $1', [name])).rowCount,
      0,
    )
  } finally {
    await admin.end()
  }
})
