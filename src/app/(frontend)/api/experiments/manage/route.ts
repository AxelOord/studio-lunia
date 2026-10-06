import { cookies } from 'next/headers'
import { APIError, getPayload } from 'payload'
import config from '@payload-config'
import { boundedJSON, sameOrigin } from '@/inquiries/http'
import { seal } from '@/inquiries/privacy'
import { idInput, object, recordsError, relationID } from '@/customer-records/core'
import { authorizeExperiments, retainExperimentVariant } from '@/experiments/server'
import { simulationCookie } from '@/experiments/domain'

export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    await authorizeExperiments(payload, user, 'update')
    const input = object(await boundedJSON(request, 512))
    const id = idInput(input.id)
    let href = '/admin/experiments'
    if (input.action === 'simulate') {
      const doc = await payload.findByID({
        collection: 'experiments',
        id,
        user,
        overrideAccess: false,
        depth: 0,
      })
      if (doc.mode !== 'simulation' || doc.state !== 'ready')
        throw new APIError('Prepare a simulation first.', 422)
      const page = await payload.findByID({
        collection: 'pages',
        id: relationID(doc.page)!,
        user,
        overrideAccess: false,
        draft: false,
      })
      if (page._status !== 'published') throw new APIError('The landing must be published.', 422)
      ;(await cookies()).set(simulationCookie, seal(simulationCookie, id, 3600), {
        httpOnly: true,
        sameSite: 'lax',
        secure: new URL(request.url).protocol === 'https:',
        path: '/',
        maxAge: 3600,
      })
      href = page.slug === 'home' ? '/' : '/' + page.slug
    } else if (input.action === 'stop') {
      await payload.update({
        collection: 'experiments',
        id,
        user,
        overrideAccess: false,
        data: { state: 'stopped' },
      })
    } else if (
      input.action === 'retain' &&
      (input.variant === 'control' || input.variant === 'treatment')
    ) {
      const page = await retainExperimentVariant(payload, user, id, input.variant)
      href = '/admin/collections/pages/' + page
    } else throw new APIError('Choose a valid experiment action.', 422)
    return Response.json({ href }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return recordsError(error)
  }
}
