import { convertExperiment } from '@/experiments/server'
import { experimentContext } from '@/experiments/privacy'
import { after } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { boundedJSON, errorResponse, sameOrigin } from '@/inquiries/http'
import { privacyState } from '@/inquiries/privacy'
import { submitInquiry } from '@/inquiries/submit'
import { notifyPhotographer } from '@/inquiries/notification'
import { captureMeasurement } from '@/inquiries/measurement'
import { limitOperation } from '@/hosting/rate-limit'
import { object } from '@/customer-records/core'
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
    const privacy = await privacyState()
    const { campaign, session } = privacy
    const permissions = object(input)
    const preferences = {
      ...privacy.preferences,
      campaigns: privacy.preferences.campaigns && permissions.campaignsAllowed !== false,
      analytics: privacy.preferences.analytics && permissions.analyticsAllowed !== false,
    }
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
      // A retry can confirm an older lead after consent/session changes. It must
      // never backfill a pre-consent submission or emit a second completion.
      if (result.created) {
        await captureMeasurement(
          payload,
          preferences.analytics ? session : undefined,
          doc.serviceId,
          'inquiry_submitted',
        )
      }
    } catch {
      /* best effort, no replay queue */
    }
    try {
      if (permissions.experimentsAllowed !== false)
        await convertExperiment(
          payload,
          await experimentContext(payload, request),
          doc.serviceId,
          result.created,
        )
    } catch {
      /* Best effort; never backfill a committed enquiry after consent changes. */
    }
    return Response.json({ receipt: result.receipt }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorResponse(error)
  }
}
