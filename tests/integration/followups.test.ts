import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createLocalReq, type Payload } from 'payload'
import { createEditor, createTestCMS } from '../helpers/payload'
import { recordOperation } from '../../src/customer-records/operations'
import { internalTransaction, relationID } from '../../src/customer-records/core'
import {
  createPlan,
  followUpOperation,
  followUpQueue,
  renderPlan,
  simulateFollowUp,
} from '../../src/followups/operations'
import { submitInquiry } from '../../src/inquiries/submit'
import { inbox } from '../../src/followups/queries'
let fixture: Awaited<ReturnType<typeof createTestCMS>>
let payload: Payload
let user: Awaited<ReturnType<typeof createEditor>>
let enquiry: number, contact: number, booking: number, template: number
const op = (input: Record<string, unknown>) =>
  recordOperation(payload, user, { key: randomUUID(), ...input })
const follow = (input: Record<string, unknown>) =>
  followUpOperation(payload, user, { key: randomUUID(), ...input })
const planDoc = (id: number) =>
  payload.findByID({ collection: 'follow-ups', id, user, overrideAccess: false, depth: 0 })
const planInput = () => ({
  enquiry,
  booking,
  template,
  purpose: 'preparation',
  timeZone: 'Europe/Amsterdam',
  plannedAt: new Date(Date.now() - 60000).toISOString(),
})
async function plan(input: Record<string, unknown> = {}) {
  const values = { ...planInput(), ...input }
  const preview = await renderPlan(await createLocalReq({ user }, payload), values)
  const result = await follow({
    action: 'createFollowUp',
    ...values,
    previewToken: preview.previewToken,
  })
  return planDoc(Number(result.id))
}
beforeAll(async () => {
  fixture = await createTestCMS()
  payload = fixture.payload
})
afterAll(async () => {
  await fixture?.close()
})
beforeEach(async () => {
  await fixture.reset()
  user = await createEditor(payload)
  const page = await payload.create({
    collection: 'pages',
    user,
    overrideAccess: false,
    data: {
      title: 'Synthetic follow-up service',
      slug: 'followup-test',
      description: 'Synthetic only',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Test sessions',
          items: [{ title: 'Synthetic portrait', body: 'Synthetic service only.' }],
        },
      ],
    },
  })
  const block = page.layout[0]
  if (block.blockType !== 'services') throw new Error('Missing fixture service')
  const lead = await submitInquiry(
    payload,
    {
      service: `${page.id}:${block.items[0].id}`,
      name: 'Synthetic follow-up customer',
      email: 'followup@example.test',
      message: 'Synthetic private enquiry for follow-up tests.',
      website: '',
      submissionId: randomUUID(),
    },
    { analytics: false, campaigns: false, decided: false },
  )
  enquiry = lead.doc!.id
  contact = relationID(lead.doc!.contact)!
  template = (
    await payload.create({
      collection: 'email-templates',
      user,
      overrideAccess: false,
      data: {
        name: 'Approved test wording',
        kind: 'follow_up',
        subject: 'About {{service_title}}',
        body: 'Hello {{contact_name}}, your session is {{session_time}}.',
        approved: true,
      },
    })
  ).id
  booking = Number(
    (await op({ action: 'proposeBooking', enquiry, expectedMinor: 12000, currency: 'EUR' })).id,
  )
  await op({
    action: 'changeBooking',
    booking,
    status: 'confirmed',
    sessionAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    expectedMinor: 12000,
    reason: 'Synthetic confirmation for this test',
  })
})
test('reviewed plans persist minimal durable jobs, freeze content and deduplicate concurrent execution', async () => {
  const item = await plan()
  const job = await payload.findByID({
    collection: 'payload-jobs',
    id: item.jobID!,
    overrideAccess: true,
  })
  expect(job.input).toEqual({ plan: item.id, revision: 1 })
  expect(job.queue).toBe(followUpQueue)
  let calls = 0
  const outcomes = await Promise.all([
    simulateFollowUp(payload, item.id, 1, async () => {
      calls++
    }),
    simulateFollowUp(payload, item.id, 1, async () => {
      calls++
    }),
  ])
  expect(calls).toBe(1)
  expect(outcomes.map((result) => result.state).sort()).toEqual(['obsolete', 'simulated'])
  expect((await planDoc(item.id)).outcomeKey).toBe(`lunia-followup-${item.id}-revision-1`)
  expect(
    await payload.count({ collection: 'email-messages', user, overrideAccess: false }),
  ).toMatchObject({ totalDocs: 0 })
})
test('exact preview acknowledgement rejects changed contact content and unapproved templates', async () => {
  const values = planInput()
  const preview = await renderPlan(await createLocalReq({ user }, payload), values)
  await payload.update({
    collection: 'contacts',
    id: contact,
    user,
    overrideAccess: false,
    data: { name: 'Corrected synthetic name' },
  })
  await expect(
    follow({ action: 'createFollowUp', ...values, previewToken: preview.previewToken }),
  ).rejects.toThrow('Review the exact preview')
  await payload.update({
    collection: 'email-templates',
    id: template,
    user,
    overrideAccess: false,
    data: { approved: false },
  })
  await expect(plan()).rejects.toThrow('approve the template')
})
test('pause, stale edits, cancellation and retry identities remain explicit and idempotent', async () => {
  const item = await plan()
  const key = randomUUID()
  const paused = { key, action: 'pauseFollowUp', plan: item.id, revision: 1 }
  await follow(paused)
  await follow(paused)
  expect((await planDoc(item.id)).revision).toBe(2)
  expect((await simulateFollowUp(payload, item.id, 1)).state).toBe('obsolete')
  await expect(follow({ action: 'cancelFollowUp', plan: item.id, revision: 1 })).rejects.toThrow(
    'Reload',
  )
  await follow({ action: 'cancelFollowUp', plan: item.id, revision: 2 })
  expect((await planDoc(item.id)).state).toBe('cancelled')
  await expect(follow({ action: 'resumeFollowUp', plan: item.id, revision: 3 })).rejects.toThrow(
    'already finished',
  )
})
test('simulated replies stop matching plans once and cannot establish real no-response detection', async () => {
  const item = await plan()
  const key = randomUUID()
  const reply = {
    key,
    action: 'simulateReply',
    contact,
    enquiry,
    text: 'Synthetic reply from the customer.',
  }
  await follow(reply)
  await follow(reply)
  expect((await planDoc(item.id)).blockReason).toBe('reply_received')
  expect((await simulateFollowUp(payload, item.id, 1)).state).toBe('obsolete')
  expect(
    (await payload.count({ collection: 'incoming-replies', user, overrideAccess: false }))
      .totalDocs,
  ).toBe(1)
  await op({
    action: 'changeBooking',
    booking,
    status: 'cancelled',
    expectedMinor: 12000,
    reason: 'Synthetic cancelled booking for test',
  })
  const noReply = await plan({
    purpose: 'enquiry_followup',
    booking: undefined,
    body: 'Hello {{contact_name}}',
  })
  expect(noReply.state).toBe('blocked')
  expect(noReply.blockReason).toBe('reply_detection_unavailable')
})
test('customer opt-out, enquiry closure, changed session and delivery failure block at the shared boundary', async () => {
  const item = await plan()
  await follow({ action: 'stopFollowUps', contact, stopped: true })
  expect((await planDoc(item.id)).blockReason).toBe('contact_stopped')
  await follow({ action: 'stopFollowUps', contact, stopped: false })
  expect((await planDoc(item.id)).state).toBe('blocked')
  await op({
    action: 'changeBooking',
    booking,
    status: 'confirmed',
    sessionAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    expectedMinor: 12000,
    reason: 'Synthetic reschedule for stop test',
  })
  expect((await planDoc(item.id)).blockReason).toBe('session_changed')
  const current = await plan()
  await payload.update({
    collection: 'enquiries',
    id: enquiry,
    user,
    overrideAccess: false,
    data: { followUp: 'closed' },
  })
  expect((await planDoc(current.id)).blockReason).toBe('enquiry_closed')
})
test('actual job runner respects waitUntil and recovers an expired processing lease without duplicate outcomes', async () => {
  const future = await plan({ plannedAt: new Date(Date.now() + 3600000).toISOString() })
  const due = await plan()
  await payload.db.pool.query(
    "UPDATE payload_jobs SET processing_until = now() - interval '1 minute', processing_token = 'lost-worker' WHERE id = $1",
    [due.jobID],
  )
  await Promise.all([
    payload.jobs.run({ queue: followUpQueue, limit: 10, overrideAccess: true, silent: true }),
    payload.jobs.run({ queue: followUpQueue, limit: 10, overrideAccess: true, silent: true }),
  ])
  expect((await planDoc(due.id)).state).toBe('simulated')
  expect((await planDoc(future.id)).state).toBe('planned')
  const events = await payload.find({
    collection: 'customer-activities',
    user,
    overrideAccess: false,
    where: { summary: { equals: 'Follow-up simulation completed; no email sent' } },
  })
  expect(events.totalDocs).toBe(1)
})
test('failed simulations persist a safe error and bounded retries using one outcome identity', async () => {
  const item = await plan()
  let attempts = 0
  const fail = async () => {
    attempts++
    throw new Error('private arbitrary failure')
  }
  for (let i = 0; i < 3; i++)
    await expect(simulateFollowUp(payload, item.id, 1, fail)).rejects.toThrow('no email')
  expect(await simulateFollowUp(payload, item.id, 1, fail)).toEqual({ state: 'failed' })
  expect(attempts).toBe(3)
  const result = await planDoc(item.id)
  expect(result.attempts).toBe(3)
  expect(result.lastError).not.toContain('private arbitrary')
})
test('approved test rules trigger once, edits clear approval, and no sample rules activate by default', async () => {
  expect(
    (await payload.count({ collection: 'follow-up-rules', user, overrideAccess: false })).totalDocs,
  ).toBe(0)
  const rule = await payload.create({
    collection: 'follow-up-rules',
    user,
    overrideAccess: false,
    data: {
      name: 'Synthetic preparation rule',
      revision: 1,
      purpose: 'preparation',
      template,
      hours: 24,
      timeZone: 'Europe/Amsterdam',
      approvedForTests: true,
    },
  })
  const change = {
    action: 'changeBooking',
    booking,
    status: 'confirmed',
    expectedMinor: 12000,
    reason: 'Synthetic unchanged confirmation trigger',
  }
  await op(change)
  await op(change)
  expect(
    (await payload.count({ collection: 'follow-ups', user, overrideAccess: false })).totalDocs,
  ).toBe(1)
  const edited = await payload.update({
    collection: 'follow-up-rules',
    id: rule.id,
    user,
    overrideAccess: false,
    data: { hours: 12 },
  })
  expect(edited.approvedForTests).toBe(false)
  expect(edited.revision).toBe(2)
})
test('anonymous reads, direct writes and forged live input are denied; inbox private search is literal', async () => {
  const item = await plan()
  for (const collection of [
    'follow-ups',
    'follow-up-rules',
    'incoming-replies',
    'payload-jobs',
  ] as const)
    await expect(payload.find({ collection, overrideAccess: false })).rejects.toThrow()
  await expect(
    payload.update({
      collection: 'follow-ups',
      id: item.id,
      user,
      overrideAccess: false,
      data: { state: 'simulated' },
    }),
  ).rejects.toThrow()
  await expect(
    follow({ action: 'resumeFollowUp', plan: item.id, revision: 1, live: true }),
  ).rejects.toThrow('Only simulated')
  expect((await inbox(payload, user, { query: "%'; --", filter: 'all' })).rows).toHaveLength(0)
  expect(
    (await inbox(payload, user, { query: 'Synthetic', filter: 'upcoming' })).rows[0].contact.id,
  ).toBe(contact)
})
test('source trigger replay inside the transaction retains exactly one plan', async () => {
  const values = planInput()
  const run = () =>
    internalTransaction(payload, async (req) => {
      // The planner runs in a staff transaction in production; system fixture is explicit.
      req.user = user
      return createPlan(req, values, 'synthetic:immutable-trigger')
    })
  const results = await Promise.all([run(), run()])
  expect(results[0].id).toBe(results[1].id)
})

