import { limitOperation } from '@/hosting/rate-limit'
import { getPayload } from 'payload'
import config from '@payload-config'
import { boundedJSON, sameOrigin } from '@/inquiries/http'
import { idInput, recordsError } from '@/customer-records/core'
import { exposeExperiment } from '@/experiments/server'
import { experimentContext } from '@/experiments/privacy'

export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const input = (await boundedJSON(request, 256)) as { experiment?: unknown; page?: unknown }
    const experiment = idInput(input?.experiment),
      page = idInput(input?.page)
    const payload = await getPayload({ config })
    const context = await experimentContext(payload, request)
    if (context.visitor) await limitOperation('experiment-exposure', context.visitor.id, 100)
    await exposeExperiment(payload, context, experiment, page)
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return recordsError(error)
  }
}
