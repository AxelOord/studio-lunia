import { createHash } from 'node:crypto'
import type { Payload } from 'payload'
import { uuidPattern } from '../lib/inquiry'
import { deliverMeasurement, measurementEnabled } from '../inquiries/measurement'

export type StudioVisitorEvent = 'studio_day_viewed' | 'studio_slot_selected'
type StudioMeasurement =
  | { event: StudioVisitorEvent }
  | { event: 'studio_booking_submitted'; status: 'confirmed' | 'pending_approval' }

export function studioMeasurementPayload(session: string, day: number, step: StudioMeasurement) {
  if (
    !uuidPattern.test(session) ||
    !Number.isSafeInteger(day) ||
    day <= 0 ||
    !['studio_day_viewed', 'studio_slot_selected', 'studio_booking_submitted'].includes(
      step.event,
    ) ||
    (step.event === 'studio_booking_submitted' &&
      !['confirmed', 'pending_approval'].includes(step.status))
  )
    throw new Error('Invalid studio measurement')
  const hash = createHash('sha256')
    .update(`${session}:studio-day:${day}:${step.event}`)
    .digest('hex')
  return {
    api_key: process.env.POSTHOG_PROJECT_TOKEN,
    uuid: `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`,
    event: step.event,
    distinct_id: session,
    properties: {
      studio_day_id: createHash('sha256').update(`studio-day:${day}`).digest('hex').slice(0, 24),
      schema_version: 1,
      $process_person_profile: false,
      $geoip_disable: true,
      $ip: null,
      ...(step.event === 'studio_booking_submitted' ? { booking_status: step.status } : {}),
    },
  }
}

export async function captureStudioMeasurement(
  payload: Payload,
  session: string | undefined,
  day: number,
  step: StudioMeasurement,
  send: typeof fetch = fetch,
) {
  if (!session || !measurementEnabled()) return 'disabled'
  return deliverMeasurement(payload, studioMeasurementPayload(session, day, step), send)
}
