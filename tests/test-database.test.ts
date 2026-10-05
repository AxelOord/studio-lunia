import { test } from 'vitest'
import assert from 'node:assert/strict'
import { localTestDatabaseURL } from './helpers/database'
import { syntheticEnvironment } from './helpers/environment'

test('test database configuration refuses hosted targets and hostname overrides before connecting', () => {
  for (const DATABASE_URL of [
    '',
    'not a URL',
    'postgresql://user:synthetic@db.example.test/data',
    'postgresql://user:synthetic@127.0.0.1/data?host=external.example.test',
    'postgresql://user:synthetic@127.0.0.1/data?hostaddr=198.51.100.2',
    'https://127.0.0.1/data',
  ])
    assert.throws(() => localTestDatabaseURL({ DATABASE_URL }))
  const DATABASE_URL = 'postgresql://user:synthetic@127.0.0.1/local'
  assert.throws(() => localTestDatabaseURL({ DATABASE_URL, VERCEL: '1' }))
  assert.throws(() => localTestDatabaseURL({ DATABASE_URL, NODE_ENV: 'production' }))
  assert.throws(() => localTestDatabaseURL({ DATABASE_URL, VERCEL_ENV: 'production' }))
  assert.equal(localTestDatabaseURL({ DATABASE_URL }).hostname, '127.0.0.1')
})

test('local test processes discard inherited provider credentials and disable delivery and tracking', () => {
  const source = {
    NODE_ENV: 'test' as const,
    PATH: '/synthetic/bin',
    LUNIA_STORAGE: 'private-blob',
    BLOB_READ_WRITE_TOKEN: 'synthetic-do-not-use',
    RESEND_API_KEY: 'synthetic-do-not-use',
    POSTHOG_PROJECT_TOKEN: 'synthetic-do-not-use',
    PREVIEW_EDITOR_PASSWORD: 'synthetic-do-not-use',
    MAIL_FROM: 'synthetic-do-not-use',
    CMS_ORIGIN: 'https://synthetic.example.test',
    LUNIA_POSTHOG_ENABLED: 'true',
    LUNIA_RESEND_WEBHOOKS_ENABLED: 'true',
  }
  const database = 'postgresql://synthetic@127.0.0.1/owned'
  const env = syntheticEnvironment(source, database)
  assert.equal(env.DATABASE_URL, database)
  assert.equal(env.PATH, source.PATH)
  assert.equal(env.LUNIA_POSTHOG_ENABLED, 'false')
  assert.equal(env.LUNIA_RESEND_WEBHOOKS_ENABLED, 'false')
  assert.equal(env.LUNIA_CMS_PREVIEW, 'false')
  assert.equal(JSON.stringify(env).includes('synthetic-do-not-use'), false)
  assert.equal('CMS_ORIGIN' in env, false)
  assert.equal('LUNIA_STORAGE' in env, false)
  assert.equal(source.LUNIA_POSTHOG_ENABLED, 'true')
})
