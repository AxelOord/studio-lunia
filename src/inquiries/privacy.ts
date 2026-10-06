import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import {
  campaignTouch,
  campaignSource,
  updateCampaign,
  validateCampaign,
  type CampaignSnapshot,
} from '../lib/campaign'
import { uuidPattern } from '../lib/inquiry'

export const preferenceCookie = 'lunia_preferences'
export const campaignCookie = 'lunia_campaign'
export const measurementCookie = 'lunia_measurement'
export type Preferences = {
  experiments?: boolean
  analytics: boolean
  campaigns: boolean
  decided: boolean
}
export const denied: Preferences = { analytics: false, campaigns: false, decided: false }
const day = 86400

export function seal(purpose: string, value: unknown, ttl: number, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ value, expires: now + ttl * 1000 })).toString(
    'base64url',
  )
  const mac = createHmac('sha256', process.env.PAYLOAD_SECRET!)
    .update(`${purpose}:${body}`)
    .digest('base64url')
  return `${body}.${mac}`
}
export function unseal(purpose: string, input: string | undefined, now = Date.now()): unknown {
  if (!input || input.length > 3800) return
  const [body, mac, extra] = input.split('.')
  if (!body || !mac || extra || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]{43}$/.test(mac))
    return
  const expected = createHmac('sha256', process.env.PAYLOAD_SECRET!)
    .update(`${purpose}:${body}`)
    .digest('base64url')
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected)))
    return
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!Number.isFinite(data.expires) || data.expires <= now) return
    return data.value
  } catch {
    return
  }
}
export function readPreferences(raw?: string): Preferences {
  const value = unseal(preferenceCookie, raw) as Preferences | undefined
  return value &&
    typeof value.analytics === 'boolean' &&
    typeof value.campaigns === 'boolean' &&
    value.decided === true
    ? { ...value, experiments: value.experiments === true }
    : denied
}
export async function privacyState() {
  const jar = await cookies()
  const preferences = readPreferences(jar.get(preferenceCookie)?.value)
  const session = preferences.analytics
    ? unseal(measurementCookie, jar.get(measurementCookie)?.value)
    : undefined
  const campaign = preferences.campaigns
    ? validateCampaign(unseal(campaignCookie, jar.get(campaignCookie)?.value))
    : undefined
  return {
    preferences,
    session: typeof session === 'string' && uuidPattern.test(session) ? session : undefined,
    campaign,
  }
}
export async function savePrivacy(preferences: Preferences, request: Request) {
  const jar = await cookies()
  const options = {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
  }
  jar.set(preferenceCookie, seal(preferenceCookie, preferences, 180 * day), {
    ...options,
    maxAge: 180 * day,
  })
  if (!preferences.campaigns) jar.delete(campaignCookie)
  if (!preferences.analytics) jar.delete(measurementCookie)
  else if (!unseal(measurementCookie, jar.get(measurementCookie)?.value))
    jar.set(measurementCookie, seal(measurementCookie, randomUUID(), day), options)
}
export async function ensureMeasurementSession(request: Request) {
  const { preferences, session } = await privacyState()
  if (!preferences.analytics || session) return
  ;(await cookies()).set(measurementCookie, seal(measurementCookie, randomUUID(), day), {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
  })
}
export async function saveCampaign(input: unknown, arrival: unknown, request: Request) {
  const { preferences, campaign } = await privacyState()
  if (!preferences.campaigns) return
  const next = updateCampaign(campaign, campaignTouch(input, arrival))
  // Preserve the original 30-day deadline, including on repeat visits.
  const seconds = Math.max(1, Math.floor((next.expiresAt - Date.now()) / 1000))
  const value = seal(campaignCookie, next, seconds)
  if (value.length > 3800) return
  ;(await cookies()).set(campaignCookie, value, {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: seconds,
  })
}
export function leadAttribution(preferences: Preferences, campaign?: CampaignSnapshot) {
  return {
    version: 1,
    consent: preferences.campaigns ? 'granted' : preferences.decided ? 'denied' : 'unknown',
    status: !preferences.campaigns ? 'withheld' : campaign ? campaign.last.kind : 'unknown',
    source:
      preferences.campaigns && campaign
        ? campaign.last.kind === 'direct'
          ? 'direct'
          : campaignSource(campaign.last)
        : 'unknown',
    ...(preferences.campaigns && campaign ? { snapshot: campaign } : {}),
  }
}
