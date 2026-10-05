import { test } from 'vitest'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { PREVIEW_PROJECT } from '../src/hosting/environment'

const env: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PATH: process.env.PATH,
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  VERCEL_PROJECT_ID: PREVIEW_PROJECT,
  VERCEL_GIT_REPO_OWNER: 'AxelOord',
  VERCEL_GIT_REPO_SLUG: 'studio-lunia',
  VERCEL_GIT_COMMIT_REF: 'feature/test',
  VERCEL_BRANCH_URL: 'studio-lunia-test.vercel.app',
  LUNIA_SHOWCASE: 'false',
  LUNIA_CMS_PREVIEW: 'true',
  LUNIA_PREVIEW_REVIEW: 'approved',
  LUNIA_STORAGE: 'private-blob',
  PAYLOAD_SECRET: 'synthetic-build-test-only-long-secret',
  BLOB_READ_WRITE_TOKEN: 'synthetic',
  RESEND_API_KEY: 'synthetic',
  MAIL_FROM: 'test@example.test',
  PREVIEW_EDITOR_EMAIL: 'editor@example.test',
  PREVIEW_EDITOR_PASSWORD: 'PRIVATE_MARKER_dummy_preview_default',
  DATABASE_URL:
    'postgresql://synthetic:PRIVATE_MARKER@db-pooler.example.test/preview?sslmode=require',
  DATABASE_URL_UNPOOLED:
    'postgresql://synthetic:PRIVATE_MARKER@db.example.test/preview?sslmode=require',
}
test('preview build fails closed before build for unsafe config and hides provider errors', () => {
  for (const patch of [
    { VERCEL_ENV: 'production' },
    { LUNIA_SHOWCASE: 'true' },
    { DATABASE_URL_UNPOOLED: '' },
    { DATABASE_URL_UNPOOLED: env.DATABASE_URL_UNPOOLED!.replace('/preview?', '/other?') },
    {},
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `
      import { Client } from 'pg';
      Client.prototype.connect = async () => { throw new Error('PRIVATE_MARKER'); };
      Client.prototype.end = async () => {};
      await import('./scripts/preview-build.ts');
    `,
      ],
      { env: { ...env, ...patch }, encoding: 'utf8', timeout: 15000 },
    )
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Full CMS preview preparation failed/)
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_MARKER|Next.js|showcase complete/)
  }
})
