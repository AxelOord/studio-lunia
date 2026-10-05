import 'dotenv/config'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { validateInquiry } from '../src/lib/inquiry'
import {
  campaignTouch,
  updateCampaign,
  validateCampaign,
  campaignSource,
  CAMPAIGN_TTL,
} from '../src/lib/campaign'
import {
  seal,
  unseal,
  readPreferences,
  leadAttribution,
  preferenceCookie,
} from '../src/inquiries/privacy'
import { measurementPayload, captureMeasurement } from '../src/inquiries/measurement'
import { boundedJSON, sameOrigin } from '../src/inquiries/http'
import type { Payload } from 'payload'

const input = {
  service: '1:synthetic',
  name: 'Synthetic Visitor',
  email: 'SYNTHETIC@example.test',
  message: 'A synthetic photography enquiry.',
  website: '',
  submissionId: randomUUID(),
}
test('enquiry validation preserves text while normalizing operational email and rejecting spam/invalid fields', () => {
  assert.equal(validateInquiry(input).data?.email, 'synthetic@example.test')
  for (const [key, value] of Object.entries({
    service: '../admin',
    name: 'x',
    email: 'not an email',
    message: 'short',
    website: 'https://bot.test',
    submissionId: 'x',
  }))
    assert.ok(validateInquiry({ ...input, [key]: value }).errors[key as keyof typeof input])
  assert.ok(validateInquiry({ ...input, message: 'x'.repeat(3001) }).errors.message)
  assert.ok(validateInquiry({ ...input, name: 'Name\r\nInjected' }).errors.name)
  assert.ok(validateInquiry(null).errors.service)
})
test('campaign matrix keeps supported channel identifiers and discards free text, PII and arbitrary parameters', () => {
  const touch = campaignTouch(
    {
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'autumn',
      utm_id: 'campaign-42',
      utm_content: 'card_a',
      utm_term: 'personal search terms',
      email: 'private@example.test',
      gclid: 'ABC_123',
      gbraid: 'GB-123',
      wbraid: 'WB-123',
      unknown: 'secret',
    },
    'direct',
    1000,
  )
  assert.equal(Object.keys(touch.tags).length, 8)
  assert.equal(touch.kind, 'tagged')
  assert.equal(campaignSource(touch), 'newsletter')
  assert.equal(campaignSource(campaignTouch({ gclid: 'ABC123' }, 'unknown')), 'google')
  assert.equal(campaignTouch({}, 'direct').kind, 'direct')
  assert.equal(campaignTouch({}, 'untagged').kind, 'untagged')
  assert.equal(campaignTouch({}, 'bad').kind, 'unknown')
  assert.equal(campaignTouch({ utm_source: '<invalid>' }, 'direct').kind, 'unknown')
  for (const unsafe of [
    'private@example.test',
    'https://test.example',
    '<script>',
    'x'.repeat(121),
    '0612345678',
    'hello world',
  ])
    assert.deepEqual(campaignTouch({ utm_source: unsafe }, 'unknown').tags, {})
  assert.ok(!JSON.stringify(touch).includes('private'))
})
test('first/last attribution has a fixed 30-day deadline and validates untrusted shapes', () => {
  const now = Date.now()
  const first = updateCampaign(
    undefined,
    campaignTouch({ utm_source: 'google' }, 'direct', now - 100),
  )
  const second = updateCampaign(first, campaignTouch({ utm_source: 'newsletter' }, 'direct', now))
  assert.equal(second.first.tags.utm_source, 'google')
  assert.equal(second.last.tags.utm_source, 'newsletter')
  assert.equal(second.expiresAt, first.expiresAt)
  assert.deepEqual(updateCampaign(second, campaignTouch({}, 'direct', now)), second)
  assert.deepEqual(validateCampaign(second, now), second)
  for (const value of [
    null,
    {},
    { ...second, expiresAt: now - 1 },
    { ...second, expiresAt: now + CAMPAIGN_TTL + 1 },
    { ...second, last: { ...second.last, tags: { email: 'private@example.test' } } },
  ])
    assert.equal(validateCampaign(value, now), undefined)
})
test('signed first-party preferences reject forgery, expiry, cross-purpose, oversized and malformed values', () => {
  const choice = { analytics: true, campaigns: false, decided: true }
  const token = seal(preferenceCookie, choice, 100, 1000)
  assert.deepEqual(unseal(preferenceCookie, token, 2000), choice)
  for (const value of [token + 'x', token.replace(/^./, 'Z'), 'x'.repeat(4000), 'x.y.z', undefined])
    assert.equal(unseal(preferenceCookie, value, 2000), undefined)
  assert.equal(unseal('other', token, 2000), undefined)
  assert.equal(
    unseal(preferenceCookie, `${token.split('.')[0]}.${'é'.repeat(43)}`, 2000),
    undefined,
  )
  assert.equal(unseal(preferenceCookie, token, 102000), undefined)
  assert.equal(readPreferences(seal(preferenceCookie, { analytics: 'yes' }, 100)).analytics, false)
  assert.equal(readPreferences().decided, false)
})
test('withheld consent never carries campaign identifiers into operational attribution', () => {
  const campaign = updateCampaign(undefined, campaignTouch({ gclid: 'ABC_123' }, 'direct'))
  for (const decided of [false, true]) {
    const result = leadAttribution({ analytics: false, campaigns: false, decided }, campaign)
    assert.equal(result.status, 'withheld')
    assert.ok(!('snapshot' in result))
  }
})
test('analytics payload contains only approved identifiers and fixed privacy properties, with stable duplicate identity', () => {
  const session = randomUUID()
  const data = measurementPayload(session, '1:synthetic', 'inquiry_submitted')
  assert.equal(data.uuid, measurementPayload(session, '1:synthetic', 'inquiry_submitted').uuid)
  assert.notEqual(data.uuid, measurementPayload(session, '1:synthetic', 'service_viewed').uuid)
  assert.deepEqual(Object.keys(data.properties).sort(), [
    '$geoip_disable',
    '$ip',
    '$process_person_profile',
    'schema_version',
    'service_id',
  ])
  assert.equal(data.properties.$process_person_profile, false)
  assert.equal(data.properties.$geoip_disable, true)
  assert.equal(data.properties.$ip, null)
  assert.throws(() => measurementPayload('private@example.test', '1:synthetic', 'inquiry_started'))
  assert.throws(() => measurementPayload(session, '/inquire?email=private', 'inquiry_started'))
})
test('unconfigured or non-consenting measurement never touches the database or provider', async () => {
  const fail = async () => {
    throw new Error('Must not call provider')
  }
  assert.equal(
    await captureMeasurement({} as Payload, undefined, '1:synthetic', 'service_viewed', fail),
    'disabled',
  )
  const old = process.env.LUNIA_POSTHOG_ENABLED
  process.env.LUNIA_POSTHOG_ENABLED = 'false'
  try {
    assert.equal(
      await captureMeasurement({} as Payload, randomUUID(), '1:synthetic', 'service_viewed', fail),
      'disabled',
    )
  } finally {
    if (old === undefined) delete process.env.LUNIA_POSTHOG_ENABLED
    else process.env.LUNIA_POSTHOG_ENABLED = old
  }
})
test('HTTP boundary rejects cross-origin, missing origin, oversized streams and invalid JSON', async () => {
  assert.throws(() => sameOrigin(new Request('https://preview.example/api/inquiry')))
  assert.throws(() =>
    sameOrigin(
      new Request('https://preview.example/api/inquiry', {
        headers: { origin: 'https://evil.example' },
      }),
    ),
  )
  sameOrigin(
    new Request('https://preview.example/api/inquiry', {
      headers: { origin: 'https://preview.example' },
    }),
  )
  for (const body of ['x'.repeat(40), '{invalid'])
    await assert.rejects(
      boundedJSON(
        new Request('https://preview.example', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        30,
      ),
    )
  assert.deepEqual(
    await boundedJSON(
      new Request('https://preview.example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"ok":true}',
      }),
    ),
    { ok: true },
  )
})
