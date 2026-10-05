import 'server-only'
import { draftMode, headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { blockPreviewPage } from './block-preview'

export async function getPage(slug: string) {
  if (process.env.LUNIA_SHOWCASE === 'true')
    return slug === 'home' || slug === 'blocks'
      ? { page: blockPreviewPage(slug), editorPreview: false }
      : notFound()
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
  // Only this authenticated server path can allow private media in the renderer.
  return { page: docs[0] ?? notFound(), editorPreview: preview && Boolean(user) }
}
