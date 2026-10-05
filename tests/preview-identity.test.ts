import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertMediaNamespace, previewNamespace } from '../src/hosting/preview-identity'

test('media namespaces are stable per full branch and cannot alias after truncation', () => {
  const env = { VERCEL: '1', VERCEL_PROJECT_ID: 'project', VERCEL_GIT_COMMIT_REF: 'feature/a' }
  const prefix = previewNamespace(env)
  assert.equal(previewNamespace({ ...env }), prefix)
  for (const ref of ['feature-a', 'feature/a-other', 'Feature/a'])
    assert.notEqual(previewNamespace({ ...env, VERCEL_GIT_COMMIT_REF: ref }), prefix)
  assert.equal(
    assertMediaNamespace(`${prefix}/object/image.webp`, prefix),
    `${prefix}/object/image.webp`,
  )
  for (const key of [
    `${prefix}-other/image.webp`,
    `${prefix}/../other/image.webp`,
    'preview-media/foreign/image.webp',
  ])
    assert.throws(() => assertMediaNamespace(key, prefix))
})
