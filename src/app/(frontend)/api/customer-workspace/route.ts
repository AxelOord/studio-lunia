import { createLocalReq, getPayload } from 'payload'
import config from '@payload-config'
import { boundedJSON, sameOrigin } from '@/inquiries/http'
import { idInput, object, recordsError } from '@/customer-records/core'
import { followUpOperation, followUpQueue, renderPlan } from '@/followups/operations'
import { inbox, workspace } from '@/followups/queries'
const headers = { 'Cache-Control': 'no-store' }
export async function GET(request: Request) {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return new Response(null, { status: 401 })
    const params = new URL(request.url).searchParams
    if (params.has('contact'))
      return Response.json(
        await workspace(payload, user, idInput(Number(params.get('contact'))), {
          enquiry: params.get('enquiry'),
          plan: params.get('plan'),
        }),
        { headers },
      )
    const page = Math.min(10000, Math.max(1, Number(params.get('page')) || 1))
    const plans = await payload.find({
      collection: 'follow-ups',
      user,
      overrideAccess: false,
      depth: 1,
      limit: 20,
      page,
      sort: 'plannedAt',
    })
    return Response.json(plans, { headers })
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
    if (input.action === 'inbox')
      return Response.json(await inbox(payload, user, input), { headers })
    if (input.action === 'previewFollowUp') {
      const req = await createLocalReq({ user }, payload)
      return Response.json(await renderPlan(req, input), { headers })
    }
    if (input.action === 'runSimulations') {
      // Deliberately manual, bounded and server-selected. No cron or live transport.
      // Payload stores leases/retry times; handler rechecks every current stop condition.
      await payload.jobs.run({
        queue: followUpQueue,
        limit: 10,
        overrideAccess: true,
        silent: true,
      })
      return Response.json({ status: 'Simulation batch checked. No email sent.' }, { headers })
    }
    return Response.json(await followUpOperation(payload, user, input), { headers })
  } catch (error) {
    return recordsError(error)
  }
}