test('a completed simulation wins a concurrent cancellation; a committed cancellation prevents handoff', async () => {
  const item = await plan()
  let enteredResolve!: () => void
  let releaseResolve!: () => void
  const entered = {
    promise: new Promise<void>((resolve) => {
      enteredResolve = resolve
    }),
    resolve: () => enteredResolve(),
  }
  const release = {
    promise: new Promise<void>((resolve) => {
      releaseResolve = resolve
    }),
    resolve: () => releaseResolve(),
  }
  let calls = 0
  const running = simulateFollowUp(payload, item.id, 1, async () => {
    calls++
    entered.resolve()
    await release.promise
  })
  await entered.promise
  const cancelling = follow({ action: 'cancelFollowUp', plan: item.id, revision: 1 })
  const settled = Promise.allSettled([running, cancelling])
  release.resolve()
  const results = await settled
  expect(results[0].status).toBe('fulfilled')
  expect(results[1].status).toBe('rejected')
  expect((await planDoc(item.id)).state).toBe('simulated')
  const second = await plan()
  await follow({ action: 'cancelFollowUp', plan: second.id, revision: 1 })
  expect(
    (
      await simulateFollowUp(payload, second.id, 1, async () => {
        calls++
      })
    ).state,
  ).toBe('obsolete')
  expect(calls).toBe(1)
})
test('delivery failure and relinking are rechecked without sending or transferring customer identity', async () => {
  const { prepareEmail } = await import('../../src/customer-records/mail')
  const { activity } = await import('../../src/customer-records/core')
  const item = await plan()
  const mail = await prepareEmail(payload, user, {
    action: 'prepareEmail',
    key: randomUUID(),
    template,
    booking,
  })
  await internalTransaction(payload, async (req) => {
    await payload.update({
      collection: 'email-messages',
      id: Number(mail.id),
      req,
      overrideAccess: false,
      data: { status: 'bounced' },
    })
    await activity(req, {
      contact,
      enquiry,
      emailMessage: Number(mail.id),
      kind: 'email_status',
      source: 'provider',
      summary: 'Synthetic bounced event',
    })
  })
  expect((await planDoc(item.id)).blockReason).toBe('delivery_problem')
  const another = await payload.create({
    collection: 'contacts',
    user,
    overrideAccess: false,
    data: { name: 'Different customer', email: 'different@example.test' },
  })
  await payload.update({
    collection: 'enquiries',
    id: enquiry,
    user,
    overrideAccess: false,
    data: { contact: another.id },
  })
  expect((await planDoc(item.id)).blockReason).toBe('contact_changed')
})
test('Payload retry persists its due time and retries after worker failure without repeating a successful plan', async () => {
  const item = await plan()
  const task = payload.config.jobs.tasks!.find((entry) => entry.slug === 'simulateFollowUp')!
  const original = task.handler
  try {
    task.handler = async () => {
      throw new Error('Synthetic safe worker failure')
    }
    await payload.jobs.run({ queue: followUpQueue, overrideAccess: true, silent: true })
    const failed = await payload.findByID({
      collection: 'payload-jobs',
      id: item.jobID!,
      overrideAccess: true,
    })
    expect(failed.totalTried).toBe(1)
    expect(new Date(failed.waitUntil!).getTime()).toBeGreaterThan(Date.now())
    expect(failed.hasError).toBe(false)
    task.handler = original
    await payload.db.pool.query(
      "UPDATE payload_jobs SET wait_until = now() - interval '1 minute' WHERE id = $1",
      [item.jobID],
    )
    await payload.jobs.run({ queue: followUpQueue, overrideAccess: true, silent: true })
    expect((await planDoc(item.id)).state).toBe('simulated')
    const complete = await payload.findByID({
      collection: 'payload-jobs',
      id: item.jobID!,
      overrideAccess: true,
    })
    expect(complete.completedAt).toBeTruthy()
    expect(complete.totalTried).toBe(2)
  } finally {
    task.handler = original
  }
})
test('verified incoming boundary deduplicates exact references and keeps unmatched messages in private review', async () => {
  const { prepareEmail } = await import('../../src/customer-records/mail')
  const { recordVerifiedIncoming } = await import('../../src/followups/inbound')
  const prepared = await prepareEmail(payload, user, {
    action: 'prepareEmail',
    key: randomUUID(),
    template,
    booking,
  })
  const message = await payload.findByID({
    collection: 'email-messages',
    id: Number(prepared.id),
    user,
    overrideAccess: false,
    depth: 0,
  })
  const item = await plan()
  const notice = {
    eventKey: 'synthetic-verified-reply',
    providerID: 'synthetic-provider-id',
    occurredAt: new Date().toISOString(),
    state: 'review' as const,
    reviewReason: 'Synthetic signed fixture',
  }
  const retrieve = async () => ({
    reference: message.idempotencyKey!,
    sender: message.recipient,
    text: 'Synthetic verified reply body.',
  })
  const replies = await Promise.all([
    recordVerifiedIncoming(payload, notice, retrieve),
    recordVerifiedIncoming(payload, notice, retrieve),
  ])
  expect(replies[0].id).toBe(replies[1].id)
  expect(replies[0].state).toBe('matched')
  expect((await planDoc(item.id)).blockReason).toBe('reply_received')
  const unknown = await recordVerifiedIncoming(
    payload,
    { ...notice, eventKey: 'synthetic-unmatched-reply' },
    async () => ({
      sender: message.recipient,
      text: 'Same email alone must never match a customer.',
    }),
  )
  expect(unknown.state).toBe('review')
  expect(unknown.contact).toBeNull()
})
