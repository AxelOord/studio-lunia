import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { createEditor, createTestCMS } from '../helpers/payload'
import { denied } from '../../src/inquiries/privacy'
import { changeStudioBooking, reserveStudioSlot } from '../../src/studio-days/reservations'
import { prepareStudioMessages } from '../../src/studio-days/messages'
import { recordOperation } from '../../src/customer-records/operations'
import { internalTransaction } from '../../src/customer-records/core'
import { campaignTouch, updateCampaign } from '../../src/lib/campaign'
import { studioAvailability } from '../../src/studio-days/queries'
import { seedStudioDemo } from '../../scripts/seed-studio-demo'

let fixture: Awaited<ReturnType<typeof createTestCMS>>
beforeAll(async () => {
  fixture = await createTestCMS()
})
beforeEach(async () => {
  await fixture.reset()
})
afterAll(async () => {
  await fixture?.close()
})
async function day(extra: Record<string, unknown> = {}) {
  const user = await createEditor(fixture.payload)
  const doc = await fixture.payload.create({
    collection: 'studio-days',
    user,
    overrideAccess: false,
    data: {
      title: 'Synthetic studio day',
      slug: 'synthetic-studio',
      location: 'Synthetic test studio',
      localDate: '2027-03-27',
      timeZone: 'Europe/Amsterdam',
      offerTitle: 'Synthetic portrait session',
      inclusions: 'Synthetic inclusion',
      durationMinutes: 30,
      bufferMinutes: 15,
      capacity: 1,
      priceMinor: 12300,
      currency: 'EUR',
      opensLocal: '09:00',
      closesLocal: '12:00',
      bookingDeadlineLocal: '2027-03-27T08:00',
      changePolicy: 'Synthetic reviewed conditions only.',
      confirmationMode: 'immediate',
      bookingsOpen: true,
      dayState: 'scheduled',
      _status: 'published',
      ...extra,
    },
  })
  const slots = await fixture.payload.find({
    collection: 'studio-slots',
    user,
    overrideAccess: false,
    depth: 0,
    sort: 'startsAt',
    where: { and: [{ day: { equals: doc.id } }, { revision: { equals: doc.scheduleRevision } }] },
  })
  return { user, doc, slots: slots.docs }
}
function input(doc: { id: number; scheduleRevision?: number | null }, slot: { id: number }) {
  return {
    day: doc.id,
    slot: slot.id,
    revision: doc.scheduleRevision,
    name: 'Synthetic Customer',
    email: 'synthetic@example.test',
    conditionsAccepted: true,
    website: '',
    submissionId: randomUUID(),
  }
}
test('published inventory stays private; a saved draft does not change current slots', async () => {
  const { payload } = fixture
  const { doc, user, slots } = await day()
  expect(slots).toHaveLength(4)
  expect(slots[0]).toMatchObject({
    startsAt: '2027-03-27T08:00:00.000Z',
    endsAt: '2027-03-27T08:30:00.000Z',
    occupiedUntil: '2027-03-27T08:45:00.000Z',
  })
  await expect(
    payload.find({ collection: 'studio-slots', overrideAccess: false }),
  ).rejects.toThrow()
  await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    draft: true,
    data: { location: 'Private unsaved offer', durationMinutes: 60 },
  })
  const publicDay = await payload.findByID({
    collection: 'studio-days',
    id: doc.id,
    overrideAccess: false,
    draft: false,
  })
  expect(publicDay.location).toBe('Synthetic test studio')
  expect(publicDay.scheduleRevision).toBe(doc.scheduleRevision)
  expect(
    (await payload.count({ collection: 'studio-slots', user, overrideAccess: false })).totalDocs,
  ).toBe(4)
  const privateDay = await payload.create({
    collection: 'studio-days',
    user,
    overrideAccess: false,
    draft: true,
    data: { title: 'Incomplete private day', slug: 'incomplete-private' },
  })
  await expect(
    payload.findByID({ collection: 'studio-days', id: privateDay.id, overrideAccess: false }),
  ).rejects.toThrow()
})
test('concurrent visitor and staff submissions allocate at most one place and do not create orphan contacts', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day()
  const attempts = await Promise.allSettled(
    Array.from({ length: 8 }, (_, index) =>
      reserveStudioSlot(
        payload,
        input(doc, slots[0]),
        denied,
        undefined,
        index % 2 ? { user } : undefined,
      ),
    ),
  )
  expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  expect(
    (await payload.count({ collection: 'bookings', user, overrideAccess: false })).totalDocs,
  ).toBe(1)
  expect(
    (await payload.count({ collection: 'contacts', user, overrideAccess: false })).totalDocs,
  ).toBe(1)
  const winner = attempts.find((result) => result.status === 'fulfilled')!
  if (winner.status !== 'fulfilled') throw new Error('Missing winner')
  expect(winner.value.booking).toMatchObject({
    status: 'confirmed',
    enquiry: null,
    source: 'studio_slot',
    studioSeat: 1,
    studioRevision: 1,
    attribution: { consent: 'unknown', status: 'withheld' },
  })
})
test('lost-response retries are idempotent after closure; changed input conflicts and selection alone writes nothing', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day()
  expect(
    (await payload.count({ collection: 'bookings', user, overrideAccess: false })).totalDocs,
  ).toBe(0)
  const body = input(doc, slots[0])
  const [first, retry] = await Promise.all([
    reserveStudioSlot(payload, body, denied),
    reserveStudioSlot(payload, body, denied),
  ])
  expect(first.booking.id).toBe(retry.booking.id)
  await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    data: { _status: 'published', bookingsOpen: false, acknowledgeBookings: true },
  })
  expect((await reserveStudioSlot(payload, body, denied)).booking.id).toBe(first.booking.id)
  await expect(
    reserveStudioSlot(payload, { ...body, name: 'Changed customer' }, denied),
  ).rejects.toThrow(/differ/)
  await expect(reserveStudioSlot(payload, input(doc, slots[1]), denied)).rejects.toThrow(
    /not accepting/,
  )
})
test('publishing changed settings needs a fresh acknowledgement and preserves commitments and cross-revision capacity', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day()
  const first = (await reserveStudioSlot(payload, input(doc, slots[0]), denied)).booking
  await expect(
    payload.update({
      collection: 'studio-days',
      id: doc.id,
      user,
      overrideAccess: false,
      data: { durationMinutes: 60, _status: 'published' },
    }),
  ).rejects.toThrow(/acknowledge/)
  const changed = await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    data: {
      durationMinutes: 60,
      confirmationMode: 'manual',
      location: 'New synthetic studio',
      _status: 'published',
      acknowledgeBookings: true,
    },
  })
  expect(changed.acknowledgeBookings).toBe(false)
  const saved = await payload.findByID({
    collection: 'bookings',
    id: first.id,
    user,
    overrideAccess: false,
    depth: 0,
  })
  expect(saved.studioSnapshot).toEqual(first.studioSnapshot)
  expect(saved.status).toBe('confirmed')
  await expect(
    payload.update({
      collection: 'studio-days',
      id: doc.id,
      user,
      overrideAccess: false,
      data: { capacity: 2 },
    }),
  ).rejects.toThrow(/acknowledge/)
  const newSlots = await payload.find({
    collection: 'studio-slots',
    user,
    overrideAccess: false,
    where: { revision: { equals: changed.scheduleRevision } },
    sort: 'startsAt',
  })
  await expect(
    reserveStudioSlot(payload, input(changed, newSlots.docs[0]), denied),
  ).rejects.toThrow(/full/)
  await expect(reserveStudioSlot(payload, input(doc, slots[1]), denied)).rejects.toThrow(/changed/)
})
test('pending approval reserves capacity; approval is explicit, cancellation releases, and generic changes cannot bypass it', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day({ confirmationMode: 'manual' })
  const booking = (await reserveStudioSlot(payload, input(doc, slots[0]), denied)).booking
  expect(booking.status).toBe('pending_approval')
  await prepareStudioMessages(payload, booking.id)
  const pendingMessage = (
    await payload.find({ collection: 'email-messages', user, overrideAccess: false })
  ).docs[0]
  expect(pendingMessage.text).toContain('Awaiting photographer approval')
  expect(
    (await payload.count({ collection: 'follow-ups', user, overrideAccess: false })).totalDocs,
  ).toBe(0)
  await expect(reserveStudioSlot(payload, input(doc, slots[0]), denied)).rejects.toThrow(/full/)
  await expect(
    recordOperation(payload, user, {
      key: randomUUID(),
      action: 'changeBooking',
      booking: booking.id,
      status: 'cancelled',
      expectedMinor: 0,
      reason: 'Synthetic reason',
    }),
  ).rejects.toThrow(/studio-session/)
  await changeStudioBooking(payload, user, {
    key: randomUUID(),
    action: 'approve',
    booking: booking.id,
    revision: 1,
    reason: 'Reviewed synthetic session request.',
  })
  await prepareStudioMessages(payload, booking.id)
  await changeStudioBooking(payload, user, {
    key: randomUUID(),
    action: 'cancel',
    booking: booking.id,
    revision: 2,
    reason: 'Customer requested synthetic cancellation.',
  })
  await prepareStudioMessages(payload, booking.id)
  const messages = await payload.find({
    collection: 'email-messages',
    user,
    overrideAccess: false,
    sort: 'createdAt',
  })
  expect(messages.docs.map((message) => message.status)).toEqual(['disabled', 'disabled', 'draft'])
  expect(messages.docs[2].text).toContain('Status: Cancelled')
  expect((await reserveStudioSlot(payload, input(doc, slots[0]), denied)).booking.status).toBe(
    'pending_approval',
  )
})
test('a failed move preserves original allocation; success preserves pending status and checks booking revision', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day({ confirmationMode: 'manual' })
  const first = (await reserveStudioSlot(payload, input(doc, slots[0]), denied)).booking
  const second = (await reserveStudioSlot(payload, input(doc, slots[1]), denied)).booking
  const move = {
    key: randomUUID(),
    action: 'reschedule',
    booking: first.id,
    revision: 1,
    day: doc.id,
    slot: slots[1].id,
    scheduleRevision: doc.scheduleRevision,
    conditionsAccepted: true,
    reason: 'Customer agreed synthetic replacement.',
  }
  await expect(changeStudioBooking(payload, user, move)).rejects.toThrow(/full/)
  expect(
    (
      await payload.findByID({
        collection: 'bookings',
        id: first.id,
        user,
        overrideAccess: false,
        depth: 0,
      })
    ).studioSlot,
  ).toBe(slots[0].id)
  await changeStudioBooking(payload, user, {
    key: randomUUID(),
    action: 'cancel',
    booking: second.id,
    revision: 1,
    reason: 'Synthetic capacity release request.',
  })
  const success = await changeStudioBooking(payload, user, move)
  expect(success.revision).toBe(2)
  expect(await changeStudioBooking(payload, user, move)).toEqual(success)
  const saved = await payload.findByID({
    collection: 'bookings',
    id: first.id,
    user,
    overrideAccess: false,
    depth: 0,
  })
  expect(saved.status).toBe('pending_approval')
  expect(saved.studioSlot).toBe(slots[1].id)
  await expect(changeStudioBooking(payload, user, { ...move, key: randomUUID() })).rejects.toThrow(
    /changed/,
  )
  expect((await reserveStudioSlot(payload, input(doc, slots[0]), denied)).created).toBe(true)
})
test('message failure leaves the booking durable and a retry creates exactly one private draft with no transport', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day()
  const booking = (await reserveStudioSlot(payload, input(doc, slots[0]), denied)).booking
  const create = payload.create.bind(payload)
  const injected = vi.spyOn(payload, 'create').mockImplementation((options) => {
    if (options.collection === 'email-messages') throw new Error('Synthetic draft failure')
    return create(options)
  })
  await prepareStudioMessages(payload, booking.id)
  injected.mockRestore()
  expect(
    (
      await payload.findByID({
        collection: 'bookings',
        id: booking.id,
        user,
        overrideAccess: false,
      })
    ).studioMessageState,
  ).toBe('failed')
  const transport = vi.spyOn(payload, 'sendEmail')
  await Promise.all([
    prepareStudioMessages(payload, booking.id),
    prepareStudioMessages(payload, booking.id),
  ])
  expect(transport).not.toHaveBeenCalled()
  transport.mockRestore()
  expect(
    (
      await payload.findByID({
        collection: 'bookings',
        id: booking.id,
        user,
        overrideAccess: false,
      })
    ).studioMessageState,
  ).toBe('ready')
  expect(
    (await payload.count({ collection: 'email-messages', user, overrideAccess: false })).totalDocs,
  ).toBe(1)
  expect(
    (await payload.count({ collection: 'enquiries', user, overrideAccess: false })).totalDocs,
  ).toBe(0)
})
test('database guard rejects over-capacity writes even through a privileged Local API operation', async () => {
  const { payload } = fixture
  const { doc, slots } = await day()
  const booking = (await reserveStudioSlot(payload, input(doc, slots[0]), denied)).booking
  await expect(
    internalTransaction(payload, async (req) => {
      const data = { ...booking, id: undefined, createdAt: undefined, updatedAt: undefined }
      return payload.create({
        collection: 'bookings',
        req,
        overrideAccess: false,
        data: { ...data, studioSubmissionHash: 'synthetic-different-hash', studioSeat: 2 },
      })
    }),
  ).rejects.toThrow()
})

