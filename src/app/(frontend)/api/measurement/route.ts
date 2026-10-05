import { getPayload } from 'payload'
import config from '@payload-config'
import { privacyState } from '@/inquiries/privacy'
import { boundedJSON, errorResponse, sameOrigin } from '@/inquiries/http'
import { captureMeasurement } from '@/inquiries/measurement'
import { publishedServices } from '@/inquiries/services'
import { limitOperation } from '@/hosting/rate-limit'

export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const { preferences, session } = await privacyState()
    if (!preferences.analytics || !session) return new Response(null, { status: 204 })
    const value = (await boundedJSON(request, 512)) as Record<string, unknown>
    // Completion is emitted only by the durable enquiry route.
    if (
      !value ||
      (value.event !== 'service_viewed' && value.event !== 'inquiry_started') ||
      typeof value.service !== 'string'
    )
      return new Response(null, { status: 400 })
    await limitOperation('measurement', session, 100)
    const payload = await getPayload({ config })
    if (!(await publishedServices(payload)).some((s) => s.id === value.service))
      return new Response(null, { status: 400 })
    await captureMeasurement(payload, session, value.service, value.event)
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorResponse(error)
  }
}
