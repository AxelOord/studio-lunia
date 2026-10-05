import { sql } from '@payloadcms/db-postgres'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import {
  activity,
  command,
  dateInput,
  idInput,
  lockRecord,
  moneyInput,
  relationID,
  textInput,
  transactionDB,
} from './core'

export async function recordOperation(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  input: Record<string, unknown>,
) {
  const { key, ...values } = input
  return command(payload, user, key, values, async (req) => {
    if (values.action === 'proposeBooking') {
      const enquiryID = idInput(values.enquiry)
      await lockRecord(req, 'enquiries', enquiryID)
      const enquiry = await payload.findByID({
        collection: 'enquiries',
        id: enquiryID,
        req,
        overrideAccess: false,
        depth: 0,
      })
      const contact = relationID(enquiry.contact)
      if (!contact) throw new APIError('Link this enquiry to a contact first.', 422)
      const currency = textInput(values.currency, 'Currency', 3, 3).toUpperCase()
      if (!/^[A-Z]{3}$/.test(currency)) throw new APIError('Use a three-letter currency code.', 422)
      const booking = await payload.create({
        collection: 'bookings',
        req,
        overrideAccess: false,
        depth: 0,
        data: {
          title: enquiry.serviceTitle,
          contact,
          enquiry: enquiry.id,
          source: 'staff_enquiry',
          status: 'proposed',
          sessionAt: values.sessionAt ? dateInput(values.sessionAt) : undefined,
          expectedMinor: moneyInput(values.expectedMinor),
          currency,
          attribution: enquiry.attribution,
        },
      })
      await activity(req, {
        contact,
        enquiry: enquiry.id,
        booking: booking.id,
        kind: 'booking_proposed',
        summary: 'Booking proposal recorded',
        source: 'staff',
        details: { status: 'proposed', expectedMinor: booking.expectedMinor, currency },
      })
      return { id: booking.id, collection: 'bookings' }
    }
    if (values.action === 'changeBooking') {
      const id = idInput(values.booking)
      await lockRecord(req, 'bookings', id)
      const original = await payload.findByID({
        collection: 'bookings',
        id,
        req,
        overrideAccess: false,
        depth: 0,
      })
      const reason = textInput(values.reason, 'Reason for this change', 10, 2000)
      const status = values.status
      if (!['proposed', 'confirmed', 'completed', 'cancelled'].includes(String(status)))
        throw new APIError('Select a valid booking status.', 422)
      const sessionAt = values.sessionAt ? dateInput(values.sessionAt) : original.sessionAt
      if (['confirmed', 'completed'].includes(String(status)) && !sessionAt)
        throw new APIError('Record the session date before confirming.', 422)
      const expectedMinor = moneyInput(values.expectedMinor)
      const booking = await payload.update({
        collection: 'bookings',
        id,
        req,
        overrideAccess: false,
        depth: 0,
        data: {
          status: status as 'proposed' | 'confirmed' | 'completed' | 'cancelled',
          expectedMinor,
          sessionAt,
        },
      })
      await activity(req, {
        contact: idInput(booking.contact),
        enquiry: idInput(booking.enquiry),
        booking: id,
        kind: 'booking_changed',
        summary: `Booking ${booking.status}`,
        source: 'staff',
        details: {
          reason,
          previousStatus: original.status,
          status: booking.status,
          previousExpectedMinor: original.expectedMinor,
          expectedMinor,
          previousSessionAt: original.sessionAt || null,
          sessionAt: sessionAt || null,
        },
      })
      return { id, collection: 'bookings' }
    }
    if (values.action === 'recordMoney' || values.action === 'correctMoney') {
      const id = idInput(values.booking)
      await lockRecord(req, 'bookings', id)
      const booking = await payload.findByID({
        collection: 'bookings',
        id,
        req,
        overrideAccess: false,
        depth: 0,
      })
      const kind = values.kind
      if (kind !== 'payment' && kind !== 'refund')
        throw new APIError('Select payment or refund.', 422)
      const amountMinor = moneyInput(values.amountMinor, true) * (kind === 'refund' ? -1 : 1)
      const reason = textInput(values.reason, 'Record or correction reason', 10, 2000)
      const occurredAt = dateInput(values.occurredAt)
      if (new Date(occurredAt).getTime() > Date.now() + 60_000)
        throw new APIError('A realised payment cannot have a future date.', 422)
      const db = await transactionDB(req)
      const total = await db.execute(
        sql`SELECT coalesce(sum(amount_minor), 0)::bigint AS total FROM revenue_entries WHERE booking_id = ${id}`,
      )
      let reversal = 0
      if (values.action === 'correctMoney') {
        const original = await payload.findByID({
          collection: 'revenue-entries',
          id: idInput(values.entry),
          req,
          overrideAccess: false,
          depth: 0,
        })
        if (relationID(original.booking) !== id || original.kind === 'reversal')
          throw new APIError('Select an original entry for this booking.', 422)
        const reversed = await payload.count({
          collection: 'revenue-entries',
          where: { reverses: { equals: original.id } },
          req,
          overrideAccess: false,
        })
        if (reversed.totalDocs) throw new APIError('This entry was already corrected.', 409)
        reversal = -original.amountMinor
        await payload.create({
          collection: 'revenue-entries',
          req,
          overrideAccess: false,
          data: {
            label: 'Correction reversal',
            booking: id,
            contact: idInput(booking.contact),
            kind: 'reversal',
            amountMinor: reversal,
            currency: booking.currency,
            reverses: original.id,
            occurredAt: new Date().toISOString(),
            reason,
            actor: user.id,
          },
        })
      }
      if (Number(total.rows[0].total) + reversal + amountMinor < 0)
        throw new APIError('Refunds cannot exceed the net recorded payments.', 422)
      const entry = await payload.create({
        collection: 'revenue-entries',
        req,
        overrideAccess: false,
        data: {
          label: values.action === 'correctMoney' ? `Corrected ${kind}` : `Manual ${kind}`,
          booking: id,
          contact: idInput(booking.contact),
          kind,
          amountMinor,
          currency: booking.currency,
          occurredAt,
          reason,
          actor: user.id,
        },
      })
      await activity(req, {
        contact: idInput(booking.contact),
        enquiry: idInput(booking.enquiry),
        booking: id,
        kind: 'revenue_recorded',
        summary:
          values.action === 'correctMoney'
            ? 'Money record corrected with reversal and replacement'
            : `Manual ${kind} recorded`,
        source: 'staff',
        occurredAt,
        details: {
          entry: entry.id,
          amountMinor,
          reversalMinor: reversal,
          currency: booking.currency,
          reason,
        },
      })
      return { id: entry.id, collection: 'revenue-entries' }
    }
    if (values.action === 'recordReply') {
      const contact = await payload.findByID({
        collection: 'contacts',
        id: idInput(values.contact),
        req,
        overrideAccess: false,
        depth: 0,
      })
      const note = textInput(values.note, 'Known reply note', 10, 2000)
      const occurredAt = dateInput(values.occurredAt)
      if (new Date(occurredAt).getTime() > Date.now() + 60_000)
        throw new APIError('A known reply cannot have a future date.', 422)
      const event = await activity(req, {
        contact: contact.id,
        kind: 'reply_reported',
        summary: 'Known reply recorded by staff',
        source: 'staff',
        occurredAt,
        details: { note, completeness: 'Manual note; external mailbox not imported' },
      })
      return { id: event.id, collection: 'customer-activities' }
    }
    throw new APIError('Unknown customer-record action.', 400)
  })
}