test('the database guard rejects overlapping allocations across schedule revisions, independently of the command', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day()
  const booking = (await reserveStudioSlot(payload, input(doc, slots[0]), denied)).booking
  const changed = await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    data: { _status: 'published', location: 'Changed synthetic venue', acknowledgeBookings: true },
  })
  const newSlot = (
    await payload.find({
      collection: 'studio-slots',
      user,
      overrideAccess: false,
      depth: 0,
      where: { revision: { equals: changed.scheduleRevision } },
      sort: 'startsAt',
    })
  ).docs[0]
  await expect(
    payload.db.pool.query(
      `INSERT INTO bookings
    (title, contact_id, source, status, session_at, expected_minor, currency, attribution, studio_day_id,
     studio_slot_id, studio_seat, studio_revision, studio_snapshot, session_ends_at, occupied_until, studio_submission_hash)
    SELECT title, contact_id, source, status, session_at, expected_minor, currency, attribution, studio_day_id,
      $1, 1, 1, studio_snapshot, session_ends_at, occupied_until, 'synthetic-overlap-bypass' FROM bookings WHERE id = $2`,
      [newSlot.id, booking.id],
    ),
  ).rejects.toMatchObject({ code: '23514', message: 'Studio session capacity exceeded' })
})

test('approved session rules start only after approval and moving replaces obsolete draft messages and jobs', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day({ confirmationMode: 'manual' })
  const template = await payload.create({
    collection: 'email-templates',
    user,
    overrideAccess: false,
    data: {
      name: 'Synthetic studio reminder',
      kind: 'follow_up',
      subject: 'Your {{service_title}}',
      body: 'Hello {{contact_name}}, your session is {{session_time}}.',
      approved: true,
    },
  })
  await payload.create({
    collection: 'follow-up-rules',
    user,
    overrideAccess: false,
    data: {
      name: 'Synthetic session reminder',
      purpose: 'session_reminder',
      template: template.id,
      hours: 24,
      timeZone: 'Europe/Amsterdam',
      approvedForTests: true,
      revision: 1,
    },
  })
  const booking = (await reserveStudioSlot(payload, input(doc, slots[0]), denied)).booking
  await prepareStudioMessages(payload, booking.id)
  expect(
    (await payload.count({ collection: 'follow-ups', user, overrideAccess: false })).totalDocs,
  ).toBe(0)
  await changeStudioBooking(payload, user, {
    key: randomUUID(),
    action: 'approve',
    booking: booking.id,
    revision: 1,
    reason: 'Synthetic request reviewed and approved.',
  })
  await prepareStudioMessages(payload, booking.id)
  const original = (
    await payload.find({ collection: 'follow-ups', user, overrideAccess: false, depth: 0 })
  ).docs[0]
  expect(original).toMatchObject({
    enquiry: null,
    booking: booking.id,
    state: 'planned',
    sessionSnapshot: booking.sessionAt,
  })
  expect(original.text).toContain('Synthetic Customer')
  await changeStudioBooking(payload, user, {
    key: randomUUID(),
    action: 'reschedule',
    booking: booking.id,
    revision: 2,
    day: doc.id,
    slot: slots[1].id,
    scheduleRevision: doc.scheduleRevision,
    conditionsAccepted: true,
    reason: 'Customer agreed to synthetic replacement.',
  })
  await prepareStudioMessages(payload, booking.id)
  const plans = (
    await payload.find({
      collection: 'follow-ups',
      user,
      overrideAccess: false,
      depth: 0,
      sort: 'id',
    })
  ).docs
  expect(plans).toHaveLength(2)
  expect(plans[0]).toMatchObject({ state: 'cancelled', jobID: null })
  expect(plans[1]).toMatchObject({ state: 'planned', sessionSnapshot: slots[1].startsAt })
  const oldJob = await payload.findByID({
    collection: 'payload-jobs',
    id: original.jobID!,
    overrideAccess: true,
  })
  expect(oldJob).toMatchObject({ hasError: true, error: { cancelled: true } })
  await changeStudioBooking(payload, user, {
    key: randomUUID(),
    action: 'cancel',
    booking: booking.id,
    revision: 3,
    reason: 'Synthetic customer cancellation request.',
  })
  await prepareStudioMessages(payload, booking.id)
  expect(
    (
      await payload.find({
        collection: 'follow-ups',
        user,
        overrideAccess: false,
        where: { state: { equals: 'planned' } },
      })
    ).totalDocs,
  ).toBe(0)
})

