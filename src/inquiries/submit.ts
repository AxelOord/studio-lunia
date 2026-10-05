import { createHmac } from 'node:crypto'
import { APIError, type Payload } from 'payload'
import { validateInquiry } from '../lib/inquiry'
import { inquiryContext } from './access'
import { publishedServices } from './services'
import { leadAttribution, type Preferences } from './privacy'
import type { CampaignSnapshot } from '../lib/campaign'

function digest(value: string) {
  return createHmac('sha256', process.env.PAYLOAD_SECRET!).update(value).digest('hex')
}
export async function submitInquiry(
  payload: Payload,
  input: unknown,
  preferences: Preferences,
  campaign?: CampaignSnapshot,
) {
  const { data, errors } = validateInquiry(input)
  if (!data) return { errors }
  const key = digest(`submission:${data.submissionId}`)
  const contentHash = digest(JSON.stringify([data.service, data.name, data.email, data.message]))
  const context = inquiryContext(key)
  const existing = async () =>
    (
      await payload.find({
        collection: 'enquiries',
        where: { submissionHash: { equals: key } },
        context,
        overrideAccess: false,
        limit: 1,
        depth: 0,
      })
    ).docs[0]
  let doc = await existing()
  if (doc && doc.contentHash !== contentHash) throw new APIError('Conflicting submission.', 409)
  if (!doc) {
    const service = (await publishedServices(payload)).find((s) => s.id === data.service)
    if (!service)
      return {
        errors: {
          service:
            'This service is no longer available. Choose another service or try again later.',
        },
      }
    try {
      doc = await payload.create({
        collection: 'enquiries',
        overrideAccess: false,
        context,
        data: {
          followUp: 'new',
          notificationStatus: 'pending',
          notificationAttempts: 0,
          serviceId: service.id,
          serviceTitle: service.title,
          name: data.name,
          email: data.email,
          message: data.message,
          submissionHash: key,
          contentHash,
          attribution: leadAttribution(preferences, campaign),
        },
      })
    } catch (error) {
      doc = await existing()
      if (!doc) throw error
      if (doc.contentHash !== contentHash) throw new APIError('Conflicting submission.', 409)
    }
  }
  return { doc, receipt: key.slice(0, 12).toUpperCase() }
}
