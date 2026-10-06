import { createHash } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import type { FollowUp } from '../payload-types'
import {
  activity,
  command,
  dateInput,
  idInput,
  internalTransaction,
  object,
  relationID,
  textInput,
  transactionDB,
} from '../customer-records/core'
import { renderEmail } from '../customer-records/email-renderer'
import { editableStates, plannedInstant, purposes, validTimeZone } from './domain'
import { eligibility } from './eligibility'

export const followUpQueue = 'follow-up-simulations'
export async function lockConversation(req: PayloadRequest, contact: number) {
  const db = await transactionDB(req)
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`followups:contact:${contact}`}, 0))`,
  )
}
async function readPlan(req: PayloadRequest, id: number) {
  return req.payload.findByID({
    collection: 'follow-ups',
    id,
    req,
    overrideAccess: false,
    depth: 0,
  })
}
async function savePlan(req: PayloadRequest, id: number, data: Partial<FollowUp>) {
  return req.payload.update({
    collection: 'follow-ups',
    id,
    req,
    overrideAccess: false,
    depth: 0,
    data,
  })
}
async function planActivity(req: PayloadRequest, plan: FollowUp, summary: string) {
  await activity(req, {
    contact: idInput(plan.contact),
    enquiry: relationID(plan.enquiry),
    booking: plan.booking ? idInput(plan.booking) : undefined,
    kind: 'followup_updated',
    summary,
    source: req.user ? 'staff' : 'system',
    details: {
      snapshot: {
        subject: plan.subject,
        text: plan.text,
        recipient: plan.recipient,
        plannedAt: plan.plannedAt,
        timeZone: plan.timeZone,
      },
      followUp: plan.id,
      revision: plan.revision,
      state: plan.state,
      reason: plan.blockReason || null,
    },
  })
}
async function queuePlan(req: PayloadRequest, plan: FollowUp) {
  const job = await req.payload.jobs.queue({
    task: 'simulateFollowUp',
    queue: followUpQueue,
    input: { plan: plan.id, revision: plan.revision },
    waitUntil: new Date(plan.plannedAt),
    req,
    overrideAccess: true, // Only validated server commands reach this trusted queue.
  })
  return savePlan(req, plan.id, { jobID: Number(job.id) })
}
async function cancelJob(req: PayloadRequest, plan: FollowUp) {
  if (plan.jobID) await req.payload.jobs.cancelByID({ id: plan.jobID, req, overrideAccess: true })
}

export async function renderPlan(req: PayloadRequest, input: Record<string, unknown>) {
  const booking = input.booking
    ? await req.payload.findByID({
        collection: 'bookings',
        id: idInput(input.booking),
        req,
        overrideAccess: false,
        depth: 0,
      })
    : undefined
  const enquiryID = relationID(input.enquiry) || relationID(booking?.enquiry)
  const enquiry = enquiryID
    ? await req.payload.findByID({
        collection: 'enquiries',
        id: enquiryID,
        req,
        overrideAccess: false,
        depth: 0,
      })
    : undefined
  if (!enquiry && booking?.source !== 'studio_slot')
    throw new APIError('Choose an enquiry or studio booking.', 422)
  const contact = await req.payload.findByID({
    collection: 'contacts',
    id: idInput(enquiry?.contact || booking?.contact),
    req,
    overrideAccess: false,
    depth: 0,
  })
  if (
    booking &&
    (relationID(booking.enquiry) !== enquiry?.id || idInput(booking.contact) !== contact.id)
  )
    throw new APIError('Choose a booking from this enquiry and customer.', 422)
  if (input.purpose === 'enquiry_followup' && !enquiry)
    throw new APIError('An enquiry follow-up needs an enquiry.', 422)
  const purpose = input.purpose
  if (!purposes.includes(purpose as (typeof purposes)[number]))
    throw new APIError('Choose a follow-up purpose.', 422)
  if (purpose !== 'enquiry_followup' && (!booking || booking.status !== 'confirmed'))
    throw new APIError('Choose a confirmed session before planning a session message.', 422)
  const template = await req.payload.findByID({
    collection: 'email-templates',
    id: idInput(input.template),
    req,
    overrideAccess: false,
    depth: 0,
  })
  if (!template.approved)
    throw new APIError('Review and approve the template before using it.', 422)
  try {
    const timeZone = validTimeZone(textInput(input.timeZone, 'Timezone', 1, 80))
    const plannedAt =
      typeof input.plannedAt === 'string'
        ? dateInput(input.plannedAt)
        : plannedInstant(
            String(input.localTime || ''),
            timeZone,
            typeof input.offset === 'number' ? input.offset : undefined,
          )
    if (Math.abs(new Date(plannedAt).getTime() - Date.now()) > 3 * 366 * 86400000)
      throw new Error('Choose a planned time within three years of today.')
    const subject =
      input.subject === undefined ? template.subject : textInput(input.subject, 'Subject', 1, 200)
    const body =
      input.body === undefined ? template.body : textInput(input.body, 'Message', 1, 12000)
    const rendered = renderEmail(subject, body, {
      contact_name: contact.name,
      service_title: enquiry?.serviceTitle || booking!.title,
      studio_name: 'Studio Lunia',
      ...(booking
        ? {
            booking_status: booking.status,
            session_time: booking.sessionAt
              ? new Intl.DateTimeFormat('en-GB', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                  timeZone,
                }).format(new Date(booking.sessionAt))
              : undefined,
            expected_value: new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: booking.currency,
            }).format(
              booking.expectedMinor /
                10 **
                  (new Intl.NumberFormat('en-GB', {
                    style: 'currency',
                    currency: booking.currency,
                  }).resolvedOptions().maximumFractionDigits ?? 2),
            ),
          }
        : {}),
    })
    const result = {
      contact: contact.id,
      enquiry: enquiry?.id,
      booking: booking?.id,
      template: template.id,
      purpose: purpose as (typeof purposes)[number],
      timeZone,
      plannedAt,
      sessionSnapshot: booking?.sessionAt,
      recipient: contact.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      templateSnapshot: {
        name: template.name,
        subject,
        body,
        approved: true,
        updatedAt: template.updatedAt,
      },
    }
    return {
      ...result,
      previewToken: createHash('sha256').update(JSON.stringify(result)).digest('hex'),
    }
  } catch (error) {
    throw new APIError(error instanceof Error ? error.message : 'Check the planned message.', 422)
  }
}

export async function createPlan(
  req: PayloadRequest,
  input: Record<string, unknown>,
  triggerKey: string,
  triggeredAt = new Date().toISOString(),
  reviewed = false,
) {
  const { previewToken, ...rendered } = await renderPlan(req, input)
  if (reviewed && input.previewToken !== previewToken)
    throw new APIError(
      'The planned message changed. Review the exact preview again before saving.',
      409,
    )
  await lockConversation(req, rendered.contact)
  const existing = await req.payload.find({
    collection: 'follow-ups',
    req,
    overrideAccess: false,
    where: { triggerKey: { equals: triggerKey } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs[0]) return existing.docs[0]
  if (input.rule) {
    const rule = await req.payload.findByID({
      collection: 'follow-up-rules',
      id: idInput(input.rule),
      req,
      overrideAccess: false,
      depth: 0,
    })
    Object.assign(rendered.templateSnapshot, { ruleRevision: rule.revision })
  }
  let plan = await req.payload.create({
    collection: 'follow-ups',
    req,
    overrideAccess: false,
    depth: 0,
    data: {
      ...rendered,
      triggerKey,
      triggeredAt,
      revision: 1,
      state: 'planned',
      attempts: 0,
      ...(input.rule ? { rule: idInput(input.rule) } : {}),
    },
  })
  const reason = await eligibility(req, plan)
  if (reason) plan = await savePlan(req, plan.id, { state: 'blocked', blockReason: reason })
  plan = await queuePlan(req, plan)
  await planActivity(
    req,
    plan,
    'Follow-up plan saved for simulation; no email scheduled for delivery',
  )
  return plan
}

export async function followUpOperation(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  input: Record<string, unknown>,
) {
  const { key, ...values } = input
  if ('mode' in values || 'live' in values)
    throw new APIError('Only simulated follow-up execution is available.', 422)
  return command(payload, user, key, values, async (req) => {
    if (values.action === 'stopFollowUps') {
      const id = idInput(values.contact)
      await lockConversation(req, id)
      if (typeof values.stopped !== 'boolean')
        throw new APIError('Choose whether follow-ups are stopped.', 422)
      const contact = await payload.update({
        collection: 'contacts',
        id,
        req,
        overrideAccess: false,
        data: { followUpsStopped: values.stopped },
      })
      return { id: contact.id, stopped: contact.followUpsStopped }
    }
    if (values.action === 'simulateReply') {
      const contact = idInput(values.contact)
      await lockConversation(req, contact)
      await payload.findByID({ collection: 'contacts', id: contact, req, overrideAccess: false })
      const enquiry = values.enquiry ? idInput(values.enquiry) : undefined
      if (enquiry) {
        const lead = await payload.findByID({
          collection: 'enquiries',
          id: enquiry,
          req,
          overrideAccess: false,
          depth: 0,
        })
        if (idInput(lead.contact) !== contact)
          throw new APIError('Select an enquiry from this customer.', 422)
      }
      const text = textInput(values.text, 'Simulated reply', 10, 3000)
      const reply = await payload.create({
        collection: 'incoming-replies',
        req,
        overrideAccess: false,
        data: {
          eventKey: `simulation:${String(key)}`,
          summary: 'Simulated incoming reply',
          contact,
          enquiry,
          source: 'simulation',
          state: 'matched',
          occurredAt: new Date().toISOString(),
          text,
        },
      })
      await activity(req, {
        contact,
        enquiry,
        kind: 'reply_simulated',
        summary: 'Simulated incoming reply; no real mailbox connected',
        source: 'staff',
        details: { note: text, reply: reply.id, provenance: 'simulation' },
      })
      return { id: reply.id }
    }
    if (values.action === 'createFollowUp') {
      const plan = await createPlan(
        req,
        { ...values, rule: undefined },
        `manual:${String(key)}`,
        undefined,
        true,
      )
      return { id: plan.id, state: plan.state }
    }
    let plan = await readPlan(req, idInput(values.plan))
    await lockConversation(req, idInput(plan.contact))
    plan = await readPlan(req, plan.id)
    if (values.revision !== plan.revision)
      throw new APIError('This plan changed. Reload it before trying again.', 409)
    if (!editableStates.includes(plan.state))
      throw new APIError(
        'This plan already finished or was cancelled. Create a new plan if needed.',
        409,
      )
    if (
      !['editFollowUp', 'pauseFollowUp', 'cancelFollowUp', 'resumeFollowUp'].includes(
        String(values.action),
      )
    )
      throw new APIError('Unknown follow-up action.', 400)
    await cancelJob(req, plan)
    const revision = plan.revision + 1
    if (values.action === 'cancelFollowUp' || values.action === 'pauseFollowUp') {
      plan = await savePlan(req, plan.id, {
        revision,
        state: values.action === 'cancelFollowUp' ? 'cancelled' : 'paused',
        jobID: null,
      })
    } else {
      const data =
        values.action === 'editFollowUp'
          ? await renderPlan(req, {
              ...values,
              enquiry: relationID(plan.enquiry),
              booking: plan.booking ? idInput(plan.booking) : undefined,
            })
          : {}
      if (
        values.action === 'editFollowUp' &&
        'previewToken' in data &&
        values.previewToken !== data.previewToken
      )
        throw new APIError(
          'The planned message changed. Review the exact preview again before saving.',
          409,
        )
      if (plan.rule && 'templateSnapshot' in data)
        Object.assign(object(data.templateSnapshot), {
          ruleRevision: object(plan.templateSnapshot).ruleRevision,
        })
      plan = await savePlan(req, plan.id, {
        ...data,
        revision,
        state: 'planned',
        attempts: 0,
        blockReason: null,
        lastError: null,
      })
      const reason = await eligibility(req, plan)
      if (reason) plan = await savePlan(req, plan.id, { state: 'blocked', blockReason: reason })
      plan = await queuePlan(req, plan)
    }
    await planActivity(req, plan, `Follow-up plan ${plan.state}; no email sent`)
    return { id: plan.id, state: plan.state }
  })
}

export async function simulateFollowUp(
  payload: Payload,
  id: number,
  revision: number,
  handoff: (plan: FollowUp, key: string) => Promise<void> = async () => {},
) {
  // The production handler uses the no-network simulation above. A transport is injected only by isolated tests.
  try {
    return await internalTransaction(payload, async (req) => {
      let plan = await readPlan(req, id)
      await lockConversation(req, idInput(plan.contact))
      plan = await readPlan(req, id)
      if (plan.revision !== revision || !['planned', 'blocked', 'failed'].includes(plan.state))
        return { state: 'obsolete' }
      if (plan.attempts >= 3) return { state: 'failed' }
      if (new Date(plan.plannedAt).getTime() > Date.now()) return { state: 'not_due' }
      const reason = await eligibility(req, plan)
      if (reason) {
        plan = await savePlan(req, id, { state: 'blocked', blockReason: reason })
        await planActivity(req, plan, 'Follow-up simulation blocked')
        return { state: 'blocked' }
      }
      const outcomeKey = `lunia-followup-${id}-revision-${revision}`
      await handoff(plan, outcomeKey)
      plan = await savePlan(req, id, {
        state: 'simulated',
        blockReason: null,
        outcomeKey,
        attempts: plan.attempts + 1,
        simulatedAt: new Date().toISOString(),
        lastError: null,
      })
      await planActivity(req, plan, 'Follow-up simulation completed; no email sent')
      return { state: 'simulated' }
    })
  } catch {
    await internalTransaction(payload, async (req) => {
      let plan = await readPlan(req, id)
      await lockConversation(req, idInput(plan.contact))
      plan = await readPlan(req, id)
      if (plan.revision !== revision || !['planned', 'failed'].includes(plan.state)) return
      await savePlan(req, id, {
        state: 'failed',
        attempts: plan.attempts + 1,
        lastError:
          'Simulation could not complete. Review the plan before retrying. No email was sent.',
      })
    })
    throw new Error('Follow-up simulation failed; no email was sent.')
  }
}