test('attribution is minimized and consent-aware; withdrawal and forged snapshots cannot attach campaign data', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day()
  const campaign = updateCampaign(
    undefined,
    campaignTouch(
      {
        utm_source: 'google',
        utm_campaign: 'synthetic_studio',
        gclid: 'SyntheticClickID',
        utm_content: 'private@example.test',
        arbitrary: 'secret',
      },
      'direct',
    ),
  )
  const first = (
    await reserveStudioSlot(
      payload,
      input(doc, slots[0]),
      { campaigns: true, analytics: true, decided: true },
      { ...campaign, untrusted: 'private@example.test' } as typeof campaign,
    )
  ).booking
  expect(first.attribution).toMatchObject({
    source: 'google',
    consent: 'granted',
    snapshot: { first: { tags: { utm_source: 'google', gclid: 'SyntheticClickID' } } },
  })
  expect(JSON.stringify(first.attribution)).not.toMatch(
    /private@|secret|Synthetic Customer|synthetic@example/,
  )
  const withdrawn = (
    await reserveStudioSlot(
      payload,
      input(doc, slots[1]),
      { campaigns: false, analytics: false, decided: true },
      campaign,
    )
  ).booking
  expect(withdrawn.attribution).toMatchObject({ consent: 'denied', status: 'withheld' })
  expect(withdrawn.attribution).not.toHaveProperty('snapshot')
  const forged = {
    ...campaign,
    first: {
      ...campaign.first,
      tags: { ...campaign.first.tags, utm_campaign: 'private@example.test' },
    },
  }
  const invalid = (
    await reserveStudioSlot(
      payload,
      input(doc, slots[2]),
      { campaigns: true, analytics: false, decided: true },
      forged,
    )
  ).booking
  expect(invalid.attribution).not.toHaveProperty('snapshot')
  const publicData = JSON.stringify(await studioAvailability(payload, doc.id))
  expect(publicData).not.toMatch(
    /synthetic@example|Synthetic Customer|contact|studioSubmissionHash/,
  )
  await expect(payload.find({ collection: 'bookings', overrideAccess: false })).rejects.toThrow()
  expect(
    (await payload.count({ collection: 'bookings', user, overrideAccess: false })).totalDocs,
  ).toBe(3)
})

