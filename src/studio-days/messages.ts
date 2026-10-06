import type { Payload } from 'payload'
import {
  activity,
  idInput,
  internalTransaction,
  lockRecord,
  object,
} from '../customer-records/core'
import { renderEmail } from '../customer-records/email-renderer'
import { studioPrice, studioTime, type StudioSnapshot } from './domain'

// This function only freezes private drafts. It has no provider transport or sender credentials.
export async function prepareStudioMessages(payload: Payload, id: number) {
  let revision: number | undefined
  try {
    return await internalTransaction(payload, async (req) => {
      await lockRecord(req, 'bookings', id)
      const booking = await payload.findByID({
        collection: 'bookings',
        id,
        req,
        overrideAccess: false,
        depth: 0,
      })
      if (booking.source !== 'studio_slot' || booking.studioMessageState === 'ready') return
      revision = booking.studioRevision!
      const contact = await payload.findByID({
        collection: 'contacts',
        id: idInput(booking.contact),
        req,
        overrideAccess: false,
        depth: 0,
      })
      const snapshot = object(booking.studioSnapshot) as StudioSnapshot
      const status =
        booking.status === 'pending_approval'
          ? 'Awaiting photographer approval'
          : booking.status === 'cancelled'
            ? 'Cancelled'
            : 'Confirmed'
      const body = [
        'PRIVATE TEST DRAFT — no visitor email has been sent.',
        `Session: ${snapshot.offerTitle}\nStatus: ${status}\nReference: ${booking.studioSubmissionHash!.slice(0, 12).toUpperCase()}`,
        `Time: ${studioTime(snapshot.startsAt, snapshot.timeZone)}\nTimezone: ${snapshot.timeZone}\nLocation: ${snapshot.location}\nDuration: ${snapshot.durationMinutes} minutes\nSession price: ${studioPrice(snapshot.priceMinor, snapshot.currency)}`,
        `Included: ${snapshot.inclusions}`,
        `Agreed change and cancellation conditions: ${snapshot.changePolicy}`,
        booking.status === 'pending_approval'
          ? 'A place is allocated while the photographer reviews the request. It remains allocated until approval or cancellation.'
          : '',
        'This prototype takes no payment. This message is a private test draft for staff review.',
      ]
        .filter(Boolean)
        .join('\n\n')
      const rendered = renderEmail(`Studio session — ${status}`, body, {})
      await payload.create({
        collection: 'email-messages',
        req,
        overrideAccess: false,
        data: {
          contact: contact.id,
          booking: id,
          kind: 'customer_draft',
          status: 'draft',
          recipient: contact.email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          variables: {},
          attempts: 0,
          idempotencyKey: `studio-booking:${id}:${revision}`,
          templateSnapshot: {
            kind: 'studio_facts_test_draft',
            revision,
            status: booking.status,
            snapshot,
          },
        },
      })
      // Rule planning runs after the reservation commit, in this recoverable transaction.
      await activity(req, {
        contact: contact.id,
        booking: id,
        kind: 'booking_changed',
        source: 'system',
        summary: 'Studio session test draft prepared; no customer email sent',
        details: { revision, studioMessagePrepared: true },
      })
      await payload.update({
        collection: 'bookings',
        id,
        req,
        overrideAccess: false,
        data: { studioMessageState: 'ready' },
      })
    })
  } catch {
    // The reservation is already durable. A stale failed attempt cannot overwrite a newer revision.
    await internalTransaction(payload, async (req) => {
      await lockRecord(req, 'bookings', id)
      const booking = await payload.findByID({
        collection: 'bookings',
        id,
        req,
        overrideAccess: false,
        depth: 0,
      })
      if (booking.studioRevision === revision && booking.studioMessageState !== 'ready')
        await payload.update({
          collection: 'bookings',
          id,
          req,
          overrideAccess: false,
          data: { studioMessageState: 'failed' },
        })
    })
  }
}
