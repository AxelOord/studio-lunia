import 'dotenv/config'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import config from '../../src/payload.config'
import type { User } from '../../src/payload-types'
import { submitInquiry } from '../../src/inquiries/submit'
import { recordOperation } from '../../src/customer-records/operations'
import {
  prepareEmail,
  sendEmailMessage,
  receiveDelivery,
  preparePhotographerNotice,
} from '../../src/customer-records/mail'
import { customerView, searchContacts } from '../../src/customer-records/queries'
import { relationID } from '../../src/customer-records/core'
import type { DeliveryFact } from '../../src/customer-records/webhook'
let payload: Payload
let user: User & { collection: 'users' }
let page: number
let service: string
let enquiry: number
let contact: number
let booking: number
let template: number
const contactIDs: number[] = []
const enquiryIDs: number[] = []
const keys: string[] = []
const envKeys = [
  'LUNIA_CMS_PREVIEW',
  'RESEND_API_KEY',
  'PREVIEW_EDITOR_EMAIL',
  'MAIL_FROM',
] as const
let oldEnv: Record<string, string | undefined>
const op = (input: Record<string, unknown>, key = randomUUID()) => {
  keys.push(key)
  return recordOperation(payload, user, { ...input, key })
}
const prepare = (action = 'prepareTestEmail') => {
  const key = randomUUID()
  keys.push(key)
  return prepareEmail(payload, user, { action, key, template, booking })
}
const doc = (id: number) =>
  payload.findByID({ collection: 'email-messages', id, overrideAccess: true, depth: 0 })