test('validation, spam, expired deadlines and closed states cannot allocate capacity', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day()
  for (const changes of [
    { name: 'A' },
    { email: 'invalid' },
    { website: 'bot.example' },
    { conditionsAccepted: false },
    { submissionId: 'invalid' },
  ])
    await expect(
      reserveStudioSlot(payload, { ...input(doc, slots[0]), ...changes }, denied),
    ).rejects.toThrow()
  expect(
    (await payload.count({ collection: 'contacts', user, overrideAccess: false })).totalDocs,
  ).toBe(0)
  const expired = await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    data: { bookingDeadlineLocal: '2026-01-01T09:00' },
  })
  expect((await studioAvailability(payload, doc.id)).state).toBe('closed')
  const current = (
    await payload.find({
      collection: 'studio-slots',
      user,
      overrideAccess: false,
      where: { revision: { equals: expired.scheduleRevision } },
    })
  ).docs[0]
  await expect(reserveStudioSlot(payload, input(expired, current), denied)).rejects.toThrow(
    /closed/,
  )
  await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    data: { dayState: 'cancelled' },
  })
  expect((await studioAvailability(payload, doc.id)).state).toBe('cancelled')
  await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    data: { dayState: 'scheduled', localDate: '2026-01-02' },
  })
  expect((await studioAvailability(payload, doc.id)).state).toBe('past')
})

