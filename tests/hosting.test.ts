import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  approvedOrigin,
  deploymentMode,
  PREVIEW_PROJECT,
  resetEmail,
} from '../src/hosting/environment'
const preview = {
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  VERCEL_PROJECT_ID: PREVIEW_PROJECT,
  VERCEL_GIT_COMMIT_REF: 'feature/cms',
  LUNIA_CMS_BRANCH: 'feature/cms',
  LUNIA_CMS_PREVIEW: 'true',
  LUNIA_PREVIEW_REVIEW: 'approved',
  LUNIA_STORAGE: 'private-blob',
  DATABASE_URL: 'postgresql://synthetic:synthetic@db.example.test/preview?sslmode=require',
  PAYLOAD_SECRET: 'synthetic-secret-for-tests-only-123456',
  BLOB_READ_WRITE_TOKEN: 'synthetic',
  CMS_ORIGIN: 'https://studio-lunia-test.vercel.app',
  RESEND_API_KEY: 'synthetic',
  MAIL_FROM: 'preview@example.test',
  PREVIEW_EDITOR_EMAIL: 'editor@example.test',
}
test('hosted mode requires exact project/branch and explicit reviewed configuration', () => {
  assert.equal(deploymentMode(preview), 'preview')
  for (const patch of [
    { VERCEL_PROJECT_ID: 'old-project' },
    { VERCEL_GIT_COMMIT_REF: 'other-branch' },
    { LUNIA_PREVIEW_REVIEW: '' },
    { BLOB_READ_WRITE_TOKEN: '' },
    { RESEND_API_KEY: '' },
    { LUNIA_STORAGE: 'local' },
    { DATABASE_URL: 'postgres://db/preview' },
    { CMS_ORIGIN: 'https://other.test' },
  ])
    assert.throws(() => deploymentMode({ ...preview, ...patch }))
})
test('showcase stays available without credentials while production always fails', () => {
  assert.equal(deploymentMode({ VERCEL: '1', LUNIA_SHOWCASE: 'true' }), 'showcase')
  assert.equal(deploymentMode({}), 'local')
  assert.throws(() => deploymentMode({ VERCEL: '1' }))
  assert.throws(() => deploymentMode({ LUNIA_CMS_PREVIEW: 'true' }))
  assert.throws(() => deploymentMode({ VERCEL_ENV: 'production', LUNIA_SHOWCASE: 'true' }))
})
test('recovery links use a fixed validated origin and encode tokens', () => {
  assert.throws(() => approvedOrigin('https://user:secret@example.test/'))
  assert.throws(() => approvedOrigin('https://example.test/redirect?to=evil'))
  const html = resetEmail('https://preview.vercel.app', '"><img src=x>')
  assert.ok(html.includes('https://preview.vercel.app/admin/reset/%22%3E%3Cimg%20src%3Dx%3E'))
  assert.ok(!html.includes('<img'))
})
