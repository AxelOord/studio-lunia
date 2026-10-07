import { getPayload } from 'payload'
import config from '@payload-config'
import { conversionOverview, firstResponse } from '@/reporting/queries'
import { ReportInputError } from '@/reporting/domain'
import { idInput, recordsError } from '@/customer-records/core'

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (process.env.LUNIA_SHOWCASE === 'true') return new Response(null, { status: 503, headers })
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return new Response(null, { status: 401, headers })
    const params = new URL(request.url).searchParams
    return Response.json(
      params.has('responseFor')
        ? await firstResponse(payload, user, idInput(Number(params.get('responseFor'))))
        : await conversionOverview(payload, user, Object.fromEntries(params)),
      { headers },
    )
  } catch (error) {
    if (error instanceof ReportInputError)
      return Response.json({ error: error.message }, { status: 422, headers })
    return recordsError(error)
  }
}
