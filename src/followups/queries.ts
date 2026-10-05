import { APIError, type Payload, type PayloadRequest } from 'payload'
import { customerView } from '../customer-records/queries'

export async function workspace(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  contact: number,
) {
  const customer = await customerView(payload, user, contact)
  const [plans, templates] = await Promise.all([
    payload.find({
      collection: 'follow-ups',
      user,
      overrideAccess: false,
      where: { contact: { equals: contact } },
      depth: 0,
      limit: 100,
      sort: 'plannedAt',
    }),
    payload.find({
      collection: 'email-templates',
      user,
      overrideAccess: false,
      where: { approved: { equals: true } },
      depth: 0,
      limit: 100,
      sort: 'name',
    }),
  ])
  return {
    ...customer,
    plans: plans.docs,
    templates: templates.docs,
    truncated: customer.truncated || plans.hasNextPage || templates.hasNextPage,
  }
}

export async function inbox(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  input: Record<string, unknown>,
) {
  const filter = typeof input.filter === 'string' ? input.filter : 'all'
  const page = input.page === undefined ? 1 : Number(input.page)
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw new APIError('Choose a valid page.', 422)
  const clauses: Record<string, string> = {
    all: 'true',
    new: "EXISTS (SELECT 1 FROM enquiries e WHERE e.contact_id = c.id AND e.follow_up = 'new')",
    waiting:
      "EXISTS (SELECT 1 FROM enquiries e WHERE e.contact_id = c.id AND e.follow_up = 'contacted') OR EXISTS (SELECT 1 FROM bookings b WHERE b.contact_id = c.id AND b.status = 'proposed')",
    upcoming:
      "EXISTS (SELECT 1 FROM bookings b WHERE b.contact_id = c.id AND b.status = 'confirmed' AND b.session_at > now())",
    attention:
      "EXISTS (SELECT 1 FROM follow_ups f WHERE f.contact_id = c.id AND f.state IN ('blocked','failed')) OR EXISTS (SELECT 1 FROM email_messages m WHERE m.contact_id = c.id AND m.status IN ('failed','uncertain','manual','bounced','delayed'))",
  }
  if (!Object.hasOwn(clauses, filter)) throw new APIError('Choose a valid inbox filter.', 422)
  const query =
    typeof input.query === 'string' ? input.query.slice(0, 100).replace(/[\\%_]/g, '\\$&') : ''
  const ids = await payload.db.pool.query<{ id: number }>(
    `SELECT c.id FROM contacts c WHERE (c.name ILIKE $1 OR c.email ILIKE $1) AND (${clauses[filter]}) ORDER BY c.updated_at DESC, c.id DESC LIMIT 21 OFFSET $2`,
    [`%${query}%`, (page - 1) * 20],
  )
  const rows = await Promise.all(
    ids.rows.slice(0, 20).map(async ({ id }) => {
      const contact = await payload.findByID({
        collection: 'contacts',
        id,
        user,
        overrideAccess: false,
        depth: 0,
      })
      const [enquiries, events, plans] = await Promise.all([
        payload.find({
          collection: 'enquiries',
          user,
          overrideAccess: false,
          where: { contact: { equals: id } },
          depth: 0,
          limit: 1,
          sort: '-createdAt',
        }),
        payload.find({
          collection: 'customer-activities',
          user,
          overrideAccess: false,
          where: { contact: { equals: id } },
          depth: 0,
          limit: 1,
          sort: '-createdAt',
        }),
        payload.find({
          collection: 'follow-ups',
          user,
          overrideAccess: false,
          where: {
            and: [
              { contact: { equals: id } },
              { state: { in: ['planned', 'blocked', 'paused', 'failed'] } },
            ],
          },
          depth: 0,
          limit: 1,
          sort: 'plannedAt',
        }),
      ])
      return { contact, enquiry: enquiries.docs[0], activity: events.docs[0], plan: plans.docs[0] }
    }),
  )
  return { rows, page, hasNextPage: ids.rows.length > 20 }
}