async function newEnquiry() {
  const result = await submitInquiry(
    payload,
    {
      service,
      name: 'Synthetic record customer',
      email: 'records@example.test',
      message: 'Synthetic private message for records verification.',
      website: '',
      submissionId: randomUUID(),
    },
    { analytics: false, campaigns: false, decided: false },
  )
  assert.ok(result.doc)
  enquiryIDs.push(result.doc.id)
  contactIDs.push(relationID(result.doc.contact)!)
  return result.doc
}
before(async () => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname))
  payload = await getPayload({ config })
  oldEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]))
  const created = await payload.create({
    collection: 'users',
    overrideAccess: true,
    context: { bootstrap: true },
    data: {
      email: `records-${randomUUID()}@example.test`,
      password: 'synthetic-records-test-password',
    },
  })
  user = { ...created, collection: 'users' }
  Object.assign(process.env, {
    LUNIA_CMS_PREVIEW: 'true',
    RESEND_API_KEY: 'synthetic-test-only',
    PREVIEW_EDITOR_EMAIL: 'sandbox@example.test',
    MAIL_FROM: 'onboarding@resend.dev',
  })

  const pageDoc = await payload.create({
    collection: 'pages',
    overrideAccess: true,
    data: {
      title: 'Synthetic record service',
      slug: `records-${randomUUID()}`,
      description: 'Synthetic only',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Synthetic records services',
          items: [{ title: 'Synthetic session', body: 'Synthetic service.' }],
        },
      ],
    },
  })
  page = pageDoc.id
  const block = pageDoc.layout[0]
  assert.equal(block.blockType, 'services')
  if (block.blockType === 'services') service = `${page}:${block.items[0].id}`
  const lead = await newEnquiry()
  enquiry = lead.id
  contact = relationID(lead.contact)!
})
after(async () => {
  for (const key of envKeys) {
    if (oldEnv[key] === undefined) delete process.env[key]
    else process.env[key] = oldEnv[key]
  }
  try {
    // Delete only this suite's owned synthetic graph, in dependency order.
    if (contactIDs.length)
      for (const collection of [
        'customer-activities',
        'revenue-entries',
        'email-messages',
        'bookings',
      ] as const)
        await payload.delete({
          collection,
          where: { contact: { in: contactIDs } },
          overrideAccess: true,
        })
    for (const id of enquiryIDs)
      await payload.delete({ collection: 'enquiries', id, overrideAccess: true })
    for (const id of contactIDs)
      await payload.delete({ collection: 'contacts', id, overrideAccess: true })
    if (template)
      await payload.delete({ collection: 'email-templates', id: template, overrideAccess: true })
    await payload.db.pool.query('DELETE FROM customer_operations WHERE operation_key = ANY($1)', [
      keys,
    ])
    if (page) await payload.delete({ collection: 'pages', id: page, overrideAccess: true })
    if (user) await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
  } finally {
    const pool = payload.db.pool
    await payload.destroy()
    await pool.end()
  }
})
test('same email stays separate until explicit linking; timeline retains source and original enquiry snapshot', async () => {
  const second = await newEnquiry()
  assert.notEqual(relationID(second.contact), contact)
  const linked = await payload.update({
    collection: 'enquiries',
    id: second.id,
    data: { contact, followUp: 'contacted' },
    user,
    overrideAccess: false,
  })
  assert.deepEqual(linked.attribution, second.attribution)
  await assert.rejects(
    payload.update({
      collection: 'enquiries',
      id: second.id,
      data: { contact: null },
      user,
      overrideAccess: false,
    }),
  )
  const view = await customerView(payload, user, contact)
  assert.equal(view.enquiries.length, 2)
  assert.ok(view.events.some((event) => event.source === 'website'))
  assert.ok(view.events.some((event) => event.summary.includes('explicitly linked')))
  assert.ok(
    (await searchContacts(payload, user, 'records@example.test', 'new')).contacts.some(
      (c) => c.id === contact,
    ),
  )
  assert.ok(
    (await searchContacts(payload, user, '', 'waiting')).contacts.some((c) => c.id === contact),
  )
})
test('booking commands deduplicate concurrently, reject conflicting reuse and preserve immutable attribution', async () => {
  const key = randomUUID()
  const input = { action: 'proposeBooking', enquiry, expectedMinor: 12345, currency: 'EUR' }
  const results = await Promise.all([op(input, key), op(input, key), op(input, key)])
  assert.equal(new Set(results.map((r) => r.id)).size, 1)
  booking = Number(results[0].id)
  await assert.rejects(op({ ...input, expectedMinor: 111 }, key), { status: 409 })
  await assert.rejects(op({ ...input, currency: 'bad!' }))
  await assert.rejects(op({ ...input, expectedMinor: 1.2 }))
  await assert.rejects(
    op({
      action: 'changeBooking',
      booking,
      status: 'confirmed',
      expectedMinor: 12345,
      reason: 'Synthetic confirmation test',
    }),
    { status: 422 },
  )
  await op({
    action: 'changeBooking',
    booking,
    status: 'confirmed',
    sessionAt: new Date(Date.now() + 86400000).toISOString(),
    expectedMinor: 12345,
    reason: 'Synthetic confirmed session',
  })
  const saved = await payload.findByID({
    collection: 'bookings',
    id: booking,
    user,
    overrideAccess: false,
  })
  const lead = await payload.findByID({
    collection: 'enquiries',
    id: enquiry,
    user,
    overrideAccess: false,
  })
  assert.deepEqual(saved.attribution, lead.attribution)
  assert.ok(
    (await searchContacts(payload, user, '', 'upcoming')).contacts.some((c) => c.id === contact),
  )
  await assert.rejects(
    payload.update({
      collection: 'bookings',
      id: booking,
      data: { status: 'completed' },
      user,
      overrideAccess: false,
    }),
  )
})
test('manual money corrections append reversals, preserve totals and roll back invalid refunds atomically', async () => {
  const common = {
    booking,
    occurredAt: new Date().toISOString(),
    reason: 'Synthetic money already received',
  }
  const key = randomUUID()
  const result = await Promise.all([
    op({ ...common, action: 'recordMoney', kind: 'payment', amountMinor: 10000 }, key),
    op({ ...common, action: 'recordMoney', kind: 'payment', amountMinor: 10000 }, key),
  ])
  assert.equal(result[0].id, result[1].id)
  await op({ ...common, action: 'recordMoney', kind: 'refund', amountMinor: 2000 })
  await op({
    ...common,
    action: 'correctMoney',
    entry: result[0].id,
    kind: 'payment',
    amountMinor: 9000,
  })
  const entries = await payload.find({
    collection: 'revenue-entries',
    where: { booking: { equals: booking } },
    user,
    overrideAccess: false,
    limit: 100,
  })
  assert.equal(entries.docs.length, 4)
  assert.equal(
    entries.docs.reduce((sum, row) => sum + row.amountMinor, 0),
    7000,
  )
  await assert.rejects(
    op({
      ...common,
      action: 'correctMoney',
      entry: result[0].id,
      kind: 'payment',
      amountMinor: 8000,
    }),
    { status: 409 },
  )
  await assert.rejects(
    op({ ...common, action: 'recordMoney', kind: 'refund', amountMinor: 7001 }),
    { status: 422 },
  )
  await op({
    action: 'changeBooking',
    booking,
    status: 'cancelled',
    expectedMinor: 0,
    reason: 'Synthetic cancellation record',
  })
  assert.equal(
    (
      await payload.count({
        collection: 'revenue-entries',
        where: { booking: { equals: booking } },
        overrideAccess: true,
      })
    ).totalDocs,
    4,
  )
})
test('template approval, rendered snapshots, private drafts and staff reply provenance are preserved', async () => {
  const item = await payload.create({
    collection: 'email-templates',
    user,
    overrideAccess: false,
    data: {
      name: 'Synthetic approved example',
      kind: 'booking',
      subject: 'For {{contact_name}}',
      body: 'About {{service_title}}: {{booking_status}}',
      approved: false,
    },
  })
  template = item.id
  await assert.rejects(prepare(), { status: 422 })
  await payload.update({
    collection: 'email-templates',
    id: template,
    user,
    overrideAccess: false,
    data: { approved: true },
  })
  const draft = await prepare('prepareEmail')
  const before = await doc(draft.id)
  await assert.rejects(
    sendEmailMessage(payload, draft.id, async () => {
      throw new Error('Must not send')
    }),
    { status: 422 },
  )
  await payload.update({
    collection: 'email-templates',
    id: template,
    user,
    overrideAccess: false,
    data: { subject: 'Changed wording' },
  })
  assert.equal(
    (await payload.findByID({ collection: 'email-templates', id: template, overrideAccess: true }))
      .approved,
    false,
  )
  await payload.update({
    collection: 'contacts',
    id: contact,
    user,
    overrideAccess: false,
    data: { name: 'Synthetic corrected name' },
  })
  const after = await doc(draft.id)
  assert.equal(after.html, before.html)
  assert.equal(after.subject, before.subject)
  await payload.update({
    collection: 'email-templates',
    id: template,
    user,
    overrideAccess: false,
    data: { approved: true },
  })
  await op({
    action: 'recordReply',
    contact,
    note: 'Synthetic known reply recorded by staff.',
    occurredAt: new Date().toISOString(),
  })
  assert.ok(
    (await customerView(payload, user, contact)).events.some(
      (event) =>
        event.kind === 'reply_reported' && event.source === 'staff' && event.actor === user.id,
    ),
  )
})
test('sandbox sender freezes recipient/body/key, bounds retries and keeps failures truthful', async () => {
  const message = await prepare()
  const requests: RequestInit[] = []
  assert.equal(
    await sendEmailMessage(payload, message.id, async (_url, init) => {
      requests.push(init!)
      return new Response('{}', { status: 503 })
    }),
    'uncertain',
  )
  assert.equal(
    await sendEmailMessage(payload, message.id, async (_url, init) => {
      requests.push(init!)
      throw new Error('timeout')
    }),
    'uncertain',
  )
  assert.equal(
    await sendEmailMessage(payload, message.id, async (_url, init) => {
      requests.push(init!)
      return new Response('{}', { status: 422 })
    }),
    'failed',
  )
  assert.equal(
    await sendEmailMessage(payload, message.id, async () => {
      throw new Error('Must not call provider')
    }),
    'manual',
  )
  assert.equal(requests.length, 3)
  assert.deepEqual(
    requests.map((r) => r.body),
    Array(3).fill(requests[0].body),
  )
  assert.deepEqual(
    requests.map((r) => r.headers),
    Array(3).fill(requests[0].headers),
  )
  const body = String(requests[0].body)
  assert.ok(body.includes('sandbox@example.test'))
  assert.ok(!body.includes('records@example.test'))
  assert.ok(!body.includes('Synthetic corrected name'))
  assert.ok(
    (await searchContacts(payload, user, '', 'attention')).contacts.some((c) => c.id === contact),
  )
  const mismatch = await prepare()
  process.env.PREVIEW_EDITOR_EMAIL = 'changed@example.test'
  try {
    assert.equal(
      await sendEmailMessage(payload, mismatch.id, async () => {
        throw new Error('Must not send')
      }),
      'failed',
    )
    assert.equal((await doc(mismatch.id)).attempts, 0)
  } finally {
    process.env.PREVIEW_EDITOR_EMAIL = 'sandbox@example.test'
  }
})
test('early signed facts correlate by opaque tag and concurrent/reordered callbacks cannot regress delivery', async () => {
  const message = await prepare()
  const saved = await doc(message.id)
  const providerId = `synthetic-${randomUUID()}`
  const base: DeliveryFact = {
    eventId: `event-${randomUUID()}`,
    providerId,
    kind: 'email.delivered',
    occurredAt: new Date().toISOString(),
    messageKey: saved.idempotencyKey!,
  }
  assert.equal(
    await sendEmailMessage(payload, message.id, async () => {
      const outcomes = await Promise.all([
        receiveDelivery(payload, base),
        receiveDelivery(payload, base),
        receiveDelivery(payload, base),
      ])
      assert.equal(outcomes.filter((value) => value === 'recorded').length, 1)
      assert.equal(outcomes.filter((value) => value === 'duplicate').length, 2)
      return Response.json({ id: providerId })
    }),
    'delivered',
  )
  const attemptTime = (await doc(message.id)).lastAttemptAt
  await receiveDelivery(payload, {
    ...base,
    eventId: `event-${randomUUID()}`,
    kind: 'email.sent',
    occurredAt: new Date(Date.now() - 5000).toISOString(),
  })
  await receiveDelivery(payload, {
    ...base,
    eventId: `event-${randomUUID()}`,
    kind: 'email.delivery_delayed',
    occurredAt: new Date(Date.now() - 3000).toISOString(),
  })
  assert.equal((await doc(message.id)).status, 'delivered')
  assert.equal((await doc(message.id)).lastAttemptAt, attemptTime)
  await assert.rejects(receiveDelivery(payload, { ...base, kind: 'email.failed' }), { status: 409 })
  await receiveDelivery(payload, {
    ...base,
    eventId: `event-${randomUUID()}`,
    kind: 'email.bounced',
  })
  assert.equal((await doc(message.id)).status, 'bounced')
  assert.equal(
    await receiveDelivery(payload, {
      ...base,
      eventId: `event-${randomUUID()}`,
      providerId: 'unrelated-provider',
      messageKey: undefined,
    }),
    'unrelated',
  )
})
test('expired and historical notifications never invent snapshots or retry changed old payloads', async () => {
  const message = await prepare()
  await sendEmailMessage(payload, message.id, async () => new Response('{}', { status: 500 }))
  await payload.db.pool.query(
    "UPDATE email_messages SET first_attempt_at = now() - interval '24 hours' WHERE id = $1",
    [message.id],
  )
  assert.equal(
    await sendEmailMessage(payload, message.id, async () => {
      throw new Error('Must not send')
    }),
    'manual',
  )
  const legacy = await newEnquiry()
  await payload.db.pool.query(
    "UPDATE enquiries SET notification_attempts = 1, notification_status = 'failed' WHERE id = $1",
    [legacy.id],
  )
  assert.equal(await preparePhotographerNotice(payload, legacy.id), 'manual')
  assert.equal(
    (
      await payload.count({
        collection: 'email-messages',
        where: { enquiry: { equals: legacy.id } },
        overrideAccess: true,
      })
    ).totalDocs,
    0,
  )
})
test('anonymous and forged capabilities cannot access private operational records or rewrite history', async () => {
  if (contactIDs.length)
    for (const collection of [
      'contacts',
      'bookings',
      'revenue-entries',
      'customer-activities',
      'email-templates',
      'email-messages',
    ] as const)
      await assert.rejects(
        payload.find({
          collection,
          overrideAccess: false,
          context: { recordsCapability: 'studio-lunia.customer-records' },
        }),
      )
  const message = await prepare()
  await assert.rejects(
    payload.update({
      collection: 'email-messages',
      id: message.id,
      data: { subject: 'tampered' },
      user,
      overrideAccess: false,
    }),
  )
  await assert.rejects(
    payload.delete({ collection: 'enquiries', id: enquiry, user, overrideAccess: false }),
  )
})
