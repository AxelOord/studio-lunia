import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { createEditor, createTestCMS } from '../helpers/payload'
import {
  captureStudioMeasurement,
  studioMeasurementPayload,
} from '../../src/studio-days/measurement'
import { submitStudioReservation } from '../../src/studio-days/submit'
import { changeStudioBooking } from '../../src/studio-days/reservations'
import { studioAvailability } from '../../src/studio-days/queries'

let fixture: Awaited<ReturnType<typeof createTestCMS>>
beforeAll(async () => {
  fixture = await createTestCMS()
})
beforeEach(async () => {
  await fixture.reset()
  vi.stubEnv('LUNIA_POSTHOG_ENABLED', 'true')
  vi.stubEnv('POSTHOG_PROJECT_TOKEN', 'synthetic-studio-token')
})
afterEach(() => vi.unstubAllEnvs())
afterAll(async () => {
  await fixture?.close()
})

function privacy(analytics = true, session: string | undefined = randomUUID()) {
  return {
    preferences: { analytics, campaigns: false, decided: true },
    session,
    campaign: undefined,
  }
}
async function reservation(confirmationMode: 'manual' | 'immediate' = 'immediate') {
  const user = await createEditor(fixture.payload)
  const day = await fixture.payload.create({
    collection: 'studio-days',
    user,
    overrideAccess: false,
    data: {
      title: 'Synthetic measurement day',
      slug: 'synthetic-measurement',
      location: 'Private synthetic studio location',
      localDate: '2027-03-27',
      timeZone: 'Europe/Amsterdam',
      offerTitle: 'Private synthetic offer',
      inclusions: 'Synthetic inclusion',
      durationMinutes: 30,
      bufferMinutes: 0,
      capacity: 3,
      priceMinor: 12300,
      currency: 'EUR',
      opensLocal: '09:00',
      closesLocal: '12:00',
      bookingDeadlineLocal: '2027-03-27T08:00',
      changePolicy: 'Private synthetic conditions',
      confirmationMode,
      bookingsOpen: true,
      dayState: 'scheduled',
      _status: 'published',
    },
  })
  const availability = await studioAvailability(fixture.payload, day.id)
  return {
    user,
    day,
    input: {
      action: 'reserve',
      day: day.id,
      slot: availability.slots[0].id,
      revision: availability.revision,
      name: 'Private Synthetic Visitor',
      email: 'private@example.test',
      conditionsAccepted: true,
      website: '',
      submissionId: randomUUID(),
      analyticsAllowed: true,
    },
  }
}

test('concurrent session/day steps claim once; another day counts separately; failed delivery never replays', async () => {
  const { payload } = fixture
  const session = randomUUID()
  const send = vi.fn<typeof fetch>(async () => new Response('{}'))
  for (const event of ['studio_day_viewed', 'studio_slot_selected'] as const) {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        captureStudioMeasurement(payload, session, 42, { event }, send),
      ),
    )
    expect(results.filter((result) => result === 'sent')).toHaveLength(1)
    expect(results.filter((result) => result === 'duplicate')).toHaveLength(3)
  }
  expect(
    await captureStudioMeasurement(payload, session, 43, { event: 'studio_day_viewed' }, send),
  ).toBe('sent')
  expect(send).toHaveBeenCalledTimes(3)
  const failed = vi.fn<typeof fetch>(async () => {
    throw new Error('Synthetic ambiguous failure')
  })
  expect(
    await captureStudioMeasurement(
      payload,
      session,
      42,
      { event: 'studio_booking_submitted', status: 'pending_approval' },
      failed,
    ),
  ).toBe('failed')
  expect(
    await captureStudioMeasurement(
      payload,
      session,
      42,
      { event: 'studio_booking_submitted', status: 'confirmed' },
      send,
    ),
  ).toBe('duplicate')
  expect(failed).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledTimes(3)
  for (const [url, options] of send.mock.calls) {
    expect(url).toBe('https://eu.i.posthog.com/i/v0/e/')
    expect(JSON.parse(String(options?.body)).properties).toEqual({
      studio_day_id: expect.stringMatching(/^[a-f0-9]{24}$/),
      schema_version: 1,
      $geoip_disable: true,
      $ip: null,
      $process_person_profile: false,
    })
  }
})

