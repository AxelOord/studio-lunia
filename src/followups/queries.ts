import { APIError, type Payload, type PayloadRequest, type Where } from 'payload'
import { customerView } from '../customer-records/queries'

export async function workspace(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  contact: number,
  selection: { enquiry?: unknown; plan?: unknown } = {},
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
  const selectedID = (value: unknown) => {
    const id = Number(value)
    return Number.isSafeInteger(id) && id > 0 ? id : undefined
  }
  const planID = selectedID(selection.plan)
  const selectedPlan = planID
    ? (
        await payload.find({
          collection: 'follow-ups',
          user,
          overrideAccess: false,
          where: { and: [{ contact: { equals: contact } }, { id: { equals: planID } }] },
          depth: 0,
          limit: 1,
        })
      ).docs[0]
    : undefined
  const enquiryID = selectedPlan
    ? selectedPlan.enquiry && typeof selectedPlan.enquiry === 'object'
      ? selectedPlan.enquiry.id
      : selectedPlan.enquiry
    : selectedID(selection.enquiry)
  const selectedEnquiry = enquiryID
    ? (
        await payload.find({
          collection: 'enquiries',
          user,
          overrideAccess: false,
          where: { and: [{ contact: { equals: contact } }, { id: { equals: enquiryID } }] },
          depth: 0,
          limit: 1,
        })
      ).docs[0]
    : undefined
  // Deep links remain useful when the target falls outside the bounded recent lists.
  if (selectedPlan && !plans.docs.some((item) => item.id === selectedPlan.id))
    plans.docs.push(selectedPlan)
  if (selectedEnquiry && !customer.enquiries.some((item) => item.id === selectedEnquiry.id))
    customer.enquiries.push(selectedEnquiry)
  const bookingID = selectedPlan?.booking
    ? typeof selectedPlan.booking === 'object'
      ? selectedPlan.booking.id
      : selectedPlan.booking
    : undefined
  if (bookingID && !customer.bookings.some((item) => item.id === bookingID)) {
    const booking = await payload.find({
      collection: 'bookings',
      user,
      overrideAccess: false,
      where: { and: [{ contact: { equals: contact } }, { id: { equals: bookingID } }] },
      depth: 0,
      limit: 1,
    })
    customer.bookings.push(...booking.docs)
  }
  return {
    ...customer,
    plans: plans.docs,
    templates: templates.docs,
    selectedEnquiry: selectedEnquiry?.id,
    selectedPlan: selectedPlan?.id,
    selectionUnavailable: Boolean((planID && !selectedPlan) || (enquiryID && !selectedEnquiry)),
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
      "EXISTS (SELECT 1 FROM enquiries e WHERE e.contact_id = c.id AND e.follow_up = 'contacted') OR EXISTS (SELECT 1 FROM bookings b WHERE b.contact_id = c.id AND b.status IN ('proposed','pending_approval'))",
    upcoming:
      "EXISTS (SELECT 1 FROM bookings b WHERE b.contact_id = c.id AND b.status = 'confirmed' AND b.session_at > now())",
    attention:
      "EXISTS (SELECT 1 FROM follow_ups f WHERE f.contact_id = c.id AND f.state IN ('blocked','failed')) OR EXISTS (SELECT 1 FROM email_messages m WHERE m.contact_id = c.id AND m.status IN ('failed','uncertain','manual','bounced','delayed')) OR EXISTS (SELECT 1 FROM bookings b WHERE b.contact_id = c.id AND (b.status = 'pending_approval' OR b.studio_message_state = 'failed'))",
  }
  if (!Object.hasOwn(clauses, filter)) throw new APIError('Choose a valid inbox filter.', 422)
  const query =
    typeof input.query === 'string' ? input.query.slice(0, 100).replace(/[\\%_]/g, '\\$&') : ''
  const ids = await payload.db.pool.query<{ id: number; enquiry_id: number | null }>(
    `SELECT c.id, (SELECT e.id FROM enquiries e WHERE e.contact_id = c.id ORDER BY (e.follow_up = 'new') DESC, e.created_at DESC, e.id DESC LIMIT 1) AS enquiry_id FROM contacts c WHERE (c.name ILIKE $1 OR c.email ILIKE $1) AND (${clauses[filter]}) ORDER BY CASE WHEN (${clauses.new}) THEN 0 WHEN (${clauses.attention}) THEN 1 WHEN (${clauses.upcoming}) THEN 2 WHEN (${clauses.waiting}) THEN 3 ELSE 4 END, c.updated_at DESC, c.id DESC LIMIT 21 OFFSET $2`,
    [`%${query}%`, (page - 1) * 20],
  )
  const counts = await payload.db.pool.query<Record<string, number>>(
    `SELECT ${Object.entries(clauses)
      .map(([name, clause]) => `count(*) FILTER (WHERE (${clause}))::int AS "${name}"`)
      .join(', ')} FROM contacts c WHERE c.name ILIKE $1 OR c.email ILIKE $1`,
    [`%${query}%`],
  )
  const rows = await Promise.all(
    ids.rows.slice(0, 20).map(async ({ id, enquiry_id }) => {
      const contact = await payload.findByID({
        collection: 'contacts',
        id,
        user,
        overrideAccess: false,
        depth: 0,
      })
      const [enquiries, events, plans, bookings] = await Promise.all([
        payload.find({
          collection: 'enquiries',
          user,
          overrideAccess: false,
          where: {
            and: [
              { contact: { equals: id } },
              ...(enquiry_id ? [{ id: { equals: enquiry_id } }] : []),
            ],
          },
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
        payload.find({
          collection: 'bookings',
          user,
          overrideAccess: false,
          where: { contact: { equals: id } },
          depth: 0,
          limit: 1,
          sort: '-updatedAt',
        }),
      ])
      return {
        contact,
        enquiry: enquiries.docs[0],
        activity: events.docs[0],
        plan: plans.docs[0],
        booking: bookings.docs[0],
      }
    }),
  )
  return { rows, page, hasNextPage: ids.rows.length > 20, counts: counts.rows[0] }
}

export async function planQueue(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  input: { filter?: unknown; page?: unknown } = {},
) {
  const filter = typeof input.filter === 'string' ? input.filter : 'all'
  const page = input.page == null ? 1 : Number(input.page)
  const filters: Record<string, Where> = {
    all: {},
    attention: { state: { in: ['blocked', 'failed'] } },
    planned: { state: { equals: 'planned' } },
    paused: { state: { equals: 'paused' } },
    finished: { state: { in: ['simulated', 'cancelled'] } },
  }
  if (!Object.hasOwn(filters, filter) || !Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw new APIError('Choose a valid queue filter and page.', 422)
  return payload.find({
    collection: 'follow-ups',
    user,
    overrideAccess: false,
    depth: 1,
    limit: 20,
    page,
    sort: ['plannedAt', 'id'],
    where: filters[filter],
  })
}
