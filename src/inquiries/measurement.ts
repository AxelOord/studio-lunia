import { createHash } from 'node:crypto'
import type { Payload } from 'payload'
import { servicePattern, uuidPattern } from '../lib/inquiry'

export const measurementEvents = ['service_viewed', 'inquiry_started', 'inquiry_submitted'] as const
export type MeasurementEvent = (typeof measurementEvents)[number]
export function measurementEnabled() {
  return process.env.LUNIA_POSTHOG_ENABLED === 'true' && Boolean(process.env.POSTHOG_PROJECT_TOKEN)
}
export function measurementPayload(session: string, service: string, event: MeasurementEvent) {
  if (
    !uuidPattern.test(session) ||
    !servicePattern.test(service) ||
    !measurementEvents.includes(event)
  )
    throw new Error('Invalid measurement')
  const hash = createHash('sha256').update(`${session}:${service}:${event}`).digest('hex')
  const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
  return {
    api_key: process.env.POSTHOG_PROJECT_TOKEN,
    uuid,
    event,
    distinct_id: session,
    properties: {
      service_id: createHash('sha256').update(service).digest('hex').slice(0, 24),
      schema_version: 1,
      $process_person_profile: false,
      $geoip_disable: true,
      $ip: null,
    },
  }
}
export async function captureMeasurement(
  payload: Payload,
  session: string | undefined,
  service: string,
  event: MeasurementEvent,
  send: typeof fetch = fetch,
) {
  if (!session || !measurementEnabled()) return 'disabled'
  const body = measurementPayload(session, service, event)
  // At-most-once claim. Failed/ambiguous provider requests are not replayed after withdrawal.
  // Stable UUID also supplies PostHog's ingestion deduplication identity.
  const claim = await payload.db.pool.query(
    "INSERT INTO lunia_measurement_events (event_key, expires_at) VALUES ($1, now() + interval '1 day') ON CONFLICT DO NOTHING RETURNING event_key",
    [body.uuid],
  )
  await payload.db.pool.query('DELETE FROM lunia_measurement_events WHERE expires_at < now()')
  if (!claim.rowCount) return 'duplicate'
  try {
    const result = await send('https://eu.i.posthog.com/i/v0/e/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    })
    return result.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}
