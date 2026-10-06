import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import {
  activity,
  command,
  idInput,
  relationID,
  internalTransaction,
  lockRecord,
  transactionDB,
} from './core'
import {
  notificationTemplate,
  renderEmail,
  syntheticEmailVariables,
  type EmailVariables,
} from './email-renderer'
import { deliveryState, type DeliveryFact, type DeliveryKind } from './webhook'

type MessageRow = {
  id: number
  contact_id: number
  enquiry_id: number | null
  booking_id: number | null
  kind: string
  status: string
  attempts: number
  first_attempt_at: Date | null
  last_attempt_at: Date | null
  idempotency_key: string
  provider_id: string | null
  recipient: string
  provider_payload: Record<string, unknown> | null
}
const safeRecipient = () => process.env.PREVIEW_EDITOR_EMAIL || 'synthetic-local@example.test'
function providerPayload(
  key: string,
  recipient: string,
  rendered: ReturnType<typeof renderEmail>,
  plain = false,
) {
  return {
    from: process.env.MAIL_FROM || 'Synthetic local <synthetic-local@example.test>',
    to: recipient,
    subject: rendered.subject,
    text: rendered.text,
    ...(plain ? {} : { html: rendered.html }),
    tags: [{ name: 'lunia_message', value: key }],
  }
}
export async function prepareEmail(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  input: Record<string, unknown>,
) {
  const { key, ...values } = input
  return command(payload, user, key, values, async (req) => {
    const template = await payload.findByID({
      collection: 'email-templates',
      id: idInput(values.template),
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (!template.approved)
      throw new APIError('Approve the template wording before preparing a message.', 422)
    const booking = values.booking
      ? await payload.findByID({
          collection: 'bookings',
          id: idInput(values.booking),
          req,
          overrideAccess: false,
          depth: 0,
        })
      : undefined
    const enquiryID = booking ? relationID(booking.enquiry) : idInput(values.enquiry)
    const enquiry = enquiryID
      ? await payload.findByID({
          collection: 'enquiries',
          id: enquiryID,
          req,
          overrideAccess: false,
          depth: 0,
        })
      : undefined
    const contact = await payload.findByID({
      collection: 'contacts',
      id: booking ? idInput(booking.contact) : idInput(enquiry?.contact),
      req,
      overrideAccess: false,
      depth: 0,
    })
    const test = values.action === 'prepareTestEmail'
    if (values.action !== 'prepareEmail' && !test) throw new APIError('Unknown email action.', 400)
    const variables: EmailVariables = test
      ? syntheticEmailVariables
      : {
          contact_name: contact.name,
          service_title: enquiry?.serviceTitle || booking!.title,
          studio_name: 'Studio Lunia',
          ...(booking
            ? {
                booking_status: booking.status,
                session_time: booking.sessionAt
                  ? new Date(booking.sessionAt).toISOString()
                  : undefined,
                expected_value: `${booking.expectedMinor} ${booking.currency} minor units`,
              }
            : {}),
        }
    let rendered: ReturnType<typeof renderEmail>
    try {
      rendered = renderEmail(template.subject, template.body, variables)
    } catch (error) {
      throw new APIError(
        error instanceof Error ? error.message : 'Template inputs are incomplete.',
        422,
      )
    }
    const recipient = test ? safeRecipient() : contact.email
    const idempotencyKey = `lunia-message-${randomUUID()}`
    const message = await payload.create({
      collection: 'email-messages',
      req,
      overrideAccess: false,
      depth: 0,
      data: {
        contact: contact.id,
        enquiry: enquiry?.id,
        booking: booking?.id,
        template: template.id,
        kind: test ? 'sandbox_test' : 'customer_draft',
        status: 'draft',
        ...rendered,
        templateSnapshot: {
          name: template.name,
          kind: template.kind,
          subject: template.subject,
          body: template.body,
          approved: true,
          updatedAt: template.updatedAt,
        },
        recipient,
        sender: test
          ? String(providerPayload(idempotencyKey, recipient, rendered).from)
          : undefined,
        providerPayload: test ? providerPayload(idempotencyKey, recipient, rendered) : undefined,
        idempotencyKey,
        attempts: 0,
      },
    })
    await activity(req, {
      contact: contact.id,
      enquiry: enquiry?.id,
      booking: booking?.id,
      emailMessage: message.id,
      kind: 'email_prepared',
      summary: test
        ? 'Synthetic sandbox test prepared; not sent'
        : 'Customer email draft prepared; not scheduled',
      source: 'staff',
    })
    return { id: message.id, collection: 'email-messages' }
  })
}
async function factsFor(req: PayloadRequest, message: number) {
  const db = await transactionDB(req)
  const facts = await db.execute(
    sql`SELECT kind, occurred_at FROM email_delivery_events WHERE message_id = ${message}`,
  )
  return facts.rows.map((row) => ({
    kind: row.kind as DeliveryKind,
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
  }))
}
async function statusActivity(req: PayloadRequest, row: MessageRow, status: string) {
  await activity(req, {
    contact: row.contact_id,
    enquiry: row.enquiry_id || undefined,
    booking: row.booking_id || undefined,
    emailMessage: row.id,
    kind: 'email_status',
    summary: `Email ${status}`,
    source: 'system',
  })
}
async function enquiryStatus(req: PayloadRequest, row: MessageRow, status: string) {
  if (row.kind !== 'photographer_notification' || !row.enquiry_id) return
  const db = await transactionDB(req)
  const compatible = ['accepted', 'delayed', 'delivered', 'bounced'].includes(status)
    ? 'accepted'
    : status === 'disabled'
      ? 'disabled'
      : status === 'manual'
        ? 'manual'
        : status === 'sending'
          ? 'sending'
          : 'failed'
  await db.execute(
    sql`UPDATE enquiries SET notification_status = ${compatible}::enum_enquiries_notification_status, notification_attempts = ${Number(row.attempts)}, notification_attempted_at = ${row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null}::timestamptz WHERE id = ${row.enquiry_id}`,
  )
}
async function claimSend(payload: Payload, id: number): Promise<MessageRow | string> {
  return internalTransaction(payload, async (req) => {
    const db = await transactionDB(req)
    const result = await db.execute(sql`SELECT * FROM email_messages WHERE id = ${id} FOR UPDATE`)
    const row = result.rows[0] as unknown as MessageRow | undefined
    if (!row) throw new APIError('Email message not found.', 404)
    if (row.kind === 'customer_draft')
      throw new APIError(
        'Real-customer sending is disabled. Prepare a synthetic sandbox test instead.',
        422,
      )
    if (!['draft', 'queued', 'failed', 'uncertain', 'sending'].includes(row.status))
      return row.status
    if (row.status === 'sending') {
      const lease = await db.execute(
        sql`SELECT id FROM email_messages WHERE id = ${id} AND last_attempt_at < now() - interval '2 minutes'`,
      )
      if (!lease.rowCount) return 'sending'
    }
    let blocked: 'disabled' | 'manual' | 'failed' | undefined
    let failure: string | undefined
    if (process.env.LUNIA_CMS_PREVIEW !== 'true') blocked = 'disabled'
    else if (
      Number(row.attempts) >= 3 ||
      (row.first_attempt_at &&
        Date.now() - new Date(row.first_attempt_at).getTime() >= 23 * 3600_000)
    ) {
      blocked = 'manual'
      failure = 'retry_window_ended'
    } else if (
      !process.env.RESEND_API_KEY ||
      !process.env.MAIL_FROM ||
      !process.env.PREVIEW_EDITOR_EMAIL ||
      row.recipient.toLowerCase() !== process.env.PREVIEW_EDITOR_EMAIL.toLowerCase() ||
      !row.provider_payload ||
      row.provider_payload.to !== row.recipient ||
      row.provider_payload.from !== process.env.MAIL_FROM
    ) {
      blocked = 'failed'
      failure = 'sandbox_configuration_mismatch'
    }
    if (blocked) {
      await db.execute(
        sql`UPDATE email_messages SET status = ${blocked}::enum_email_messages_status, failure_code = ${failure || null} WHERE id = ${id}`,
      )
      await enquiryStatus(req, row, blocked)
      await statusActivity(req, row, blocked)
      return blocked
    }
    row.attempts = Number(row.attempts) + 1
    row.last_attempt_at = new Date()
    await db.execute(
      sql`UPDATE email_messages SET status = 'sending', attempts = ${row.attempts}, first_attempt_at = coalesce(first_attempt_at, now()), last_attempt_at = ${row.last_attempt_at.toISOString()}::timestamptz, failure_code = NULL WHERE id = ${id}`,
    )
    await enquiryStatus(req, row, 'sending')
    await statusActivity(req, row, 'send attempted')
    return row
  })
}
export async function sendEmailMessage(payload: Payload, id: number, send: typeof fetch = fetch) {
  const row = await claimSend(payload, id)
  if (typeof row === 'string') return row
  let state = 'uncertain',
    providerId: string | undefined,
    failureCode = 'ambiguous_transport'
  try {
    const response = await send('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': row.idempotency_key,
      },
      body: JSON.stringify(row.provider_payload),
      signal: AbortSignal.timeout(8000),
    })
    if (response.ok) {
      const result = (await response.json()) as { id?: unknown }
      if (typeof result.id === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(result.id)) {
        providerId = result.id
        state = 'accepted'
        failureCode = ''
      } else failureCode = 'accepted_response_missing_id'
    } else if (response.status >= 400 && response.status < 500 && response.status !== 408) {
      state = 'failed'
      failureCode = 'provider_rejected'
    }
  } catch {
    /* Retrying uses the identical frozen payload and key, within the cutoff. */
  }
  return internalTransaction(payload, async (req) => {
    const db = await transactionDB(req)
    await lockRecord(req, 'email-messages', id)
    const current = await db.execute(
      sql`SELECT provider_id, status FROM email_messages WHERE id = ${id}`,
    )
    if (current.rows[0]?.provider_id && providerId && current.rows[0].provider_id !== providerId) {
      state = 'manual'
      failureCode = 'provider_identity_conflict'
      providerId = undefined
    }
    if (current.rows[0]?.provider_id && !providerId && state !== 'manual') {
      state = String(current.rows[0].status)
      failureCode = ''
    }
    const providerState = deliveryState(await factsFor(req, id))
    if (providerState && state !== 'manual') {
      state = providerState
      failureCode = ''
    }
    await db.execute(
      sql`UPDATE email_messages SET status = ${state}::enum_email_messages_status, provider_id = coalesce(provider_id, ${providerId || null}), accepted_at = CASE WHEN ${Boolean(providerId)} THEN coalesce(accepted_at, now()) ELSE accepted_at END, failure_code = ${failureCode || null} WHERE id = ${id}`,
    )
    await enquiryStatus(req, row, state)
    await statusActivity(req, row, state)
    return state
  })
}
export async function receiveDelivery(payload: Payload, fact: DeliveryFact) {
  return internalTransaction(payload, async (req) => {
    const db = await transactionDB(req)
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${fact.eventId}, 0))`)
    const previous = await db.execute(
      sql`SELECT provider_id, kind, occurred_at FROM email_delivery_events WHERE event_id = ${fact.eventId}`,
    )
    if (previous.rowCount) {
      const old = previous.rows[0]
      if (
        old.provider_id !== fact.providerId ||
        old.kind !== fact.kind ||
        new Date(String(old.occurred_at)).toISOString() !== fact.occurredAt
      )
        throw new APIError('Conflicting webhook identity.', 409)
      return 'duplicate'
    }
    const found = await db.execute(
      sql`SELECT * FROM email_messages WHERE provider_id = ${fact.providerId} OR (idempotency_key = ${fact.messageKey || ''} AND attempts > 0) ORDER BY id FOR UPDATE`,
    )
    if (found.rows.length > 1) throw new APIError('Conflicting message identities.', 409)
    const row = found.rows[0] as unknown as MessageRow | undefined
    // Unrelated account events are ignored without storing their addresses or payload.
    if (!row) return 'unrelated'
    if (row.provider_id && row.provider_id !== fact.providerId)
      throw new APIError('Conflicting provider identity.', 409)
    await db.execute(
      sql`INSERT INTO email_delivery_events (event_id, message_id, provider_id, kind, occurred_at) VALUES (${fact.eventId}, ${row.id}, ${fact.providerId}, ${fact.kind}, ${fact.occurredAt}::timestamptz)`,
    )
    const state = deliveryState(await factsFor(req, row.id))!
    await db.execute(
      sql`UPDATE email_messages SET provider_id = ${fact.providerId}, status = ${state}::enum_email_messages_status, delivered_at = CASE WHEN ${fact.kind === 'email.delivered'} THEN coalesce(delivered_at, ${fact.occurredAt}::timestamptz) ELSE delivered_at END, accepted_at = CASE WHEN ${fact.kind === 'email.sent'} THEN coalesce(accepted_at, ${fact.occurredAt}::timestamptz) ELSE accepted_at END WHERE id = ${row.id}`,
    )
    await activity(req, {
      contact: row.contact_id,
      enquiry: row.enquiry_id || undefined,
      booking: row.booking_id || undefined,
      emailMessage: row.id,
      kind: fact.kind,
      summary: `Provider: ${fact.kind.replace('email.', '').replaceAll('_', ' ')}`,
      source: 'provider',
      occurredAt: fact.occurredAt,
      details: { resultingStatus: state },
    })
    await enquiryStatus(req, row, state)
    return 'recorded'
  })
}
export async function preparePhotographerNotice(
  payload: Payload,
  enquiryID: number,
): Promise<number | string> {
  return internalTransaction(payload, async (req) => {
    const db = await transactionDB(req)
    await lockRecord(req, 'enquiries', enquiryID)
    const found = await db.execute(
      sql`SELECT id, contact_id, notification_status, notification_attempts FROM enquiries WHERE id = ${enquiryID}`,
    )
    const enquiry = found.rows[0]
    if (!enquiry) throw new APIError('Enquiry not found.', 404)
    const existing = await db.execute(
      sql`SELECT id FROM email_messages WHERE notification_key = ${`enquiry:${enquiryID}`}`,
    )
    if (existing.rowCount) return Number(existing.rows[0].id)
    if (process.env.LUNIA_CMS_PREVIEW !== 'true') {
      await db.execute(
        sql`UPDATE enquiries SET notification_status = 'disabled' WHERE id = ${enquiryID} AND notification_status IN ('pending','failed')`,
      )
      return 'disabled'
    }
    if (Number(enquiry.notification_attempts) > 0) {
      const state = enquiry.notification_status === 'accepted' ? 'accepted' : 'manual'
      if (state === 'manual')
        await db.execute(
          sql`UPDATE enquiries SET notification_status = 'manual' WHERE id = ${enquiryID}`,
        )
      return state
    }
    if (!enquiry.contact_id) throw new APIError('Enquiry contact needs migration.', 503)
    const key = `lunia-message-${randomUUID()}`
    const rendered = renderEmail(notificationTemplate.subject, notificationTemplate.body, {})
    const recipient = safeRecipient()
    const message = await payload.create({
      collection: 'email-messages',
      req,
      overrideAccess: false,
      depth: 0,
      data: {
        contact: Number(enquiry.contact_id),
        enquiry: enquiryID,
        kind: 'photographer_notification',
        status: 'queued',
        ...rendered,
        templateSnapshot: { ...notificationTemplate, version: 1, plainTextOnly: true },
        recipient,
        sender: String(providerPayload(key, recipient, rendered, true).from),
        providerPayload: providerPayload(key, recipient, rendered, true),
        idempotencyKey: key,
        notificationKey: `enquiry:${enquiryID}`,
        attempts: 0,
      },
    })
    await activity(req, {
      contact: Number(enquiry.contact_id),
      enquiry: enquiryID,
      emailMessage: message.id,
      kind: 'email_queued',
      summary: 'Photographer notification queued',
      source: 'system',
    })
    return message.id
  })
}
