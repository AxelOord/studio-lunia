/** Future storage contract only. No tracking, cookies or platform requests run here. */
export type Consent = 'unknown' | 'denied' | 'granted'
export type Attribution = {
  source: string
  medium?: string
  campaign?: string
  clickIds?: { gclid?: string; gbraid?: string; wbraid?: string }
  consent: Consent
}
export type LeadOutcome = {
  eventId: string
  leadId: string
  occurredAt: string
  kind:
    | 'inquiry_received'
    | 'lead_qualified'
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'revenue_recorded'
  valueMinor?: number
  currency?: string
}
export interface ConversionAdapter {
  platform: string
  deliver(
    event: LeadOutcome,
    attribution: Attribution,
  ): Promise<{ status: 'sent' | 'ineligible' | 'retry'; externalId?: string }>
}

function clean(value: string | null) {
  return value && /^[a-zA-Z0-9_.~-]{1,120}$/.test(value) ? value : undefined
}
export function permittedAttribution(params: URLSearchParams, consent: Consent): Attribution {
  if (consent !== 'granted') return { source: 'unknown', consent }
  const gclid = clean(params.get('gclid'))
  const gbraid = clean(params.get('gbraid'))
  const wbraid = clean(params.get('wbraid'))
  return {
    source: clean(params.get('utm_source')) ?? (gclid || gbraid || wbraid ? 'google' : 'unknown'),
    medium: clean(params.get('utm_medium')),
    campaign: clean(params.get('utm_campaign')),
    clickIds: { gclid, gbraid, wbraid },
    consent,
  }
}
