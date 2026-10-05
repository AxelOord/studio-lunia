import {
  createLocalReq,
  initTransaction,
  commitTransaction,
  killTransaction,
  type Payload,
} from 'payload'

// Local/preview bootstrap only. Existing editor changes are never overwritten.
export async function seedLandingDemo(payload: Payload) {
  const existing = await payload.find({
    collection: 'pages',
    where: { slug: { equals: 'service-demo' } },
    limit: 1,
    draft: true,
    overrideAccess: true,
  })
  if (existing.totalDocs) return
  const req = await createLocalReq({}, payload)
  const owns = await initTransaction(req)
  try {
    const page = await payload.create({
      collection: 'pages',
      req,
      overrideAccess: true,
      data: {
        title: 'Synthetic service landing',
        slug: 'service-demo',
        description:
          'Synthetic service-to-enquiry demonstration. Approved photography and commercial details are still to come.',
        _status: 'published',
        layout: [
          {
            blockType: 'hero',
            eyebrow: 'SYNTHETIC SERVICE PREVIEW',
            heading: 'Start with your portrait idea.',
            body: 'A test journey from a service page to a personal enquiry. Use synthetic details only; this is not a published commercial offer.',
          },
          {
            blockType: 'services',
            heading: 'About this demonstration',
            body: 'This service card is the source for the landing page and form. Replace it with approved service content before any campaign launch.',
            items: [
              {
                title: 'Synthetic portrait enquiry',
                body: 'Share a portrait idea for this synthetic preview. Photographs, inclusions, prices and response timing await approval.',
              },
            ],
          },
        ],
      },
    })
    const block = page.layout.find((block) => block.blockType === 'services')
    const item = block?.blockType === 'services' ? block.items[0] : undefined
    if (!item?.id) throw new Error('Synthetic service could not be initialized.')
    await payload.update({
      collection: 'pages',
      id: page.id,
      req,
      overrideAccess: true,
      data: { inquiryService: `${page.id}:${item.id}`, _status: 'published' },
    })
    if (owns) await commitTransaction(req)
  } catch (error) {
    if (owns) await killTransaction(req)
    throw error
  }
}
