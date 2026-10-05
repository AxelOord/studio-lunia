import { test } from 'vitest'
import assert from 'node:assert/strict'
import { permittedAttribution } from '../src/lib/attribution'
import { validSlug } from '../src/lib/validation'

test('unknown and denied consent discard all campaign identifiers', () => {
  for (const consent of ['unknown', 'denied'] as const)
    assert.deepEqual(
      permittedAttribution(new URLSearchParams('utm_source=google&gclid=test'), consent),
      { source: 'unknown', consent },
    )
})
test('tagged channels share the contract without an integration claim', () => {
  const result = permittedAttribution(
    new URLSearchParams(
      'utm_source=newsletter&utm_medium=email&utm_campaign=autumn&email=private@example.test',
    ),
    'granted',
  )
  assert.equal(result.source, 'newsletter')
  assert.equal(result.campaign, 'autumn')
  assert.ok(!JSON.stringify(result).includes('private'))
})
test('missing attribution remains unknown; click IDs can identify Google', () => {
  assert.equal(permittedAttribution(new URLSearchParams(), 'granted').source, 'unknown')
  assert.equal(
    permittedAttribution(new URLSearchParams('gclid=abc_123'), 'granted').source,
    'google',
  )
})
test('malformed or overlong parameters are discarded', () => {
  const p = new URLSearchParams({ utm_source: '<script>', gclid: 'a'.repeat(121) })
  assert.equal(permittedAttribution(p, 'granted').source, 'unknown')
})
test('preview slugs cannot become open redirects or paths', () => {
  for (const slug of [
    null,
    '//example.com',
    '../admin',
    'foo/bar',
    'https://evil.test',
    'a'.repeat(121),
  ])
    assert.equal(validSlug(slug), false)
  assert.equal(validSlug('home'), true)
})
