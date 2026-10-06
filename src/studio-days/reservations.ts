import { createHmac } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import type { Booking, StudioDay, StudioSlot } from '../payload-types'
import {
  activity,
  command,
  idInput,
  internalTransaction,
  lockRecord,
  object,
  relationID,
  textInput,
  transactionDB,
} from '../customer-records/core'
import { leadAttribution, type Preferences } from '../inquiries/privacy'
import { validateCampaign, type CampaignSnapshot } from '../lib/campaign'
import { uuidPattern } from '../lib/inquiry'
import { lockConversation } from '../followups/operations'
import type { StudioSnapshot } from './domain'

export const activeStudioStatuses = ['pending_approval', 'confirmed', 'completed']
function digest(value: string) {
  return createHmac('sha256', process.env.PAYLOAD_SECRET!).update(value).digest('hex')
}
export function reservationInput(input: unknown) {
  const data = object(input)
  const name = textInput(data.name, 'Name', 2, 100)
  const email = textInput(data.email, 'Email', 3, 254).toLowerCase()
  if (/[\r\n\x00-\x1f]/.test(name) || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
    throw new APIError('Check your name and email address.', 422)
  if (data.website) throw new APIError('Unable to accept this request.', 422)
  if (data.conditionsAccepted !== true)
    throw new APIError('Review and accept the displayed conditions.', 422)
  if (typeof data.submissionId !== 'string' || !uuidPattern.test(data.submissionId))
    throw new APIError('Refresh the page and try again.', 422)
  return {
    name,
    email,
    day: idInput(data.day),
    slot: idInput(data.slot),
    revision: idInput(data.revision),
    submissionId: data.submissionId,
    conditionsAccepted: true,
  }
}
export async function lockStudioDays(req: PayloadRequest, ids: number[]) {
  const db = await transactionDB(req)
  for (const id of [...new Set(ids)].sort((a, b) => a - b))
    await db.execute(sql`SELECT id FROM studio_days WHERE id = ${id} FOR UPDATE`)
}
export async function remainingPlaces(req: PayloadRequest, slot: StudioSlot, excludeBooking = 0) {
  const db = await transactionDB(req)
  const occupied = await db.execute(sql`SELECT count(*)::int AS count FROM bookings
    WHERE studio_day_id = ${idInput(slot.day)} AND id <> ${excludeBooking}
      AND status IN ('pending_approval','confirmed','completed')
      AND session_at < ${slot.occupiedUntil}::timestamptz AND occupied_until > ${slot.startsAt}::timestamptz`)
  return Math.max(0, slot.capacity - Number(occupied.rows[0].count))
}
async function currentSlot(
  req: PayloadRequest,
  dayID: number,
  slotID: number,
  revision: number,
  excludeBooking = 0,
) {
  // Staff and visitors use the same published inventory. The explicit status check also applies to editors.
  const day = await req.payload.findByID({
    collection: 'studio-days',
    id: dayID,
    req,
    overrideAccess: false,
    draft: false,
    depth: 0,
  })
  if (day._status !== 'published' || !day.bookingsOpen || day.dayState !== 'scheduled')
    throw new APIError('This studio day is not accepting new bookings.', 409)
  if (day.scheduleRevision !== revision)
    throw new APIError('The session details changed. Refresh and review them before booking.', 409)
  const slot = await req.payload.findByID({
    collection: 'studio-slots',
    id: slotID,
    req,
    overrideAccess: false,
    depth: 0,
  })
  if (relationID(slot.day) !== dayID || slot.revision !== revision)
    throw new APIError('This slot is no longer offered. Refresh availability.', 409)
  const snapshot = object(slot.snapshot) as StudioSnapshot
  if (Date.parse(snapshot.bookingDeadline) <= Date.now() || Date.parse(slot.startsAt) <= Date.now())
    throw new APIError('Booking has closed for this session.', 409)
  if (!(await remainingPlaces(req, slot, excludeBooking)))
    throw new APIError('That session is full. Choose another available time.', 409)
  const db = await transactionDB(req)
  const seats = await db.execute(
    sql`SELECT studio_seat FROM bookings WHERE studio_slot_id = ${slot.id} AND id <> ${excludeBooking} AND status IN ('pending_approval','confirmed','completed')`,
  )
  const occupied = new Set(seats.rows.map((row) => Number(row.studio_seat)))
  const seat = Array.from({ length: slot.capacity }, (_, i) => i + 1).find(
    (value) => !occupied.has(value),
  )
  if (!seat) throw new APIError('That session is full. Choose another available time.', 409)
  return { day, slot, snapshot, seat }
}
function committedFields(day: StudioDay, slot: StudioSlot, snapshot: StudioSnapshot, seat: number) {
  return {
    title: snapshot.offerTitle,
    studioDay: day.id,
    studioSlot: slot.id,
    studioSeat: seat,
    sessionAt: slot.startsAt,
    sessionEndsAt: slot.endsAt,
    occupiedUntil: slot.occupiedUntil,
    expectedMinor: snapshot.priceMinor,
    currency: snapshot.currency,
    studioSnapshot: snapshot,
  }
}
export function bookingReceipt(booking: Booking) {
  return {
    receipt: booking.studioSubmissionHash!.slice(0, 12).toUpperCase(),
    status: booking.status,
    session: booking.studioSnapshot as StudioSnapshot,
  }
}
export async function reserveStudioSlot(
  payload: Payload,
  input: unknown,
  preferences: Preferences,
  campaign?: CampaignSnapshot,
  staff?: { user: NonNullable<PayloadRequest['user']>; contact?: number },
) {
  const data = reservationInput(input)
  const key = digest(`studio:${staff ? `staff:${staff.user.id}:` : 'visitor:'}${data.submissionId}`)
  const contentHash = digest(JSON.stringify({ ...data, contact: staff?.contact || null }))
  return internalTransaction(payload, async (req) => {
    if (staff) req.user = staff.user
    const db = await transactionDB(req)
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
    const previous = (
      await payload.find({
        collection: 'bookings',
        req,
        overrideAccess: false,
        depth: 0,
        limit: 1,
        where: { studioSubmissionHash: { equals: key } },
      })
    ).docs[0]
    // Retry lookup precedes availability so a committed receipt survives closing/publishing.
    if (previous) {
      if (previous.studioContentHash !== contentHash)
        throw new APIError(
          'These details differ from the previous submission. Start a new booking.',
          409,
        )
      return { booking: previous, created: false }
    }
    await lockStudioDays(req, [data.day])
    const { day, slot, snapshot, seat } = await currentSlot(req, data.day, data.slot, data.revision)
    const contact = staff?.contact
      ? await payload.findByID({
          collection: 'contacts',
          id: idInput(staff.contact),
          req,
          overrideAccess: false,
          depth: 0,
        })
      : await payload.create({
          collection: 'contacts',
          req,
          overrideAccess: false,
          depth: 0,
          data: { name: data.name, email: data.email, sourceKey: `studio:${key}` },
        })
    if (staff?.contact && (contact.name !== data.name || contact.email !== data.email))
      throw new APIError(
        'Review the selected customer’s current name and email before reserving.',
        409,
      )
    const booking = await payload.create({
      collection: 'bookings',
      req,
      overrideAccess: false,
      depth: 0,
      data: {
        ...committedFields(day, slot, snapshot, seat),
        contact: contact.id,
        source: 'studio_slot',
        status: snapshot.confirmationMode === 'manual' ? 'pending_approval' : 'confirmed',
        studioRevision: 1,
        studioMessageState: 'pending',
        studioSubmissionHash: key,
        studioContentHash: contentHash,
        attribution: leadAttribution(preferences, validateCampaign(campaign)),
      },
    })
    await activity(req, {
      contact: contact.id,
      booking: booking.id,
      kind: 'studio_booking_created',
      source: staff ? 'staff' : 'website',
      summary:
        booking.status === 'confirmed'
          ? 'Studio session confirmed'
          : 'Studio session awaiting approval',
      details: { status: booking.status, snapshot, noCustomerEmailSent: true },
    })
    return { booking, created: true }
  })
}
async function obsoleteMessagesAndPlans(req: PayloadRequest, booking: Booking) {
  await req.payload.update({
    collection: 'email-messages',
    req,
    overrideAccess: false,
    where: {
      and: [
        { booking: { equals: booking.id } },
        { kind: { equals: 'customer_draft' } },
        { status: { equals: 'draft' } },
      ],
    },
    data: { status: 'disabled', failureCode: 'superseded_booking_change' },
  })
  const plans = await req.payload.find({
    collection: 'follow-ups',
    req,
    overrideAccess: false,
    pagination: false,
    depth: 0,
    where: {
      and: [
        { booking: { equals: booking.id } },
        { state: { in: ['planned', 'blocked', 'paused', 'failed'] } },
      ],
    },
  })
  for (const plan of plans.docs) {
    if (plan.jobID) await req.payload.jobs.cancelByID({ id: plan.jobID, req, overrideAccess: true })
    await req.payload.update({
      collection: 'follow-ups',
      id: plan.id,
      req,
      overrideAccess: false,
      data: {
        state: 'cancelled',
        blockReason: 'session_changed',
        revision: plan.revision + 1,
        jobID: null,
      },
    })
  }
}
export async function changeStudioBooking(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  input: Record<string, unknown>,
) {
  const { key, ...values } = input
  return command(payload, user, key, values, async (req) => {
    const id = idInput(values.booking)
    const initial = await payload.findByID({
      collection: 'bookings',
      id,
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (initial.source !== 'studio_slot') throw new APIError('Choose a studio session.', 422)
    await lockStudioDays(req, [
      idInput(initial.studioDay),
      ...(values.action === 'reschedule' ? [idInput(values.day)] : []),
    ])
    await lockRecord(req, 'bookings', id)
    const original = await payload.findByID({
      collection: 'bookings',
      id,
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (
      original.studioRevision !== values.revision ||
      relationID(original.studioDay) !== relationID(initial.studioDay)
    )
      throw new APIError('This booking changed. Reload and review the current details.', 409)
    if (!['pending_approval', 'confirmed'].includes(original.status))
      throw new APIError('This booking is already closed.', 409)
    const reason = textInput(values.reason, 'Reason for this change', 10, 2000)
    let data: Partial<Booking> = {}
    if (values.action === 'approve') {
      if (original.status !== 'pending_approval' || Date.parse(original.sessionAt!) <= Date.now())
        throw new APIError('Only a future pending session can be approved.', 409)
      data.status = 'confirmed'
    } else if (values.action === 'cancel') data.status = 'cancelled'
    else if (values.action === 'reschedule') {
      if (values.conditionsAccepted !== true)
        throw new APIError(
          'Confirm the customer agreed to the replacement details and conditions.',
          422,
        )
      const { day, slot, snapshot, seat } = await currentSlot(
        req,
        idInput(values.day),
        idInput(values.slot),
        idInput(values.scheduleRevision),
        id,
      )
      data = committedFields(day, slot, snapshot, seat)
    } else throw new APIError('Choose approval, cancellation or rescheduling.', 422)
    // Serialize cancellation/replacement with an in-flight follow-up simulation.
    await lockConversation(req, idInput(original.contact))
    await obsoleteMessagesAndPlans(req, original)
    const booking = await payload.update({
      collection: 'bookings',
      id,
      req,
      overrideAccess: false,
      depth: 0,
      data: {
        ...data,
        studioRevision: original.studioRevision! + 1,
        studioMessageState: 'pending',
      },
    })
    await activity(req, {
      contact: idInput(booking.contact),
      booking: id,
      kind: 'studio_booking_changed',
      source: 'staff',
      summary:
        values.action === 'reschedule'
          ? 'Studio session rescheduled'
          : `Studio session ${booking.status === 'confirmed' ? 'approved' : 'cancelled'}`,
      details: {
        reason,
        previousStatus: original.status,
        status: booking.status,
        previousSnapshot: original.studioSnapshot,
        snapshot: booking.studioSnapshot,
      },
    })
    return { id: booking.id, revision: booking.studioRevision }
  })
}
