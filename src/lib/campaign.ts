import { permittedAttribution } from './attribution'

export const campaignKeys = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_id',
  'utm_content',
  'gclid',
  'gbraid',
  'wbraid',
] as const
export type CampaignTouch = {
  kind: 'tagged' | 'direct' | 'untagged' | 'unknown'
  capturedAt: number
  tags: Partial<Record<(typeof campaignKeys)[number], string>>
}
export type CampaignSnapshot = { first: CampaignTouch; last: CampaignTouch; expiresAt: number }
export const CAMPAIGN_TTL = 30 * 86400_000

export function campaignTouch(input: unknown, arrival: unknown, now = Date.now()): CampaignTouch {
  const tags: CampaignTouch['tags'] = {}
  let supplied = false
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const key of campaignKeys) {
      const value = (input as Record<string, unknown>)[key]
      if (value !== undefined) supplied = true
      // Identifier-only tags. Never retain free text, URLs, email or phone-shaped strings.
      if (
        typeof value === 'string' &&
        /^[a-zA-Z0-9_~-][a-zA-Z0-9_.~-]{0,119}$/.test(value) &&
        !/^\+?[\d.()-]{7,}$/.test(value)
      )
        tags[key] = value
    }
  }
  return {
    kind: Object.keys(tags).length
      ? 'tagged'
      : supplied
        ? 'unknown'
        : arrival === 'direct'
          ? 'direct'
          : arrival === 'untagged'
            ? 'untagged'
            : 'unknown',
    capturedAt: now,
    tags,
  }
}

export function updateCampaign(
  previous: CampaignSnapshot | undefined,
  touch: CampaignTouch,
): CampaignSnapshot {
  if (!previous || previous.expiresAt <= touch.capturedAt)
    return { first: touch, last: touch, expiresAt: touch.capturedAt + CAMPAIGN_TTL }
  // A later untagged internal navigation must not overwrite the last campaign touch.
  return touch.kind === 'tagged' ? { ...previous, last: touch } : previous
}

export function validateCampaign(value: unknown, now = Date.now()): CampaignSnapshot | undefined {
  if (!value || typeof value !== 'object') return
  const data = value as CampaignSnapshot
  if (
    !Number.isFinite(data.expiresAt) ||
    data.expiresAt <= now ||
    data.expiresAt > now + CAMPAIGN_TTL
  )
    return
  for (const touch of [data.first, data.last]) {
    if (
      !touch ||
      !['tagged', 'direct', 'untagged', 'unknown'].includes(touch.kind) ||
      !Number.isFinite(touch.capturedAt) ||
      touch.capturedAt > now ||
      touch.capturedAt < now - CAMPAIGN_TTL
    )
      return
    const clean = campaignTouch(touch.tags, touch.kind, touch.capturedAt)
    if (JSON.stringify(clean) !== JSON.stringify(touch)) return
  }
  return data
}

export function campaignSource(touch: CampaignTouch) {
  return permittedAttribution(new URLSearchParams(touch.tags), 'granted').source
}
