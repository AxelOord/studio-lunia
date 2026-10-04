import { draftMode } from 'next/headers'
import { NextRequest } from 'next/server'
import { validSlug } from '@/lib/validation'
export async function GET(request: NextRequest) {
  if (process.env.LUNIA_SHOWCASE === 'true')
    return new Response('CMS preview unavailable', { status: 503 })
  const slug = request.nextUrl.searchParams.get('slug')
  if (!validSlug(slug)) return new Response('Invalid page slug', { status: 400 })
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ])
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return new Response('Sign in to preview drafts', { status: 401 })
  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    user,
    overrideAccess: false,
    draft: true,
    limit: 1,
  })
  if (!docs.length) return new Response('Page not found', { status: 404 })
  ;(await draftMode()).enable()
  return new Response(null, {
    status: 307,
    headers: { Location: slug === 'home' ? '/' : `/${slug}`, 'Cache-Control': 'private, no-store' },
  })
}
