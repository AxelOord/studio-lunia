import { test } from 'vitest'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
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
    POSTHOG_QUERY_READ_KEY: 'synthetic-do-not-use',
    POSTHOG_REPORT_PROJECT_ID: '123',
    LUNIA_POSTHOG_REPORTING_ENABLED: 'true',
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
  assert.equal(env.LUNIA_POSTHOG_REPORTING_ENABLED, 'false')
  assert.equal(env.LUNIA_RESEND_WEBHOOKS_ENABLED, 'false')
  assert.equal(env.LUNIA_CMS_PREVIEW, 'false')
  assert.equal(JSON.stringify(env).includes('synthetic-do-not-use'), false)
  assert.equal(env.CMS_ORIGIN, '')
  assert.equal(env.LUNIA_STORAGE, '')
  assert.equal(source.LUNIA_POSTHOG_ENABLED, 'true')
})

test.each(['dotenv', 'next'])(
  '%s in a fresh child cannot restore provider settings or replace the owned database',
  async (loader) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'lunia-env-regression-'))
    const require = createRequire(import.meta.url)
    const database = 'postgresql://synthetic@127.0.0.1/owned-test-database'
    const settings = [
      'DATABASE_URL=postgresql://synthetic@remote.example.test/never-connect',
      'DATABASE_URL_UNPOOLED=postgresql://synthetic@remote.example.test/never-connect',
      'PAYLOAD_SECRET=synthetic-do-not-use',
      'LUNIA_STORAGE=private-blob',
      'BLOB_READ_WRITE_TOKEN=synthetic-do-not-use',
      'CMS_ORIGIN=https://synthetic.example.test',
      'RESEND_API_KEY=synthetic-do-not-use',
      'RESEND_WEBHOOK_SECRET=synthetic-do-not-use',
      'POSTHOG_PROJECT_TOKEN=synthetic-do-not-use',
      'POSTHOG_QUERY_READ_KEY=synthetic-do-not-use',
      'POSTHOG_REPORT_PROJECT_ID=123',
      'LUNIA_POSTHOG_REPORTING_ENABLED=true',
      'PREVIEW_EDITOR_PASSWORD=synthetic-do-not-use',
      'LUNIA_CMS_PREVIEW=true',
      'LUNIA_POSTHOG_ENABLED=true',
      'LUNIA_RESEND_WEBHOOKS_ENABLED=true',
    ].join('\n')
    try {
      for (const file of ['.env', '.env.local', '.env.production'])
        await writeFile(path.join(directory, file), settings)
      const script = `
        const assert = require('node:assert/strict')
        if (process.argv[1] === 'dotenv') require(process.argv[2])
        else require(process.argv[3]).loadEnvConfig(process.cwd(), false)
        const env = process.env
        for (const key of ['LUNIA_STORAGE', 'BLOB_READ_WRITE_TOKEN', 'CMS_ORIGIN',
          'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'POSTHOG_PROJECT_TOKEN', 'POSTHOG_QUERY_READ_KEY', 'POSTHOG_REPORT_PROJECT_ID',
          'PREVIEW_EDITOR_PASSWORD']) assert.equal(env[key], '', key + ' was rehydrated')
        assert.equal(env.DATABASE_URL, process.argv[4], 'owned database changed')
        assert.equal(env.DATABASE_URL_UNPOOLED, process.argv[4], 'unpooled database changed')
        assert.equal(env.PAYLOAD_SECRET, 'synthetic-verification-signing-secret-only')
        for (const key of ['LUNIA_CMS_PREVIEW', 'LUNIA_POSTHOG_ENABLED', 'LUNIA_POSTHOG_REPORTING_ENABLED',
          'LUNIA_RESEND_WEBHOOKS_ENABLED']) assert.equal(env[key], 'false', key)
      `
      const result = spawnSync(
        process.execPath,
        [
          '-e',
          script,
          loader,
          require.resolve('dotenv/config'),
          require.resolve('@next/env'),
          database,
        ],
        {
          cwd: directory,
          encoding: 'utf8',
          timeout: 10000,
          env: syntheticEnvironment(
            { NODE_ENV: 'production', DOTENV_CONFIG_OVERRIDE: 'true' },
            database,
          ),
        },
      )
      assert.equal(result.status, 0, result.stderr)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
)