test('competing cross-day moves allocate once, preserve approval status and leave the losing commitment intact', async () => {
  const { payload } = fixture
  const { doc, slots, user } = await day({ confirmationMode: 'manual' })
  const first = (await reserveStudioSlot(payload, input(doc, slots[0]), denied)).booking
  const second = (await reserveStudioSlot(payload, input(doc, slots[1]), denied)).booking
  const target = await payload.create({
    collection: 'studio-days',
    user,
    overrideAccess: false,
    data: {
      ...doc,
      id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      slug: 'synthetic-next-day',
      localDate: '2027-03-28',
      bookingDeadlineLocal: '2027-03-28T08:00',
      confirmationMode: 'immediate',
      location: 'Synthetic replacement venue',
      closesLocal: '09:45',
    },
  })
  const targetSlot = (
    await payload.find({
      collection: 'studio-slots',
      user,
      overrideAccess: false,
      depth: 0,
      where: { day: { equals: target.id } },
    })
  ).docs[0]
  const results = await Promise.allSettled(
    [first, second].map((booking) =>
      changeStudioBooking(payload, user, {
        key: randomUUID(),
        action: 'reschedule',
        booking: booking.id,
        revision: 1,
        day: target.id,
        slot: targetSlot.id,
        scheduleRevision: target.scheduleRevision,
        conditionsAccepted: true,
        reason: 'Customer agreed to the new studio day.',
      }),
    ),
  )
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  const saved = (
    await payload.find({ collection: 'bookings', user, overrideAccess: false, depth: 0 })
  ).docs
  expect(saved.every((booking) => booking.status === 'pending_approval')).toBe(true)
  const moved = saved.find((booking) => booking.studioDay === target.id)!
  expect(moved.studioSnapshot).toMatchObject({ location: 'Synthetic replacement venue' })
  expect(saved.find((booking) => booking.studioDay === doc.id)!.studioRevision).toBe(1)
  const availability = await studioAvailability(payload, target.id)
  expect(availability.state).toBe('sold_out')
  expect(availability.slots.every((slot) => slot.remaining === 0)).toBe(true)
})

