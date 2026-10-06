import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveLandingPage } from '@/inquiries/services'

// Native preview's population hook is read-only. Require an editor even when the
// underlying page is published, so an expired session cannot continue previewing.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = { 'Cache-Control': 'private, no-store' }
  // Next may use an internal hostname in request.url behind its server proxy.
  const protocol =
    request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.slice(0, -1)
  const origin = `${protocol}://${request.headers.get('host')}`
  if (request.headers.get('origin') !== origin)
    return new Response('Invalid preview origin', { status: 403, headers })
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return new Response('Sign in to preview', { status: 401, headers })
  if (!/^\d+$/.test(id)) return new Response('Page not found', { status: 404, headers })
  const saved = await payload.findByID({
    collection: 'pages',
    id,
    user,
    overrideAccess: false,
    draft: true,
    depth: 0,
    disableErrors: true,
  })
  if (!saved) return new Response('Page not found', { status: 404, headers })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid preview data', { status: 400, headers })
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !('data' in body) ||
    !body.data ||
    typeof body.data !== 'object' ||
    Array.isArray(body.data)
  )
    return new Response('Invalid preview data', { status: 400, headers })
  // Fixed collection, ID, depth and access; ignore client population options.
  const page = await payload.findByID({
    collection: 'pages',
    id,
    user,
    overrideAccess: false,
    depth: 2,
    data: { ...body.data, id: saved.id },
  })
  return Response.json(await resolveLandingPage(payload, page), { headers })
}
