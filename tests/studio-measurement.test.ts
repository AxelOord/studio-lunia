import { randomUUID } from 'node:crypto'
import { afterEach, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
import { captureStudioMeasurement, studioMeasurementPayload } from '../src/studio-days/measurement'
import { measurementPayload } from '../src/inquiries/measurement'

afterEach(() => vi.unstubAllEnvs())

test('studio stages have stable session/day/step identity, bounded properties and no bespoke collision', () => {
  const session = randomUUID()
  const viewed = studioMeasurementPayload(session, 42, { event: 'studio_day_viewed' })
  const selected = studioMeasurementPayload(session, 42, { event: 'studio_slot_selected' })
  const submitted = studioMeasurementPayload(session, 42, {
    event: 'studio_booking_submitted',
    status: 'confirmed',
  })
  expect(viewed).toEqual(studioMeasurementPayload(session, 42, { event: 'studio_day_viewed' }))
  expect(new Set([viewed.uuid, selected.uuid, submitted.uuid]).size).toBe(3)
  expect(viewed.uuid).not.toBe(
    studioMeasurementPayload(session, 43, { event: 'studio_day_viewed' }).uuid,
  )
  expect(viewed.uuid).not.toBe(
    studioMeasurementPayload(randomUUID(), 42, { event: 'studio_day_viewed' }).uuid,
  )
  expect(viewed.uuid).not.toBe(measurementPayload(session, '42:studio', 'service_viewed').uuid)
  expect(submitted.uuid).toBe(
    studioMeasurementPayload(session, 42, {
      event: 'studio_booking_submitted',
      status: 'pending_approval',
    }).uuid,
  )
  expect(Object.keys(viewed).sort()).toEqual([
    'api_key',
    'distinct_id',
    'event',
    'properties',
    'uuid',
  ])
  expect(viewed.distinct_id).toBe(session)
  expect(viewed.properties).toEqual({
    studio_day_id: expect.stringMatching(/^[a-f0-9]{24}$/),
    schema_version: 1,
    $process_person_profile: false,
    $geoip_disable: true,
    $ip: null,
  })
  expect(selected.properties).toEqual(viewed.properties)
  expect(submitted.properties).toEqual({ ...viewed.properties, booking_status: 'confirmed' })
})

test('studio payload rejects malformed day/session/event/status even at an untyped boundary', () => {
  const session = randomUUID()
  for (const day of [0, -1, 1.2, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(() => studioMeasurementPayload(session, day, { event: 'studio_day_viewed' })).toThrow()
  expect(() =>
    studioMeasurementPayload('private@example.test', 1, { event: 'studio_day_viewed' }),
  ).toThrow()
  for (const step of [
    { event: 'click', url: 'https://private.example' },
    { event: 'studio_booking_submitted', status: 'cancelled' },
    { event: 'studio_booking_submitted' },
  ])
    expect(() =>
      studioMeasurementPayload(session, 1, step as Parameters<typeof studioMeasurementPayload>[2]),
    ).toThrow()
  const extra = { event: 'studio_day_viewed' as const, email: 'private@example.test', slot: 123 }
  expect(JSON.stringify(studioMeasurementPayload(session, 1, extra))).not.toMatch(
    /private|slot|email/,
  )
})

test('absent consent session or disabled configuration never claims or sends studio measurement', async () => {
  const send = vi.fn<typeof fetch>()
  vi.stubEnv('LUNIA_POSTHOG_ENABLED', 'true')
  vi.stubEnv('POSTHOG_PROJECT_TOKEN', 'synthetic-token')
  expect(
    await captureStudioMeasurement(
      {} as Payload,
      undefined,
      1,
      { event: 'studio_day_viewed' },
      send,
    ),
  ).toBe('disabled')
  vi.stubEnv('LUNIA_POSTHOG_ENABLED', 'false')
  expect(
    await captureStudioMeasurement(
      {} as Payload,
      randomUUID(),
      1,
      { event: 'studio_day_viewed' },
      send,
    ),
  ).toBe('disabled')
  vi.stubEnv('LUNIA_POSTHOG_ENABLED', 'true')
  vi.stubEnv('POSTHOG_PROJECT_TOKEN', '')
  expect(
    await captureStudioMeasurement(
      {} as Payload,
      randomUUID(),
      1,
      { event: 'studio_day_viewed' },
      send,
    ),
  ).toBe('disabled')
  expect(send).not.toHaveBeenCalled()
})
