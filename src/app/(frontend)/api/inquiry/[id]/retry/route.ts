import { getPayload } from 'payload'
import config from '@payload-config'
import { sameOrigin, errorResponse } from '@/inquiries/http'
import { notifyPhotographer } from '@/inquiries/notification'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request)
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return new Response(null, { status: 401 })
    const { id } = await params
    if (!/^\d+$/.test(id)) return new Response(null, { status: 400 })
    const doc = await payload.findByID({
      collection: 'enquiries',
      id: Number(id),
      user,
      overrideAccess: false,
    })
    const status = await notifyPhotographer(payload, doc.id)
    return Response.json({ status })
  } catch (error) {
    return errorResponse(error)
  }
}
