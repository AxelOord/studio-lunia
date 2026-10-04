import 'server-only'
import { draftMode, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { samplePage } from './sample'

export async function getPage(slug: string) {
  if (process.env.LUNIA_SHOWCASE === 'true') return slug === 'home' ? samplePage : notFound()
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ])
  const payload = await getPayload({ config })
  const preview = (await draftMode()).isEnabled
  const user = preview ? (await payload.auth({ headers: await headers() })).user : null
  if (preview && !user) notFound()
  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    draft: preview,
    user,
    overrideAccess: false,
    limit: 1,
    depth: 2,
  })
  return docs[0] ?? notFound()
}
