import { sql } from '@payloadcms/db-postgres'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import { idInput, internalTransaction, object, transactionDB } from '../customer-records/core'
import type { StudioSnapshot } from './domain'

export async function studioAvailability(payload: Payload, id: number) {
  return internalTransaction(payload, async (req) => {
    const day = await payload.findByID({
      collection: 'studio-days',
      id,
      req,
      overrideAccess: false,
      draft: false,
      depth: 0,
    })
    if (day._status !== 'published') throw new APIError('Studio day not found.', 404)
    const slots = await payload.find({
      collection: 'studio-slots',
      req,
      overrideAccess: false,
      depth: 0,
      pagination: false,
      where: { and: [{ day: { equals: id } }, { revision: { equals: day.scheduleRevision } }] },
      sort: 'startsAt',
    })
    const offer = slots.docs[0] ? (object(slots.docs[0].snapshot) as StudioSnapshot) : undefined
    if (!offer) throw new APIError('This studio day is not ready for bookings.', 409)
    const state =
      day.dayState === 'cancelled'
        ? 'cancelled'
        : Date.parse(offer.closesAt) <= Date.now()
          ? 'past'
          : !day.bookingsOpen || Date.parse(offer.bookingDeadline) <= Date.now()
            ? 'closed'
            : 'available'
    const db = await transactionDB(req)
    const counts =
      await db.execute(sql`SELECT s.id, count(b.id)::int AS occupied FROM studio_slots s
      LEFT JOIN bookings b ON b.studio_day_id = s.day_id AND b.status IN ('pending_approval','confirmed','completed')
        AND b.session_at < s.occupied_until AND b.occupied_until > s.starts_at
      WHERE s.day_id = ${id} AND s.revision = ${day.scheduleRevision} GROUP BY s.id`)
    const occupied = new Map(counts.rows.map((row) => [Number(row.id), Number(row.occupied)]))
    const availability = slots.docs.map((slot) => ({
      id: slot.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      remaining:
        state === 'available' && Date.parse(slot.startsAt) > Date.now()
          ? Math.max(0, slot.capacity - (occupied.get(slot.id) || 0))
          : 0,
    }))
    return {
      id: day.id,
      title: day.title,
      slug: day.slug,
      revision: day.scheduleRevision!,
      offer,
      state:
        state === 'available' && !availability.some((slot) => slot.remaining) ? 'sold_out' : state,
      slots: availability,
    }
  })
}
export async function studioWorkspace(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  dayID?: number,
) {
  const days = await payload.find({
    collection: 'studio-days',
    user,
    overrideAccess: false,
    draft: true,
    limit: 100,
    depth: 0,
    sort: '-localDate',
  })
  // Rescheduling uses published facts even when staff have a newer private draft.
  const publishedDays = await payload.find({
    collection: 'studio-days',
    overrideAccess: false,
    draft: false,
    limit: 100,
    depth: 0,
    sort: '-localDate',
    select: { title: true, localDate: true },
  })
  const day = dayID
    ? await payload.findByID({
        collection: 'studio-days',
        id: idInput(dayID),
        user,
        overrideAccess: false,
        draft: true,
        depth: 0,
      })
    : undefined
  const bookings = day
    ? await payload.find({
        collection: 'bookings',
        user,
        overrideAccess: false,
        depth: 1,
        limit: 300,
        where: { studioDay: { equals: day.id } },
        sort: ['sessionAt', 'id'],
      })
    : undefined
  let availability: Awaited<ReturnType<typeof studioAvailability>> | undefined
  if (day) {
    const published = await payload.find({
      collection: 'studio-days',
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1,
      where: { id: { equals: day.id } },
    })
    if (published.docs[0]) availability = await studioAvailability(payload, day.id)
  }
  return {
    days: days.docs,
    publishedDays: publishedDays.docs,
    hasMoreDays: days.hasNextPage,
    day,
    bookings: bookings?.docs || [],
    hasMoreBookings: Boolean(bookings?.hasNextPage),
    availability,
  }
}
