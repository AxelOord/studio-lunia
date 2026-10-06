import { createHash } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { APIError, type CollectionBeforeChangeHook, type CollectionAfterChangeHook } from 'payload'
import { recordContext, transactionDB } from '../customer-records/core'
import { studioConfiguration, studioIntervals } from './domain'
import type { StudioDay } from '../payload-types'

export const prepareStudioDay: CollectionBeforeChangeHook<StudioDay> = async ({
  data,
  originalDoc,
  req,
}) => {
  const db = await transactionDB(req)
  const current = originalDoc?.id
    ? ((
        await db.execute(
          sql`SELECT schedule_revision, configuration_hash FROM studio_days WHERE id = ${originalDoc.id} FOR UPDATE`,
        )
      ).rows[0] as
        | { schedule_revision: string | number | null; configuration_hash: string | null }
        | undefined)
    : undefined
  // PostgreSQL NUMERIC values arrive as strings; normalize before arithmetic.
  const revision = Number(current?.schedule_revision ?? 0)
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new APIError('The studio schedule revision is invalid. Ask an editor to review it.', 422)
  const merged = { ...originalDoc, ...data }
  data.scheduleRevision = revision
  data.configurationHash = current?.configuration_hash || null
  const acknowledge = data.acknowledgeBookings === true
  data.acknowledgeBookings = false
  if (merged._status !== 'published') return data
  try {
    const config = studioConfiguration(merged)
    const hash = createHash('sha256').update(JSON.stringify(config)).digest('hex')
    if (hash !== current?.configuration_hash) {
      if (originalDoc?.id) {
        const active = await db.execute(
          sql`SELECT id FROM bookings WHERE studio_day_id = ${originalDoc.id} AND status IN ('pending_approval', 'confirmed') LIMIT 1`,
        )
        if (active.rows.length && !acknowledge)
          throw new Error(
            'Review existing bookings and acknowledge their unchanged commitments before publishing new settings.',
          )
      }
      data.configurationHash = hash
      if (!Number.isSafeInteger(revision + 1))
        throw new Error('The studio schedule revision cannot be increased safely.')
      data.scheduleRevision = revision + 1
    }
    return data
  } catch (error) {
    throw new APIError(
      error instanceof Error ? error.message : 'Check the studio-day settings.',
      422,
    )
  }
}
export const publishStudioDay: CollectionAfterChangeHook<StudioDay> = async ({ doc, req }) => {
  if (doc._status !== 'published') return doc
  const config = studioConfiguration(doc as unknown as Record<string, unknown>)
  const revision = doc.scheduleRevision || 0
  const existing = await req.payload.count({
    collection: 'studio-slots',
    req,
    context: { ...req.context, ...recordContext },
    overrideAccess: false,
    where: { and: [{ day: { equals: doc.id } }, { revision: { equals: revision } }] },
  })
  if (existing.totalDocs) return doc
  for (const interval of studioIntervals(config)) {
    await req.payload.create({
      collection: 'studio-slots',
      req,
      context: { ...req.context, ...recordContext },
      overrideAccess: false,
      data: {
        day: doc.id,
        revision,
        slotKey: `${doc.id}:${revision}:${interval.startsAt}`,
        ...interval,
        capacity: config.capacity,
        snapshot: { ...config, ...interval, revision },
      },
      depth: 0,
    })
  }
  return doc
}
