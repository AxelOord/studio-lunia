import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'
import type { CustomerActivity } from '../payload-types'
import { idInput, object, relationID } from '../customer-records/core'
import { deliveryEvents } from '../customer-records/webhook'
import { eligibility } from './eligibility'
import { createPlan, lockConversation } from './operations'

async function refreshPlans(req: PayloadRequest, event: CustomerActivity) {
  const contact = idInput(event.contact)
  // Relinking an enquiry must also invalidate plans belonging to its previous contact.
  const previous = relationID(event.details && object(event.details).previousContact)
  for (const id of [...new Set([contact, ...(previous ? [previous] : [])])].sort((a, b) => a - b))
    await lockConversation(req, id)
  const plans = await req.payload.find({
    collection: 'follow-ups',
    req,
    overrideAccess: false,
    depth: 0,
    pagination: false,
    where: {
      and: [
        {
          or: [
            { contact: { equals: contact } },
            ...(event.enquiry ? [{ enquiry: { equals: idInput(event.enquiry) } }] : []),
          ],
        },
        { state: { in: ['planned', 'blocked', 'paused', 'failed'] } },
      ],
    },
  })
  for (const plan of plans.docs) {
    const reason = await eligibility(req, plan)
    if (
      !reason ||
      reason === 'reply_detection_unavailable' ||
      (plan.state === 'blocked' && plan.blockReason === reason)
    )
      continue
    if (plan.jobID) await req.payload.jobs.cancelByID({ id: plan.jobID, req, overrideAccess: true })
    await req.payload.update({
      collection: 'follow-ups',
      id: plan.id,
      req,
      overrideAccess: false,
      data: { state: 'blocked', blockReason: reason, revision: plan.revision + 1, jobID: null },
    })
  }
}

async function applyRules(req: PayloadRequest, event: CustomerActivity) {
  if (!event.booking || !['booking_proposed', 'booking_changed'].includes(event.kind)) return
  const booking = await req.payload.findByID({
    collection: 'bookings',
    id: idInput(event.booking),
    req,
    overrideAccess: false,
    depth: 0,
  })
  if (!['proposed', 'confirmed'].includes(booking.status)) return
  const rules = await req.payload.find({
    collection: 'follow-up-rules',
    req,
    overrideAccess: false,
    depth: 0,
    pagination: false,
    where: { approvedForTests: { equals: true } },
  })
  for (const rule of rules.docs) {
    const enquiryFollowup = rule.purpose === 'enquiry_followup'
    if (
      enquiryFollowup
        ? event.kind !== 'booking_proposed'
        : booking.status !== 'confirmed' || !booking.sessionAt
    )
      continue
    const template = await req.payload.findByID({
      collection: 'email-templates',
      id: idInput(rule.template),
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (!template.approved) continue
    const anchor = enquiryFollowup ? booking.createdAt : booking.sessionAt!
    const plannedAt = new Date(
      new Date(anchor).getTime() + (enquiryFollowup ? 1 : -1) * rule.hours * 3600000,
    ).toISOString()
    const plan = await createPlan(
      req,
      {
        enquiry: idInput(booking.enquiry),
        booking: booking.id,
        template: template.id,
        rule: rule.id,
        purpose: rule.purpose,
        timeZone: rule.timeZone,
        plannedAt,
      },
      `rule:${rule.id}:${rule.revision}:booking:${booking.id}:${anchor}`,
      event.createdAt,
    )
    if (
      !enquiryFollowup &&
      new Date(plannedAt).getTime() <= Date.now() &&
      plan.state === 'planned'
    ) {
      if (plan.jobID)
        await req.payload.jobs.cancelByID({ id: plan.jobID, req, overrideAccess: true })
      await req.payload.update({
        collection: 'follow-ups',
        id: plan.id,
        req,
        overrideAccess: false,
        data: {
          state: 'blocked',
          blockReason: 'late_reminder',
          revision: plan.revision + 1,
          jobID: null,
        },
      })
    }
  }
}

export const updateFollowUps: CollectionAfterChangeHook<CustomerActivity> = async ({
  doc,
  operation,
  req,
}) => {
  if (
    operation !== 'create' ||
    ![
      'reply_reported',
      'reply_received',
      'reply_simulated',
      'booking_proposed',
      'booking_changed',
      'enquiry_updated',
      'contact_corrected',
      'email_status',
      ...deliveryEvents,
    ].includes(doc.kind)
  )
    return doc
  await refreshPlans(req, doc)
  await applyRules(req, doc)
  return doc
}
