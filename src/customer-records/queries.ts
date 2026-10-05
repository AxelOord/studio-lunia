import { APIError, type Payload, type PayloadRequest } from 'payload'

export async function customerView(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  id: number,
) {
  const contact = await payload.findByID({
    collection: 'contacts',
    id,
    user,
    overrideAccess: false,
    depth: 0,
  })
  const enquiries = await payload.find({
    collection: 'enquiries',
    where: { contact: { equals: id } },
    user,
    overrideAccess: false,
    depth: 0,
    limit: 100,
    sort: '-createdAt',
  })
  const bookings = await payload.find({
    collection: 'bookings',
    where: { contact: { equals: id } },
    user,
    overrideAccess: false,
    depth: 0,
    limit: 100,
    sort: '-createdAt',
  })
  const enquiryIDs = enquiries.docs.map((e) => e.id)
  const bookingIDs = bookings.docs.map((b) => b.id)
  const events = await payload.find({
    collection: 'customer-activities',
    where: {
      or: [
        { contact: { equals: id } },
        ...(enquiryIDs.length ? [{ enquiry: { in: enquiryIDs } }] : []),
        ...(bookingIDs.length ? [{ booking: { in: bookingIDs } }] : []),
      ],
    },
    user,
    overrideAccess: false,
    depth: 0,
    limit: 100,
    sort: '-occurredAt',
  })
  const messages = await payload.find({
    collection: 'email-messages',
    where: {
      or: [
        { contact: { equals: id } },
        ...(enquiryIDs.length ? [{ enquiry: { in: enquiryIDs } }] : []),
      ],
    },
    user,
    overrideAccess: false,
    depth: 0,
    limit: 100,
    sort: '-createdAt',
    select: { subject: true, kind: true, status: true, createdAt: true },
  })
  return {
    contact,
    enquiries: enquiries.docs,
    bookings: bookings.docs,
    events: events.docs,
    messages: messages.docs,
    truncated: [enquiries, bookings, events, messages].some((page) => page.hasNextPage),
    limitations:
      'Replies outside staff-reported notes are not imported. Draft emails are not scheduled. Older notification content may not have been captured.',
  }
}

export async function searchContacts(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  query: string,
  filter: string,
) {
  if (!['all', 'new', 'waiting', 'upcoming', 'attention'].includes(filter))
    throw new APIError('Unknown customer filter.', 400)
  // Values are parameters; only fixed clauses can become SQL. Private search is POSTed,
  // so names/email addresses are not placed into URLs by this component.
  const clauses: Record<string, string> = {
    all: 'true',
    new: "EXISTS (SELECT 1 FROM enquiries e WHERE e.contact_id = c.id AND e.follow_up = 'new')",
    waiting:
      "EXISTS (SELECT 1 FROM bookings b WHERE b.contact_id = c.id AND b.status = 'proposed') OR EXISTS (SELECT 1 FROM enquiries e WHERE e.contact_id = c.id AND e.follow_up = 'contacted')",
    upcoming:
      "EXISTS (SELECT 1 FROM bookings b WHERE b.contact_id = c.id AND b.status = 'confirmed' AND b.session_at >= now())",
    attention:
      "EXISTS (SELECT 1 FROM email_messages m WHERE m.contact_id = c.id AND m.status IN ('failed','uncertain','manual','bounced','delayed')) OR EXISTS (SELECT 1 FROM enquiries e WHERE e.contact_id = c.id AND e.notification_status IN ('failed','manual'))",
  }
  const found = await payload.db.pool.query<{ id: number }>(
    `SELECT c.id FROM contacts c WHERE (c.name ILIKE $1 OR c.email ILIKE $1) AND (${clauses[filter]}) ORDER BY c.updated_at DESC, c.id DESC LIMIT 51`,
    [`%${query.replace(/[\\%_]/g, '\\$&')}%`],
  )
  const ids = found.rows.slice(0, 50).map((row) => row.id)
  if (!ids.length) return { contacts: [], truncated: false }
  const result = await payload.find({
    collection: 'contacts',
    where: { id: { in: ids } },
    user,
    overrideAccess: false,
    depth: 0,
    limit: 50,
    sort: '-updatedAt',
  })
  return { contacts: result.docs, truncated: found.rows.length > 50 }
}
