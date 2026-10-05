import { getPayload } from 'payload'
import config from '@payload-config'
import { boundedJSON, sameOrigin } from '@/inquiries/http'
import { idInput, object, recordsError } from '@/customer-records/core'
import { recordOperation } from '@/customer-records/operations'
import { customerView, searchContacts } from '@/customer-records/queries'
import { prepareEmail, sendEmailMessage } from '@/customer-records/mail'

export async function GET(request: Request) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return new Response(null, { status: 401 })
    const params = new URL(request.url).searchParams
    if (params.has('contact'))
      return Response.json(
        await customerView(payload, user, idInput(Number(params.get('contact')))),
        { headers: { 'Cache-Control': 'no-store' } },
      )
    if (params.has('booking')) {
      const id = idInput(Number(params.get('booking')))
      const booking = await payload.findByID({
        collection: 'bookings',
        id,
        user,
        overrideAccess: false,
        depth: 0,
      })
      const entries = await payload.find({
        collection: 'revenue-entries',
        where: { booking: { equals: id } },
        user,
        overrideAccess: false,
        depth: 0,
        limit: 100,
        sort: '-createdAt',
      })
      const total = await payload.db.pool.query<{ total: string }>(
        'SELECT coalesce(sum(amount_minor), 0) AS total FROM revenue_entries WHERE booking_id = $1',
        [id],
      )
      return Response.json(
        {
          booking,
          entries: entries.docs,
          realisedMinor: Number(total.rows[0].total),
          truncated: entries.hasNextPage,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    if (params.has('message')) {
      const id = idInput(Number(params.get('message')))
      const message = await payload.findByID({
        collection: 'email-messages',
        id,
        user,
        overrideAccess: false,
        depth: 0,
      })
      const events = await payload.db.pool.query(
        'SELECT kind, occurred_at, received_at FROM email_delivery_events WHERE message_id = $1 ORDER BY occurred_at DESC, event_id LIMIT 100',
        [id],
      )
      return Response.json(
        { message, events: events.rows },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const templates = await payload.find({
      collection: 'email-templates',
      where: { approved: { equals: true } },
      user,
      overrideAccess: false,
      depth: 0,
      limit: 100,
      select: { name: true, kind: true },
    })
    return Response.json(
      { templates: templates.docs },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return recordsError(error)
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return new Response(null, { status: 401 })
    const input = object(await boundedJSON(request))
    if (input.action === 'search')
      return Response.json(
        await searchContacts(
          payload,
          user,
          typeof input.query === 'string' ? input.query.slice(0, 100) : '',
          typeof input.filter === 'string' ? input.filter : 'all',
        ),
        { headers: { 'Cache-Control': 'no-store' } },
      )
    if (input.action === 'prepareEmail' || input.action === 'prepareTestEmail')
      return Response.json(await prepareEmail(payload, user, input), {
        headers: { 'Cache-Control': 'no-store' },
      })
    if (input.action === 'sendEmail') {
      const message = await payload.findByID({
        collection: 'email-messages',
        id: idInput(input.message),
        user,
        overrideAccess: false,
        depth: 0,
      })
      return Response.json(
        { status: await sendEmailMessage(payload, message.id) },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return Response.json(await recordOperation(payload, user, input), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return recordsError(error)
  }
}
