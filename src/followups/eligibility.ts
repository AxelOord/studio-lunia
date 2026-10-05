import type { PayloadRequest } from 'payload'
import type { FollowUp } from '../payload-types'
import { idInput, object } from '../customer-records/core'

export async function eligibility(req: PayloadRequest, plan: FollowUp) {
  const payload = req.payload
  const contact = await payload.findByID({
    collection: 'contacts',
    id: idInput(plan.contact),
    req,
    overrideAccess: false,
    depth: 0,
  })
  const enquiry = await payload.findByID({
    collection: 'enquiries',
    id: idInput(plan.enquiry),
    req,
    overrideAccess: false,
    depth: 0,
  })
  if (idInput(enquiry.contact) !== contact.id) return 'contact_changed'
  if (contact.followUpsStopped) return 'contact_stopped'
  if (contact.email !== plan.recipient) return 'recipient_changed'
  if (enquiry.followUp === 'closed') return 'enquiry_closed'
  if (plan.rule) {
    const rule = await payload.findByID({
      collection: 'follow-up-rules',
      id: idInput(plan.rule),
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (!rule.approvedForTests || object(plan.templateSnapshot).ruleRevision !== rule.revision)
      return 'rule_changed'
  }
  const replies = await payload.find({
    collection: 'customer-activities',
    req,
    overrideAccess: false,
    depth: 0,
    limit: 1,
    where: {
      and: [
        { contact: { equals: contact.id } },
        { kind: { in: ['reply_reported', 'reply_received', 'reply_simulated'] } },
        { createdAt: { greater_than_equal: plan.triggeredAt } },
      ],
    },
  })
  if (replies.totalDocs) return 'reply_received'
  const failures = await payload.find({
    collection: 'email-messages',
    req,
    overrideAccess: false,
    depth: 0,
    limit: 1,
    where: {
      and: [
        { enquiry: { equals: enquiry.id } },
        { kind: { not_equals: 'photographer_notification' } },
        { status: { in: ['failed', 'uncertain', 'manual', 'bounced', 'delayed'] } },
      ],
    },
  })
  if (failures.totalDocs) return 'delivery_problem'
  if (plan.purpose === 'enquiry_followup' && plan.booking) {
    const source = await payload.findByID({
      collection: 'bookings',
      id: idInput(plan.booking),
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (source.status === 'cancelled') return 'booking_cancelled'
  }
  if (plan.purpose === 'enquiry_followup') {
    const bookings = await payload.find({
      collection: 'bookings',
      req,
      overrideAccess: false,
      depth: 0,
      limit: 1,
      where: {
        and: [{ enquiry: { equals: enquiry.id } }, { status: { in: ['confirmed', 'completed'] } }],
      },
    })
    if (bookings.totalDocs) return 'booked'
    // A manual note or simulated reply never establishes reliable real reply detection.
    return 'reply_detection_unavailable'
  }
  if (!plan.booking) return 'session_unconfirmed'
  const booking = await payload.findByID({
    collection: 'bookings',
    id: idInput(plan.booking),
    req,
    overrideAccess: false,
    depth: 0,
  })
  if (booking.status !== 'confirmed' || !booking.sessionAt) return 'session_unconfirmed'
  if (idInput(booking.contact) !== contact.id || idInput(booking.enquiry) !== enquiry.id)
    return 'contact_changed'
  if (booking.sessionAt !== plan.sessionSnapshot) return 'session_changed'
  if (new Date(booking.sessionAt).getTime() <= Date.now()) return 'session_passed'
  return undefined
}
