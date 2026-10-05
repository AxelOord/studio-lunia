import { after } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { boundedJSON, errorResponse, sameOrigin } from '@/inquiries/http'
import { privacyState } from '@/inquiries/privacy'
import { submitInquiry } from '@/inquiries/submit'
import { notifyPhotographer } from '@/inquiries/notification'
import { captureMeasurement } from '@/inquiries/measurement'
import { limitOperation } from '@/hosting/rate-limit'
import { validateInquiry } from '@/lib/inquiry'

export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const input = await boundedJSON(request)
    const { data, errors } = validateInquiry(input)
    if (!data) return Response.json({ errors }, { status: 422 })
    const ip =
      process.env.VERCEL === '1'
        ? (request.headers.get('x-vercel-forwarded-for') ?? 'unknown')
        : 'local'
    await limitOperation('inquiry-ip', ip, 20)
    await limitOperation('inquiry-email', data.email, 5)
    const payload = await getPayload({ config })
    const { preferences, campaign, session } = await privacyState()
    const result = await submitInquiry(payload, input, preferences, campaign)
    if (!result.doc) return Response.json({ errors: result.errors }, { status: 422 })
    const doc = result.doc
    after(async () => {
      try {
        await notifyPhotographer(payload, doc.id)
      } catch {
        /* pending state remains visible for retry */
      }
    })
    // Measurement must never turn a committed enquiry into an apparent failure.
    try {
      await captureMeasurement(
        payload,
        preferences.analytics ? session : undefined,
        doc.serviceId,
        'inquiry_submitted',
      )
    } catch {
      /* best effort, no replay queue */
    }
    return Response.json({ receipt: result.receipt }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorResponse(error)
  }
}
