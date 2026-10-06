import type { Payload, PayloadRequest, TextFieldValidation } from 'payload'
import type { Page } from '../payload-types'
import { servicePattern } from '../lib/inquiry'
import type { ServiceChoice } from '../lib/inquiry'

export async function publishedServices(
  payload: Payload,
  req?: PayloadRequest,
): Promise<ServiceChoice[]> {
  const services: ServiceChoice[] = []
  let page = 1
  let hasNextPage = true
  while (hasNextPage) {
    const result = await payload.find({
      collection: 'pages',
      req,
      overrideAccess: false,
      draft: false,
      where: { _status: { equals: 'published' } },
      depth: 0,
      limit: 100,
      page,
    })
    for (const doc of result.docs)
      for (const block of doc.layout)
        if (block.blockType === 'services')
          for (const item of block.items)
            if (item.id)
              services.push({
                id: `${doc.id}:${item.id}`,
                title: item.title,
                description: item.body,
                inclusions: item.inclusions,
                priceGuidance: item.priceGuidance,
                responseExpectation: item.responseExpectation,
              })
    hasNextPage = result.hasNextPage
    page++
  }
  return services
}

export type LandingPreviewPage = Page & { inquiryOffer: ServiceChoice | null }

export async function resolveLandingPage(
  payload: Payload,
  page: Page,
): Promise<LandingPreviewPage> {
  const inquiryOffer = page.inquiryService
    ? ((await publishedServices(payload)).find((service) => service.id === page.inquiryService) ??
      null)
    : null
  // Ignore any client-provided offer; only published canonical service content is used.
  return { ...page, inquiryOffer }
}

export const validateLandingService: TextFieldValidation = async (value, { data, req, id }) => {
  if (!value) return true
  const page = data as Partial<Page>
  if (typeof value !== 'string' || value.length > 100 || !servicePattern.test(value))
    return 'Choose a published photography service.'
  if (page?._status !== 'published') return true
  if (String(id) === value.split(':')[0] && Array.isArray(page.layout)) {
    const itemID = value.split(':')[1]
    return (
      page.layout.some(
        (block) =>
          block?.blockType === 'services' &&
          Array.isArray(block.items) &&
          block.items.some((item) => item.id === itemID),
      ) || 'This page no longer contains the selected service. Choose another published service.'
    )
  }
  return (
    (await publishedServices(req.payload, req)).some((service) => service.id === value) ||
    'This service is no longer published. Choose a published service before publishing the landing page.'
  )
}
