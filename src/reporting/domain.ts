import { campaignSource, campaignTouch, validateCampaign } from '../lib/campaign'

export type Stream = 'bespoke' | 'studio'
export type ReportFilters = {
  from: string
  to: string
  start: string
  until: string
  touch: 'first' | 'last'
  groupBy: 'offers' | 'campaigns'
  groupPage: number
  sourcePage: number
  group: string
  sourceStream: 'all' | Stream
}
export class ReportInputError extends Error {}
export function reportFilters(input: Record<string, unknown>, now = new Date()): ReportFilters {
  const today = now.toISOString().slice(0, 10)
  const first = new Date(Date.parse(today) - 29 * 86400000).toISOString().slice(0, 10)
  function date(value: unknown, fallback: string) {
    const text = value === undefined ? fallback : value
    if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text))
      throw new ReportInputError('Choose valid UTC dates.')
    const stamp = Date.parse(text + 'T00:00:00.000Z')
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== text)
      throw new ReportInputError('Choose valid UTC dates.')
    return text
  }
  const from = date(input.from, first),
    to = date(input.to, today)
  const duration = Date.parse(to) - Date.parse(from)
  if (duration < 0 || duration >= 366 * 86400000)
    throw new ReportInputError('Choose an ordered period of at most 366 calendar days.')
  const touch = input.touch ?? 'last',
    groupBy = input.groupBy ?? 'offers'
  if (touch !== 'first' && touch !== 'last')
    throw new ReportInputError('Choose first or last attribution.')
  if (groupBy !== 'offers' && groupBy !== 'campaigns')
    throw new ReportInputError('Choose a valid breakdown.')
  function page(value: unknown) {
    if (value === undefined) return 1
    if (!/^\d{1,5}$/.test(String(value)) || Number(value) < 1 || Number(value) > 10000)
      throw new ReportInputError('Choose a valid report page.')
    return Number(value)
  }
  const group = input.group ?? ''
  if (typeof group !== 'string' || group.length > 600)
    throw new ReportInputError('Choose a valid report group.')
  const sourceStream = input.sourceStream ?? 'all'
  if (!['all', 'bespoke', 'studio'].includes(String(sourceStream)))
    throw new ReportInputError('Choose a valid source stream.')
  return {
    from,
    to,
    start: from + 'T00:00:00.000Z',
    until: new Date(Date.parse(to) + 86400000).toISOString(),
    touch,
    groupBy,
    groupPage: page(input.groupPage),
    sourcePage: page(input.sourcePage),
    group,
    sourceStream: sourceStream as 'all' | Stream,
  }
}

export function campaignBucket(value: unknown, touch: 'first' | 'last') {
  const unknown = { key: 'unknown', label: 'Unknown attribution', eligible: false }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unknown
  const data = value as Record<string, unknown>
  if (data.status === 'withheld' || data.consent === 'denied')
    return { key: 'withheld', label: 'Withheld · no campaign consent', eligible: false }
  if (data.consent !== 'granted' || !data.snapshot || typeof data.snapshot !== 'object')
    return unknown
  const candidate = data.snapshot as Record<string, unknown>
  function savedTouch(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const item = value as Record<string, unknown>
    if (
      Object.keys(item).some((key) => !['kind', 'capturedAt', 'tags'].includes(key)) ||
      typeof item.capturedAt !== 'number' ||
      !Number.isFinite(item.capturedAt) ||
      !item.tags ||
      typeof item.tags !== 'object' ||
      Array.isArray(item.tags)
    )
      return
    const tags = item.tags as Record<string, unknown>
    const clean = campaignTouch(tags, item.kind, item.capturedAt)
    if (
      clean.kind !== item.kind ||
      Object.keys(tags).length !== Object.keys(clean.tags).length ||
      Object.entries(clean.tags).some(([key, value]) => tags[key] !== value)
    )
      return
    return clean
  }
  const first = savedTouch(candidate.first),
    last = savedTouch(candidate.last)
  if (!first || !last) return unknown
  // Validate at the frozen snapshot's capture time, not today's browser-cookie expiry.
  const captured = Math.max(first.capturedAt, last.capturedAt)
  if (!Number.isFinite(captured) || captured > Date.now()) return unknown
  const snapshot = validateCampaign({ first, last, expiresAt: candidate.expiresAt }, captured)
  if (!snapshot) return unknown
  const selected = snapshot[touch]
  if (selected.kind !== 'tagged')
    return {
      key: selected.kind,
      label: { direct: 'Direct', untagged: 'Untagged arrival', unknown: 'Unknown attribution' }[
        selected.kind
      ],
      eligible: false,
    }
  const source = campaignSource(selected)
  const campaign = selected.tags.utm_id || selected.tags.utm_campaign || ''
  return {
    key: JSON.stringify(['tagged', source, campaign]),
    label: `${source} · ${campaign || 'campaign unidentified'}`,
    eligible: true,
  }
}

export type Money = { currency: string; expected: number; recorded: number }
export type Metric = {
  intents: number
  contacts: number
  unlinked: number
  qualified: number
  converted: number
  bookings: number
  proposed: number
  pending: number
  confirmed: number
  completed: number
  cancelled: number
  responded: number
  medianResponseHours: number | null
  cancellation: { numerator: number; denominator: number }
  money: Money[]
}
export type Accumulator = ReturnType<typeof accumulator>
export function accumulator() {
  return {
    intents: 0,
    contactIDs: new Set<number>(),
    unlinked: 0,
    qualified: 0,
    converted: 0,
    bookings: 0,
    proposed: 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    responseHours: [] as number[],
    money: new Map<string, Money>(),
  }
}
export function amount(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string')
    throw new Error('Invalid recorded amount.')
  const number = Number(value)
  if (!Number.isSafeInteger(number)) throw new Error('Report amount exceeds safe precision.')
  return number
}
export function addMoney(
  target: Accumulator,
  currency: string,
  expected: unknown,
  recorded: unknown,
) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid recorded currency.')
  const previous = target.money.get(currency) || { currency, expected: 0, recorded: 0 }
  target.money.set(currency, {
    currency,
    expected: amount(previous.expected + amount(expected)),
    recorded: amount(previous.recorded + amount(recorded)),
  })
}
export function metric(value: Accumulator): Metric {
  const times = [...value.responseHours].sort((a, b) => a - b)
  const middle = Math.floor(times.length / 2)
  return {
    intents: value.intents,
    contacts: value.contactIDs.size,
    unlinked: value.unlinked,
    qualified: value.qualified,
    converted: value.converted,
    bookings: value.bookings,
    proposed: value.proposed,
    pending: value.pending,
    confirmed: value.confirmed,
    completed: value.completed,
    cancelled: value.cancelled,
    responded: times.length,
    medianResponseHours: times.length
      ? (times[middle] + times[Math.floor((times.length - 1) / 2)]) / 2
      : null,
    cancellation: {
      numerator: value.cancelled,
      denominator: value.confirmed + value.completed + value.cancelled,
    },
    money: [...value.money.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
  }
}
export function reportURL(filters: ReportFilters, patch: Record<string, string | number> = {}) {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    touch: filters.touch,
    groupBy: filters.groupBy,
    groupPage: String(filters.groupPage),
    sourcePage: String(filters.sourcePage),
    group: filters.group,
    sourceStream: filters.sourceStream,
  })
  for (const [key, value] of Object.entries(patch)) params.set(key, String(value))
  return '/admin/conversions?' + params.toString()
}