test.each(['immediate', 'manual'] as const)(
  'durable %s completion emits once across concurrent receipt retries and later changes',
  async (mode) => {
    const { payload } = fixture
    const { input, day, user } = await reservation(mode)
    const consent = privacy()
    const committedCounts: (number | null)[] = []
    const send = vi.fn<typeof fetch>(async () => {
      // Record evidence here; assertions outside the transport cannot be swallowed as failures.
      committedCounts.push(
        (await payload.db.pool.query('SELECT id FROM bookings WHERE studio_day_id = $1', [day.id]))
          .rowCount,
      )
      return new Response('{}')
    })
    const results = await Promise.all(
      Array.from({ length: 4 }, () => submitStudioReservation(payload, input, consent, send)),
    )
    expect(committedCounts).toEqual([1])
    expect(JSON.parse(String(send.mock.calls[0][1]?.body))).toEqual(
      studioMeasurementPayload(consent.session!, day.id, {
        event: 'studio_booking_submitted',
        status: mode === 'manual' ? 'pending_approval' : 'confirmed',
      }),
    )
    expect(results.filter((result) => result.created)).toHaveLength(1)
    expect(new Set(results.map((result) => result.booking.id)).size).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)
    await changeStudioBooking(payload, user, {
      action: 'cancel',
      key: randomUUID(),
      booking: results[0].booking.id,
      revision: 1,
      reason: 'Synthetic customer cancellation requested.',
    })
    const retry = await submitStudioReservation(payload, input, privacy(), send)
    expect(retry.created).toBe(false)
    expect(retry.booking.status).toBe('cancelled')
    expect(send).toHaveBeenCalledTimes(1)
    expect(String(send.mock.calls[0][1]?.body)).not.toMatch(
      /Private|private@|conditions|location|price|submissionId|studio_slot/,
    )
  },
)

test('unknown, denied and in-flight withdrawal permissions create bookings with no claims; later consent does not backfill', async () => {
  const { payload } = fixture
  const { input } = await reservation()
  const send = vi.fn<typeof fetch>(async () => new Response('{}'))
  for (const [consent, allowed] of [
    [privacy(false), true],
    [privacy(true), false],
    [{ ...privacy(), session: undefined }, true],
  ] as const) {
    const data = { ...input, submissionId: randomUUID(), analyticsAllowed: allowed }
    const result = await submitStudioReservation(payload, data, consent, send)
    expect(result.created).toBe(true)
    expect(
      (await submitStudioReservation(payload, { ...data, analyticsAllowed: true }, privacy(), send))
        .created,
    ).toBe(false)
  }
  expect(send).not.toHaveBeenCalled()
  expect(
    (await payload.db.pool.query('SELECT event_key FROM lunia_measurement_events')).rowCount,
  ).toBe(0)
})

test('validation/conflicts emit no completion; provider and claim failures cannot fail saved reservations', async () => {
  const { payload } = fixture
  const { input } = await reservation()
  const send = vi.fn<typeof fetch>(async () => {
    throw new Error('Synthetic provider failure')
  })
  await expect(
    submitStudioReservation(payload, { ...input, conditionsAccepted: false }, privacy(), send),
  ).rejects.toMatchObject({ status: 422 })
  await expect(
    submitStudioReservation(payload, { ...input, revision: input.revision + 1 }, privacy(), send),
  ).rejects.toMatchObject({ status: 409 })
  expect(send).not.toHaveBeenCalled()
  const saved = await submitStudioReservation(payload, input, privacy(), send)
  expect(saved.created).toBe(true)
  expect(saved.booking.status).toBe('confirmed')
  expect(send).toHaveBeenCalledTimes(1)
  expect((await submitStudioReservation(payload, input, privacy(), send)).created).toBe(false)
  expect(send).toHaveBeenCalledTimes(1)
  // Only the optional claim relation is unavailable; reservation tables stay intact.
  await payload.db.pool.query(
    'ALTER TABLE lunia_measurement_events RENAME TO unavailable_measurement_events',
  )
  try {
    const next = await submitStudioReservation(
      payload,
      { ...input, submissionId: randomUUID() },
      privacy(),
      send,
    )
    expect(next.created).toBe(true)
    expect(next.booking.status).toBe('confirmed')
    expect(send).toHaveBeenCalledTimes(1)
  } finally {
    await payload.db.pool.query(
      'ALTER TABLE unavailable_measurement_events RENAME TO lunia_measurement_events',
    )
  }
})
