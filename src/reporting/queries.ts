import { APIError, createLocalReq, type Payload, type PayloadRequest } from 'payload'
import {
  accumulator,
  addMoney,
  amount,
  campaignBucket,
  metric,
  reportFilters,
  type ReportFilters,
  type Stream,
} from './domain'
import { enquiryFunnel } from './posthog'

const sourceCollections = [
  'enquiries',
  'bookings',
  'revenue-entries',
  'customer-activities',
  'follow-ups',
  'email-messages',
  'studio-days',
  'studio-slots',
] as const
export async function authorizeReport(payload: Payload, user: PayloadRequest['user']) {
  if (!user || user.collection !== 'users')
    throw new APIError('Sign in to view conversion reports.', 401)
  const req = await createLocalReq({ user }, payload)
  for (const collection of sourceCollections) {
    const access = payload.collections[collection].config.access.read
    // Raw aggregate queries require unrestricted read permission. Never ignore a row-level filter.
    if (!access || (await access({ req, slug: collection })) !== true)
      throw new APIError('Full source-record read access is required for this report.', 403)
  }
}
type Source = {
  id: number
  stream: Stream
  createdAt: string
  href: string
  bookingsHref: string
  moneyHref: string
}
type EnquiryRow = {
  id: number
  contact_id: number | null
  created_at: Date
  service_id: string
  service_title: string
  attribution: unknown
  qualified: boolean
  converted: boolean
  response_hours: string | null
}
type BookingRow = {
  id: number
  contact_id: number
  created_at: Date
  source: 'staff_enquiry' | 'studio_slot'
  status: 'proposed' | 'pending_approval' | 'confirmed' | 'completed' | 'cancelled'
  expected_minor: string
  currency: string
  service_id: string | null
  service_title: string | null
  studio_day_id: number | null
  studio_title: string | null
  attribution: unknown
  money: { currency: string; total: string }[] | null
}
export function collectionURL(collection: string, conditions: Record<string, string> = {}) {
  const params = new URLSearchParams(conditions)
  return '/admin/collections/' + collection + (params.size ? '?' + params.toString() : '')
}

