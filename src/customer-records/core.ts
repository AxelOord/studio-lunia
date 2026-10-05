import { createHash } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { APIError, createLocalReq, type Payload, type PayloadRequest } from 'payload'

export const recordsCapability = Symbol.for('studio-lunia.customer-records')
export const internalWrite = ({ req }: { req: PayloadRequest }) =>
  req.context.recordsCapability === recordsCapability
export const recordContext = { recordsCapability }
export function relationID(value: unknown): number | undefined {
  const id = value && typeof value === 'object' && 'id' in value ? value.id : value
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : undefined
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new APIError('Expected an object.', 400)
  return value as Record<string, unknown>
}
export function textInput(value: unknown, label: string, min = 1, max = 2000): string {
  if (typeof value !== 'string') throw new APIError(`${label} is required.`, 422)
  const text = value.trim()
  if (text.length < min || text.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))
    throw new APIError(`Check ${label.toLowerCase()}.`, 422)
  return text
}
export function idInput(value: unknown): number {
  const id = relationID(value)
  if (!id) throw new APIError('Select a valid record.', 422)
  return id
}
export function moneyInput(value: unknown, positive = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < (positive ? 1 : 0) ||
    value > 100_000_000
  )
    throw new APIError('Enter a valid amount in minor currency units.', 422)
  return value
}
export function dateInput(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value))
    throw new APIError('Enter a date and time with a timezone.', 422)
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || !/(Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new APIError('Enter a valid date and timezone.', 422)
  return date.toISOString()
}
export async function transactionDB(req: PayloadRequest) {
  const id = await req.transactionID
  const db = id ? req.payload.db.sessions[String(id)].db : req.payload.db.drizzle
  if (!('execute' in db)) throw new APIError('PostgreSQL transactions are required.', 503)
  return db
}
export async function internalTransaction<T>(
  payload: Payload,
  work: (req: PayloadRequest) => Promise<T>,
): Promise<T> {
  const id = await payload.db.beginTransaction()
  if (!id) throw new APIError('Transactions are unavailable.', 503)
  const req = await createLocalReq({ context: recordContext }, payload)
  req.transactionID = id
  try {
    const result = await work(req)
    await payload.db.commitTransaction(id)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(id)
    throw error
  }
}
export async function activity(
  req: PayloadRequest,
  data: {
    contact: number
    enquiry?: number
    booking?: number
    emailMessage?: number
    kind: string
    summary: string
    source: 'website' | 'staff' | 'provider' | 'migration' | 'system'
    occurredAt?: string
    details?: Record<string, unknown>
  },
) {
  return req.payload.create({
    collection: 'customer-activities',
    data: { ...data, occurredAt: data.occurredAt || new Date().toISOString(), actor: req.user?.id },
    req,
    context: { ...req.context, ...recordContext },
    overrideAccess: false,
    depth: 0,
  })
}

export async function command<T extends Record<string, unknown>>(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  key: unknown,
  input: Record<string, unknown>,
  work: (req: PayloadRequest) => Promise<T>,
): Promise<T> {
  if (
    typeof key !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)
  )
    throw new APIError('A valid operation key is required.', 400)
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const transactionID = await payload.db.beginTransaction()
  if (!transactionID) throw new APIError('Transactions are unavailable.', 503)
  const req = await createLocalReq({ user, context: recordContext }, payload)
  req.transactionID = transactionID
  try {
    const db = await transactionDB(req)
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`)
    const previous = await db.execute(
      sql`SELECT input_hash, result FROM customer_operations WHERE operation_key = ${key}`,
    )
    const row = previous.rows[0] as { input_hash: string; result: T } | undefined
    if (row) {
      if (row.input_hash !== hash)
        throw new APIError('This operation key was used with different details.', 409)
      await payload.db.commitTransaction(transactionID)
      return row.result
    }
    const result = await work(req)
    await db.execute(
      sql`INSERT INTO customer_operations (operation_key, input_hash, result) VALUES (${key}, ${hash}, ${JSON.stringify(result)}::jsonb)`,
    )
    await payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

export async function lockRecord(
  req: PayloadRequest,
  collection: 'bookings' | 'enquiries' | 'email-messages',
  id: number,
) {
  const db = await transactionDB(req)
  // Fixed identifiers only; the value stays bound by Drizzle.
  if (collection === 'bookings')
    await db.execute(sql`SELECT id FROM bookings WHERE id = ${id} FOR UPDATE`)
  else if (collection === 'enquiries')
    await db.execute(sql`SELECT id FROM enquiries WHERE id = ${id} FOR UPDATE`)
  else await db.execute(sql`SELECT id FROM email_messages WHERE id = ${id} FOR UPDATE`)
}

export function recordsError(error: unknown) {
  const status = error instanceof APIError ? error.status : 503
  return Response.json(
    {
      error:
        error instanceof APIError && status < 500
          ? error.message
          : 'The operation could not be confirmed. Keep these details and retry with the same action.',
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  )
}