test('synthetic studio bootstrap preserves editor changes and commits no partial inventory on failure', async () => {
  const { payload } = fixture
  const originalCreate = payload.create.bind(payload)
  const injection = vi.spyOn(payload, 'create').mockImplementation((options) => {
    if (options.collection === 'studio-slots') throw new Error('Synthetic schedule interruption')
    return originalCreate(options)
  })
  await expect(seedStudioDemo(payload)).rejects.toThrow('Synthetic schedule interruption')
  injection.mockRestore()
  expect((await payload.count({ collection: 'studio-days', overrideAccess: true })).totalDocs).toBe(
    0,
  )
  expect(
    (await payload.count({ collection: 'studio-slots', overrideAccess: true })).totalDocs,
  ).toBe(0)
  await seedStudioDemo(payload)
  const user = await createEditor(payload)
  const first = (await payload.find({ collection: 'studio-days', user, overrideAccess: false }))
    .docs[0]
  await payload.update({
    collection: 'studio-days',
    id: first.id,
    user,
    overrideAccess: false,
    draft: true,
    data: { title: 'Preserved synthetic edit' },
  })
  await seedStudioDemo(payload)
  const after = await payload.find({
    collection: 'studio-days',
    user,
    overrideAccess: false,
    draft: true,
  })
  expect(after.totalDocs).toBe(1)
  expect(after.docs[0].title).toBe('Preserved synthetic edit')
})
