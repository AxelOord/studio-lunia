import { saveCampaign } from '@/inquiries/privacy'
import { boundedJSON, errorResponse, sameOrigin } from '@/inquiries/http'

export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const value = (await boundedJSON(request, 2048)) as Record<string, unknown>
    await saveCampaign(value?.tags, value?.arrival, request)
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return errorResponse(error)
  }
}
