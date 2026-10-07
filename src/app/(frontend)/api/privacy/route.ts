import { getPayload } from 'payload'
import config from '@payload-config'
import { saveExperimentConsent } from '@/experiments/privacy'
import { privacyState, savePrivacy, ensureMeasurementSession } from '@/inquiries/privacy'
import { boundedJSON, errorResponse, sameOrigin } from '@/inquiries/http'
import { measurementEnabled } from '@/inquiries/measurement'

export async function GET(request: Request) {
  const { preferences } = await privacyState()
  await ensureMeasurementSession(request)
  return Response.json(
    { ...preferences, configured: measurementEnabled() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
export async function POST(request: Request) {
  try {
    sameOrigin(request)
    const value = (await boundedJSON(request, 512)) as Record<string, unknown>
    const preferences = {
      experiments: value?.experiments === true,
      analytics: value?.analytics === true,
      campaigns: value?.campaigns === true,
      decided: true,
    }
    await saveExperimentConsent(await getPayload({ config }), preferences.experiments, request)
    await savePrivacy(preferences, request)
    return Response.json(
      { ...preferences, configured: measurementEnabled() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
