import { limitOperation } from '@/hosting/rate-limit'
import { getPayload } from 'payload'
import config from '@payload-config'
import { boundedJSON, sameOrigin } from '@/inquiries/http'
import { idInput } from '@/customer-records/core'
import { assignExperiment } from '@/experiments/server'
import { experimentContext } from '@/experiments/privacy'

export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const input = (await boundedJSON(request, 256)) as { page?: unknown }
    const page = idInput(input?.page)
    const payload = await getPayload({ config })
    const context = await experimentContext(payload, request)
    if (context.visitor) await limitOperation('experiment-assignment', context.visitor.id, 100)
    const assignment = await assignExperiment(payload, context, page)
    return Response.json(assignment, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // A failed experiment never prevents the original published experience.
    return Response.json(null, { headers: { 'Cache-Control': 'no-store' } })
  }
}
