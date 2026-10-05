import 'dotenv/config'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import { submitInquiry } from '../../src/inquiries/submit'
import { notifyPhotographer } from '../../src/inquiries/notification'
import { captureMeasurement } from '../../src/inquiries/measurement'
import { publishedServices } from '../../src/inquiries/services'
import { campaignTouch, updateCampaign } from '../../src/lib/campaign'
let payload: Payload
let pageId: number
let service: string
const leads: number[] = []
const preferences = { analytics: false, campaigns: false, decided: false }
const input = () => ({
  service,
  name: 'Synthetic Visitor',
  email: 'synthetic@example.test',
  message: 'Synthetic integration enquiry only.',
  website: '',
  submissionId: randomUUID(),
})
before(async () => {
  payload = await getPayload({ config })
  const page = await payload.create({
    collection: 'pages',
    overrideAccess: true,
    data: {
      title: 'Synthetic inquiry services',
      slug: `inquiry-${Date.now()}`,
      description: 'Synthetic only',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Synthetic services',
          items: [{ title: 'Synthetic portrait', body: 'Synthetic service only.' }],
        },
      ],
    },
  })
  pageId = page.id
  service = (await publishedServices(payload)).find((s) => s.id.startsWith(`${pageId}:`))!.id
})
after(async () => {
  for (const id of new Set(leads)) {
    const lead = await payload.findByID({
      collection: 'enquiries',
      id,
      depth: 0,
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'customer-activities',
      where: { enquiry: { equals: id } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'email-messages',
      where: { enquiry: { equals: id } },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'enquiries', id, overrideAccess: true })
    if (typeof lead.contact === 'number')
      await payload.delete({ collection: 'contacts', id: lead.contact, overrideAccess: true })
  }
  if (pageId) await payload.delete({ collection: 'pages', id: pageId, overrideAccess: true })
  const pool = payload.db.pool
  await payload.destroy()
  await pool.end()
})
test('concurrent and lost-response retries create one lead; conflicting reuse rejects; visitor reads/writes denied', async () => {
  const data = input()
  const results = await Promise.all(
    Array.from({ length: 4 }, () => submitInquiry(payload, data, preferences)),
  )
  const ids = results.map((r) => r.doc!.id)
  leads.push(...ids)
  assert.equal(new Set(ids).size, 1)
  assert.equal(results.filter((r) => r.created).length, 1)
  assert.equal(new Set(results.map((r) => r.receipt)).size, 1)
  // Granting consent later must not turn an idempotent lookup into a new conversion.
  const laterConsent = await submitInquiry(payload, data, {
    ...preferences,
    analytics: true,
    decided: true,
  })
  assert.equal(laterConsent.created, false)
  await assert.rejects(
    submitInquiry(payload, { ...data, message: 'A different synthetic request.' }, preferences),
    { status: 409 },
  )
  await assert.rejects(payload.find({ collection: 'enquiries', overrideAccess: false }))
  await assert.rejects(
    payload.create({ collection: 'enquiries', overrideAccess: false, data: results[0].doc! }),
  )
  await assert.rejects(
    payload.create({
      collection: 'enquiries',
      overrideAccess: false,
      context: { inquiryCapability: 'validated inquiry', inquiryKey: data.submissionId },
      data: results[0].doc!,
    }),
  )
  assert.equal((results[0].doc!.attribution as { status: string }).status, 'withheld')
})
test('only published service choices can be enquired about; validation/spam create no record', async () => {
  assert.ok((await submitInquiry(payload, { ...input(), website: 'bot' }, preferences)).errors)
  assert.ok(
    (await submitInquiry(payload, { ...input(), service: '999999:missing' }, preferences)).errors
      ?.service,
  )
  const draft = await payload.create({
    collection: 'pages',
    overrideAccess: true,
    data: {
      title: 'Draft services',
      slug: `draft-inquiry-${Date.now()}`,
      description: 'Synthetic draft',
      _status: 'draft',
      layout: [
        {
          blockType: 'services',
          heading: 'Hidden',
          items: [{ title: 'Hidden service', body: 'Never public' }],
        },
      ],
    },
  })
  try {
    assert.equal(
      (await publishedServices(payload)).some((s) => s.id.startsWith(`${draft.id}:`)),
      false,
    )
  } finally {
    await payload.delete({ collection: 'pages', id: draft.id, overrideAccess: true })
  }
})
test('attribution snapshot survives enquiry retries without being replaced by later campaign input', async () => {
  const data = input()
  const campaign = updateCampaign(
    undefined,
    campaignTouch({ utm_source: 'google', gclid: 'synthetic_123' }, 'direct'),
  )
  const first = await submitInquiry(
    payload,
    data,
    { ...preferences, campaigns: true, decided: true },
    campaign,
  )
  leads.push(first.doc!.id)
  const retry = await submitInquiry(payload, data, preferences)
  assert.deepEqual(retry.doc!.attribution, first.doc!.attribution)
  assert.ok(JSON.stringify(first.doc!.attribution).includes('synthetic_123'))
})
test('notification failure is durable; retries use same safe payload/key and concurrent calls send once', async () => {
  const result = await submitInquiry(payload, input(), preferences)
  const id = result.doc!.id
  leads.push(id)
  const keys = ['LUNIA_CMS_PREVIEW', 'RESEND_API_KEY', 'PREVIEW_EDITOR_EMAIL', 'MAIL_FROM'] as const
  const old = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  Object.assign(process.env, {
    LUNIA_CMS_PREVIEW: 'true',
    RESEND_API_KEY: 'synthetic-test-only',
    PREVIEW_EDITOR_EMAIL: 'editor@example.test',
    MAIL_FROM: 'onboarding@resend.dev',
  })
  const sent: RequestInit[] = []
  try {
    assert.equal(
      await notifyPhotographer(payload, id, async (_url, options) => {
        sent.push(options!)
        return new Response('{}', { status: 500 })
      }),
      'uncertain',
    )
    const retry = async (_url: string | URL | Request, options?: RequestInit) => {
      sent.push(options!)
      return Response.json({ id: `synthetic-enquiry-${id}-provider-id` })
    }
    const results = await Promise.all([
      notifyPhotographer(payload, id, retry),
      notifyPhotographer(payload, id, retry),
    ])
    assert.equal(results.filter((r) => r === 'accepted').length, 1)
    assert.equal(sent.length, 2)
    assert.deepEqual(sent[0].headers, sent[1].headers)
    const message = JSON.parse(String(sent[0].body))
    assert.equal(message.to, 'editor@example.test')
    for (const secret of [
      'Synthetic Visitor',
      'synthetic@example.test',
      'Synthetic integration enquiry only.',
    ])
      assert.ok(!String(sent[0].body).includes(secret))
    const doc = await payload.findByID({ collection: 'enquiries', id, overrideAccess: true })
    assert.equal(doc.notificationStatus, 'accepted')
    assert.equal(doc.notificationAttempts, 2)
    await payload.db.pool.query(
      "UPDATE email_messages SET status = 'uncertain', first_attempt_at = now() - interval '24 hours' WHERE enquiry_id = $1",
      [id],
    )
    await notifyPhotographer(payload, id, retry)
    assert.equal(sent.length, 2)
    assert.equal(
      (await payload.findByID({ collection: 'enquiries', id, overrideAccess: true }))
        .notificationStatus,
      'manual',
    )
  } finally {
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key]
      else process.env[key] = old[key]
    }
  }
})
test('EU capture is consent/session-gated, exact-payload only, and deduplicated across concurrent deliveries', async () => {
  const old = {
    enabled: process.env.LUNIA_POSTHOG_ENABLED,
    token: process.env.POSTHOG_PROJECT_TOKEN,
  }
  process.env.LUNIA_POSTHOG_ENABLED = 'true'
  process.env.POSTHOG_PROJECT_TOKEN = 'synthetic-project-token'
  const session = randomUUID()
  const sent: { url: unknown; body: string }[] = []
  const send: typeof fetch = async (url, options) => {
    sent.push({ url, body: String(options?.body) })
    return new Response('{}')
  }
  try {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        captureMeasurement(payload, session, service, 'service_viewed', send),
      ),
    )
    assert.equal(results.filter((r) => r === 'sent').length, 1)
    assert.equal(sent.length, 1)
    assert.equal(sent[0].url, 'https://eu.i.posthog.com/i/v0/e/')
    assert.equal(JSON.parse(sent[0].body).properties.$geoip_disable, true)
    assert.equal(
      await captureMeasurement(payload, undefined, service, 'inquiry_started', send),
      'disabled',
    )
    assert.equal(
      await captureMeasurement(payload, session, service, 'inquiry_started', async () => {
        throw new Error('synthetic provider unavailable')
      }),
      'failed',
    )
    assert.equal(
      await captureMeasurement(payload, session, service, 'inquiry_started', send),
      'duplicate',
    )
    assert.equal(sent.length, 1)
  } finally {
    if (old.enabled === undefined) delete process.env.LUNIA_POSTHOG_ENABLED
    else process.env.LUNIA_POSTHOG_ENABLED = old.enabled
    if (old.token === undefined) delete process.env.POSTHOG_PROJECT_TOKEN
    else process.env.POSTHOG_PROJECT_TOKEN = old.token
  }
})
