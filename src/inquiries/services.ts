import type { Payload } from 'payload'
import type { ServiceChoice } from '../lib/inquiry'

export async function publishedServices(payload: Payload): Promise<ServiceChoice[]> {
  const services: ServiceChoice[] = []
  let page = 1
  let hasNextPage = true
  while (hasNextPage) {
    const result = await payload.find({
      collection: 'pages',
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
            if (item.id) services.push({ id: `${doc.id}:${item.id}`, title: item.title })
    hasNextPage = result.hasNextPage
    page++
  }
  return services
}