export async function conversionReport(
  payload: Payload,
  user: PayloadRequest['user'],
  input: Record<string, unknown>,
) {
  await authorizeReport(payload, user)
  const filters = reportFilters(input)
  const totals = { bespoke: accumulator(), studio: accumulator() }
  const groups = new Map<
    string,
    { key: string; label: string; stream: Stream; values: ReturnType<typeof accumulator> }
  >()
  const sources: Source[] = []
  let sourceCount = 0
  function targets(stream: Stream, offerKey: string, label: string, attribution: unknown) {
    const campaign = campaignBucket(attribution, filters.touch)
    const key = JSON.stringify([stream, filters.groupBy === 'offers' ? offerKey : campaign.key])
    if (!groups.has(key))
      groups.set(key, {
        key,
        stream,
        label: filters.groupBy === 'offers' ? label : campaign.label,
        values: accumulator(),
      })
    return { key, values: [totals[stream], groups.get(key)!.values] }
  }
  function source(key: string, row: Source) {
    if (filters.group && filters.group !== key) return
    if (filters.sourceStream !== 'all' && filters.sourceStream !== row.stream) return
    const index = sourceCount++
    if (index >= (filters.sourcePage - 1) * 20 && sources.length < 20) sources.push(row)
  }
  const db = await payload.db.pool.connect()
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    await db.query("SET LOCAL statement_timeout = '15s'")
    const asOf = (
      await db.query<{ at: Date }>('SELECT transaction_timestamp() AS at')
    ).rows[0].at.toISOString()
    let afterID = 0
    while (true) {
      const result = await db.query<EnquiryRow>(
        `
        SELECT e.id, e.contact_id, e.created_at, e.service_id, e.service_title, e.attribution,
          EXISTS(SELECT 1 FROM bookings b WHERE b.enquiry_id=e.id AND b.source='staff_enquiry') AS qualified,
          EXISTS(SELECT 1 FROM bookings b WHERE b.enquiry_id=e.id AND b.source='staff_enquiry' AND b.status IN ('confirmed','completed')) AS converted,
          CASE WHEN response.kind='first_response_recorded' AND response.occurred_at >= e.created_at
            AND response.occurred_at <= transaction_timestamp()
            THEN extract(epoch FROM response.occurred_at - e.created_at)/3600 END AS response_hours
        FROM enquiries e LEFT JOIN LATERAL (
          SELECT kind, occurred_at FROM customer_activities a WHERE a.enquiry_id=e.id
            AND a.source='staff' AND a.kind IN ('first_response_recorded','first_response_cleared')
          ORDER BY a.created_at DESC, a.id DESC LIMIT 1
        ) response ON true
        WHERE e.created_at >= $1 AND e.created_at < $2 AND e.id > $3 ORDER BY e.id LIMIT 1000
      `,
        [filters.start, filters.until, afterID],
      )
      for (const row of result.rows) {
        const group = targets('bespoke', row.service_id, row.service_title, row.attribution)
        for (const target of group.values) {
          target.intents++
          if (row.contact_id) target.contactIDs.add(row.contact_id)
          else target.unlinked++
          if (row.qualified) target.qualified++
          if (row.converted) target.converted++
          if (row.response_hours !== null) target.responseHours.push(Number(row.response_hours))
        }
        source(group.key, {
          id: row.id,
          stream: 'bespoke',
          createdAt: row.created_at.toISOString(),
          href: collectionURL('enquiries') + '/' + row.id,
          bookingsHref: collectionURL('bookings', { 'where[enquiry][equals]': String(row.id) }),
          moneyHref: collectionURL('revenue-entries', {
            'where[booking.enquiry][equals]': String(row.id),
          }),
        })
      }
      if (result.rows.length < 1000) break
      afterID = result.rows.at(-1)!.id
    }
    afterID = 0
    while (true) {
      const result = await db.query<BookingRow>(
        `
        SELECT b.id,b.contact_id,b.created_at,b.source,b.status,b.expected_minor,b.currency,
          e.service_id,e.service_title,b.studio_day_id,
          coalesce(d.title,b.studio_snapshot->>'offerTitle','Unknown studio day') AS studio_title,
          CASE WHEN b.source='staff_enquiry' THEN e.attribution ELSE b.attribution END AS attribution,
          (SELECT jsonb_agg(m) FROM (SELECT r.currency,sum(r.amount_minor)::text AS total
            FROM revenue_entries r WHERE r.booking_id=b.id GROUP BY r.currency) m) AS money
        FROM bookings b LEFT JOIN enquiries e ON e.id=b.enquiry_id LEFT JOIN studio_days d ON d.id=b.studio_day_id
        WHERE b.id > $3 AND (
          (b.source='staff_enquiry' AND e.created_at >= $1 AND e.created_at < $2) OR
          (b.source='studio_slot' AND b.created_at >= $1 AND b.created_at < $2))
        ORDER BY b.id LIMIT 1000
      `,
        [filters.start, filters.until, afterID],
      )
      for (const row of result.rows) {
        const stream = row.source === 'studio_slot' ? 'studio' : 'bespoke'
        const group = targets(
          stream,
          stream === 'studio' ? String(row.studio_day_id) : row.service_id!,
          stream === 'studio' ? row.studio_title! : row.service_title!,
          row.attribution,
        )
        for (const target of group.values) {
          if (stream === 'studio') {
            target.intents++
            target.contactIDs.add(row.contact_id)
            if (['confirmed', 'completed'].includes(row.status)) target.converted++
          }
          target.bookings++
          target[row.status === 'pending_approval' ? 'pending' : row.status]++
          if (row.status === 'confirmed' || row.status === 'completed')
            addMoney(target, row.currency, row.expected_minor, 0)
          for (const money of row.money || []) addMoney(target, money.currency, 0, money.total)
        }
        if (stream === 'studio')
          source(group.key, {
            id: row.id,
            stream,
            createdAt: row.created_at.toISOString(),
            href: collectionURL('bookings') + '/' + row.id,
            bookingsHref: collectionURL('bookings') + '/' + row.id,
            moneyHref: collectionURL('revenue-entries', {
              'where[booking][equals]': String(row.id),
            }),
          })
      }
      if (result.rows.length < 1000) break
      afterID = result.rows.at(-1)!.id
    }
    const operational = (
      await db.query<Record<string, number>>(`
      SELECT
        (SELECT count(*)::int FROM enquiries WHERE follow_up='new') AS "newEnquiries",
        (SELECT count(*)::int FROM follow_ups WHERE state IN ('planned','paused','blocked','failed')) AS "waitingFollowUps",
        (SELECT count(*)::int FROM bookings WHERE status='confirmed' AND session_at > transaction_timestamp()) AS "upcomingBookings",
        (SELECT count(*)::int FROM email_messages WHERE status IN ('failed','uncertain','manual','bounced','delayed')) AS "emailFailures",
        (SELECT count(*)::int FROM enquiries WHERE notification_status IN ('failed','manual')) AS "notificationFailures",
        (SELECT count(*)::int FROM bookings WHERE studio_message_state='failed') AS "studioDraftFailures"
    `)
    ).rows[0]
    const occupancy = (
      await db.query<{ capacity: string; allocated: string; slots: number; outside: number }>(
        `
      WITH inventory AS (
        SELECT s.* FROM studio_slots s JOIN studio_days d ON d.id=s.day_id
        WHERE d._status='published' AND d.day_state='scheduled' AND s.revision=d.schedule_revision
          AND s.starts_at >= $1 AND s.starts_at < $2
      ), places AS (
        SELECT s.id,s.capacity,least(s.capacity,count(b.id)) AS allocated FROM inventory s
        LEFT JOIN bookings b ON b.studio_day_id=s.day_id AND b.status IN ('pending_approval','confirmed','completed')
          AND b.session_at < s.occupied_until AND b.occupied_until > s.starts_at GROUP BY s.id,s.capacity
      )
      SELECT coalesce(sum(capacity),0)::text AS capacity, coalesce(sum(allocated),0)::text AS allocated,
        count(*)::int AS slots,
        (SELECT count(*)::int FROM bookings b WHERE b.source='studio_slot'
          AND b.status IN ('pending_approval','confirmed','completed') AND b.session_at >= $1 AND b.session_at < $2
          AND NOT EXISTS(SELECT 1 FROM inventory s WHERE s.day_id=b.studio_day_id
            AND b.session_at < s.occupied_until AND b.occupied_until > s.starts_at)) AS outside
      FROM places
    `,
        [filters.start, filters.until],
      )
    ).rows[0]
    await db.query('COMMIT')
    const sorted = [...groups.values()].sort(
      (a, b) =>
        a.stream.localeCompare(b.stream) ||
        a.label.localeCompare(b.label) ||
        a.key.localeCompare(b.key),
    )
    return {
      filters,
      asOf,
      operational,
      bespoke: metric(totals.bespoke),
      studio: metric(totals.studio),
      occupancy: {
        capacity: amount(occupancy.capacity),
        allocated: amount(occupancy.allocated),
        slots: occupancy.slots,
        outside: occupancy.outside,
      },
      groups: sorted.slice((filters.groupPage - 1) * 20, filters.groupPage * 20).map((group) => ({
        key: group.key,
        label: group.label,
        stream: group.stream,
        metrics: metric(group.values),
      })),
      groupCount: sorted.length,
      selectedGroup: filters.group ? (groups.get(filters.group)?.label ?? null) : null,
      sources,
      sourceCount,
    }
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
}
export type ConversionReport = Awaited<ReturnType<typeof conversionReport>>
export type { ReportFilters }

export async function conversionOverview(
  payload: Payload,
  user: PayloadRequest['user'],
  input: Record<string, unknown>,
) {
  const report = await conversionReport(payload, user, input)
  return { ...report, funnel: await enquiryFunnel(report.filters) }
}
export type ConversionOverviewData = Awaited<ReturnType<typeof conversionOverview>>

export async function firstResponse(
  payload: Payload,
  user: NonNullable<PayloadRequest['user']>,
  enquiry: number,
) {
  await payload.findByID({
    collection: 'enquiries',
    id: enquiry,
    user,
    overrideAccess: false,
    depth: 0,
  })
  const events = await payload.find({
    collection: 'customer-activities',
    user,
    overrideAccess: false,
    depth: 0,
    limit: 1,
    where: {
      and: [
        { enquiry: { equals: enquiry } },
        { source: { equals: 'staff' } },
        { kind: { in: ['first_response_recorded', 'first_response_cleared'] } },
      ],
    },
    sort: ['-createdAt', '-id'],
    select: { kind: true, occurredAt: true },
  })
  const latest = events.docs[0]
  return { recordedAt: latest?.kind === 'first_response_recorded' ? latest.occurredAt : null }
}
