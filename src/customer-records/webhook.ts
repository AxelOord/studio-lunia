import { createHmac, timingSafeEqual } from 'node:crypto'

export const deliveryEvents = [
  'email.sent',
  'email.delivered',
  'email.delivery_delayed',
  'email.bounced',
  'email.failed',
  'email.suppressed',
] as const
export type DeliveryKind = (typeof deliveryEvents)[number]
export type DeliveryFact = {
  eventId: string
  providerId: string
  kind: DeliveryKind
  occurredAt: string
  messageKey?: string
}

// Resend's documented Svix protocol, raw bytes unchanged. A replay within this
// tolerance is still deduplicated by its immutable event ID in PostgreSQL.
export function verifyDelivery(
  raw: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
): DeliveryFact | undefined {
  const id = headers.get('svix-id') || ''
  const timestamp = headers.get('svix-timestamp') || ''
  const signatures = headers.get('svix-signature') || ''
  if (
    !/^[A-Za-z0-9_-]{8,200}$/.test(id) ||
    !/^\d{10}$/.test(timestamp) ||
    signatures.length > 2000 ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)
  )
    throw new Error('Invalid webhook signature')
  const key = Buffer.from(secret.slice(6), 'base64')
  if (key.length < 16) throw new Error('Invalid webhook configuration')
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest()
  const valid = signatures.split(' ').some((value) => {
    if (!/^v1,[A-Za-z0-9+/]{43}=$/.test(value)) return false
    const supplied = Buffer.from(value.slice(3), 'base64')
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
  })
  if (!valid) throw new Error('Invalid webhook signature')
  const event = JSON.parse(raw) as {
    type?: unknown
    created_at?: unknown
    data?: { email_id?: unknown; tags?: Record<string, unknown> }
  }
  if (!deliveryEvents.includes(event.type as DeliveryKind)) return
  if (
    typeof event.data?.email_id !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(event.data.email_id) ||
    typeof event.created_at !== 'string'
  )
    throw new Error('Invalid webhook event')
  const occurred = new Date(event.created_at)
  if (!Number.isFinite(occurred.getTime()) || occurred.getTime() > now + 300_000)
    throw new Error('Invalid webhook event time')
  const keyTag = event.data.tags?.lunia_message
  return {
    eventId: id,
    providerId: event.data.email_id,
    kind: event.type as DeliveryKind,
    occurredAt: occurred.toISOString(),
    ...(typeof keyTag === 'string' && /^lunia-message-[a-f0-9-]{36}$/.test(keyTag)
      ? { messageKey: keyTag }
      : {}),
  }
}

export function deliveryState(
  facts: Pick<DeliveryFact, 'kind' | 'occurredAt'>[],
): 'accepted' | 'delayed' | 'delivered' | 'bounced' | 'failed' | undefined {
  // Permanent bounce/suppression are terminal. For other terminal outcomes use
  // provider occurrence time, never arrival order. Nonterminal facts cannot regress them.
  if (facts.some((f) => f.kind === 'email.bounced' || f.kind === 'email.suppressed'))
    return 'bounced'
  const terminal = facts
    .filter((f) => f.kind === 'email.delivered' || f.kind === 'email.failed')
    .sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) ||
        Number(a.kind === 'email.failed') - Number(b.kind === 'email.failed'),
    )
  if (terminal.length) return terminal.at(-1)!.kind === 'email.delivered' ? 'delivered' : 'failed'
  if (facts.some((f) => f.kind === 'email.delivery_delayed')) return 'delayed'
  if (facts.some((f) => f.kind === 'email.sent')) return 'accepted'
}
