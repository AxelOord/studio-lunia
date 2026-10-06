import { verifyWebhookSignature } from '../customer-records/webhook'

// Feasibility adapter only. The public route remains disabled until receiving-domain,
// webhook/content access and privacy handling are separately approved and verified.
// A signed provider notification alone cannot prove its sender, body or conversation.
export function verifiedIncomingNotice(
  raw: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
) {
  if (Buffer.byteLength(raw) > 32000) throw new Error('Incoming event is too large')
  const eventKey = verifyWebhookSignature(raw, headers, secret, now)
  const event = JSON.parse(raw) as {
    type?: unknown
    created_at?: unknown
    data?: { email_id?: unknown }
  }
  if (event.type !== 'email.received') return undefined
  if (
    typeof event.data?.email_id !== 'string' ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(event.data.email_id) ||
    typeof event.created_at !== 'string'
  )
    throw new Error('Invalid incoming event')
  const occurredAt = new Date(event.created_at)
  if (!Number.isFinite(occurredAt.getTime()) || occurredAt.getTime() > now + 300000)
    throw new Error('Invalid incoming event time')
  return {
    eventKey,
    providerID: event.data.email_id,
    occurredAt: occurredAt.toISOString(),
    state: 'review' as const,
    reviewReason:
      'Verified notification only. Authenticated content retrieval and exact conversation matching are not configured.',
  }
}

// Called only by a future explicitly configured receiving adapter or isolated tests.
// The public HTTP route does not call this function. Retrieval is injected so this
// boundary never borrows the sending credential or makes a provider request itself.
export async function recordVerifiedIncoming(
  payload: import('payload').Payload,
  notice: NonNullable<ReturnType<typeof verifiedIncomingNotice>>,
  retrieve: () => Promise<{ reference?: string; sender: string; text: string }>,
) {
  const { sql } = await import('@payloadcms/db-postgres')
  const { activity, idInput, internalTransaction, textInput, transactionDB } = await import(
    '../customer-records/core'
  )
  const content = await retrieve()
  const sender = textInput(content.sender, 'Sender', 3, 254).toLowerCase()
  const text = textInput(content.text, 'Reply text', 1, 3000)
  return internalTransaction(payload, async (req) => {
    const db = await transactionDB(req)
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`incoming:${notice.eventKey}`}, 0))`,
    )
    const existing = await payload.find({
      collection: 'incoming-replies',
      req,
      overrideAccess: false,
      depth: 0,
      limit: 1,
      where: { eventKey: { equals: notice.eventKey } },
    })
    if (existing.docs[0]) return existing.docs[0]
    const reference =
      content.reference && /^lunia-message-[a-f0-9-]{36}$/.test(content.reference)
        ? content.reference
        : undefined
    const matches = reference
      ? await payload.find({
          collection: 'email-messages',
          req,
          overrideAccess: false,
          depth: 0,
          limit: 2,
          where: {
            and: [
              { idempotencyKey: { equals: reference } },
              { kind: { equals: 'customer_draft' } },
            ],
          },
        })
      : undefined
    const message =
      matches?.docs.length === 1 && matches.docs[0].recipient.toLowerCase() === sender
        ? matches.docs[0]
        : undefined
    const reply = await payload.create({
      collection: 'incoming-replies',
      req,
      overrideAccess: false,
      depth: 0,
      data: {
        eventKey: notice.eventKey,
        summary: message
          ? 'Verified reply matched to an exact message reference'
          : 'Incoming reply requires staff review',
        source: 'verified_provider',
        state: message ? 'matched' : 'review',
        occurredAt: notice.occurredAt,
        text,
        contact: message ? idInput(message.contact) : undefined,
        enquiry: message?.enquiry ? idInput(message.enquiry) : undefined,
        reviewReason: message
          ? undefined
          : 'No unique exact message reference and matching sender. No customer was inferred.',
      },
    })
    if (message)
      await activity(req, {
        contact: idInput(message.contact),
        enquiry: message.enquiry ? idInput(message.enquiry) : undefined,
        kind: 'reply_received',
        summary: 'Verified incoming reply matched to a message reference',
        source: 'provider',
        occurredAt: notice.occurredAt,
        details: { reply: reply.id, note: text, provenance: 'verified_provider' },
      })
    return reply
  })
}
