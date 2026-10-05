import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  approvedOrigin,
  cmsOrigin,
  cmsAllowedOrigins,
  deploymentMode,
  PREVIEW_PROJECT,
  resetEmail,
} from '../src/hosting/environment'
const preview = {
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  VERCEL_PROJECT_ID: PREVIEW_PROJECT,
  VERCEL_GIT_COMMIT_REF: 'feature/cms',
  VERCEL_GIT_REPO_OWNER: 'AxelOord',
  VERCEL_GIT_REPO_SLUG: 'studio-lunia',
  VERCEL_BRANCH_URL: 'studio-lunia-test.vercel.app',
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
test('hosted mode requires exact project/repository and nonrelease branch and explicit reviewed configuration', () => {
  assert.equal(deploymentMode(preview), 'preview')
  for (const patch of [
    { VERCEL_PROJECT_ID: 'old-project' },
    { VERCEL_GIT_COMMIT_REF: 'master' },
    { VERCEL_GIT_REPO_OWNER: 'fork-owner' },
    { VERCEL_GIT_REPO_SLUG: 'other-repo' },
    { VERCEL_BRANCH_URL: '' },
    { LUNIA_PREVIEW_REVIEW: '' },
    { BLOB_READ_WRITE_TOKEN: '' },
    { RESEND_API_KEY: '' },
    { LUNIA_STORAGE: 'local' },
    { DATABASE_URL: 'postgres://db/preview' },
    { VERCEL_BRANCH_URL: 'other.test' },
    { LUNIA_SHOWCASE: 'true' },
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

test('native branch origin wins over obsolete manual origin', () => {
  assert.equal(
    cmsOrigin({ ...preview, CMS_ORIGIN: 'https://obsolete.vercel.app' }),
    'https://studio-lunia-test.vercel.app',
  )
  assert.equal(deploymentMode({ ...preview, VERCEL_GIT_COMMIT_REF: 'feature/second' }), 'preview')
})

test('CMS allows provider branch and deployment origins without trusting arbitrary hosts', () => {
  assert.deepEqual(cmsAllowedOrigins({ ...preview, VERCEL_URL: 'studio-lunia-hash.vercel.app' }), [
    'https://studio-lunia-test.vercel.app',
    'https://studio-lunia-hash.vercel.app',
  ])
  assert.throws(() => cmsAllowedOrigins({ ...preview, VERCEL_URL: 'malicious.example' }))
})
