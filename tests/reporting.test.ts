import { test, expect, vi } from 'vitest'
import {
  accumulator,
  addMoney,
  campaignBucket,
  metric,
  reportFilters,
} from '../src/reporting/domain'
import { campaignTouch, updateCampaign } from '../src/lib/campaign'
import { leadAttribution } from '../src/inquiries/privacy'
import { enquiryFunnel } from '../src/reporting/posthog'

test('UTC creation periods have exact inclusive-day bounds and reject malformed or excessive filters', () => {
  const now = new Date('2026-10-06T23:59:59Z')
  expect(reportFilters({}, now)).toMatchObject({
    from: '2026-09-07',
    to: '2026-10-06',
    start: '2026-09-07T00:00:00.000Z',
    until: '2026-10-07T00:00:00.000Z',
  })
  expect(reportFilters({ from: '2024-01-01', to: '2024-12-31' }).until).toBe(
    '2025-01-01T00:00:00.000Z',
  )
  for (const input of [
    { from: '2026-02-30' },
    { from: '2026-10-07', to: '2026-10-06' },
    { from: '2024-01-01', to: '2025-01-01' },
    { from: "2026-01-01' OR true" },
    { touch: 'anything' },
    { groupBy: 'anything' },
    { sourcePage: '0' },
    { groupPage: '10001' },
    { sourceStream: 'someone' },
    { group: 'x'.repeat(601) },
  ])
    expect(() => reportFilters(input, now)).toThrow()
})
test('historical campaign reporting preserves first/last buckets without retaining click IDs or expired browser state', () => {
  const at = Date.parse('2025-01-01T12:00:00Z')
  const first = campaignTouch({ utm_source: 'newsletter', utm_campaign: 'winter' }, 'unknown', at)
  const last = campaignTouch(
    { utm_source: 'google', utm_id: 'spring_01', gclid: 'SecretClickMarker' },
    'unknown',
    at + 1000,
  )
  const attribution = leadAttribution(
    { decided: true, campaigns: true, analytics: false },
    updateCampaign(updateCampaign(undefined, first), last),
  )
  expect(campaignBucket(attribution, 'first').label).toContain('winter')
  expect(campaignBucket(attribution, 'last').label).toContain('spring_01')
  const reordered = structuredClone(attribution)
  const saved = reordered.snapshot!.last
  reordered.snapshot!.last = { tags: saved.tags, capturedAt: saved.capturedAt, kind: saved.kind }
  expect(campaignBucket(reordered, 'last')).toEqual(campaignBucket(attribution, 'last'))
  expect(JSON.stringify(campaignBucket(attribution, 'last'))).not.toContain('SecretClickMarker')
  expect(campaignBucket({ ...attribution, consent: 'denied' }, 'last').key).toBe('withheld')
  expect(campaignBucket({}, 'last').key).toBe('unknown')
  for (const kind of ['direct', 'untagged', 'unknown']) {
    const saved = leadAttribution(
      { decided: true, campaigns: true, analytics: false },
      updateCampaign(undefined, campaignTouch({}, kind, at)),
    )
    expect(campaignBucket(saved, 'last').key).toBe(kind)
  }
  const forged = structuredClone(attribution)
  forged.snapshot!.last.tags.utm_campaign = 'private@example.test'
  expect(campaignBucket(forged, 'last').key).toBe('unknown')
})
test('value, response and cancellation calculations preserve their denominators and currency precision', () => {
  const data = accumulator()
  data.confirmed = 2
  data.completed = 1
  data.cancelled = 1
  data.pending = 5
  data.proposed = 4
  data.responseHours.push(1, 9, 3, 7)
  data.contactIDs.add(1)
  data.contactIDs.add(1)
  addMoney(data, 'EUR', 20000, 10000)
  addMoney(data, 'EUR', 0, -2000)
  addMoney(data, 'JPY', 5000, 4000)
  expect(metric(data)).toMatchObject({
    contacts: 1,
    medianResponseHours: 5,
    cancellation: { numerator: 1, denominator: 4 },
    money: [
      { currency: 'EUR', expected: 20000, recorded: 8000 },
      { currency: 'JPY', expected: 5000, recorded: 4000 },
    ],
  })
  expect(metric(accumulator()).medianResponseHours).toBeNull()
  expect(() => addMoney(data, 'EUR', Number.MAX_SAFE_INTEGER, 0)).toThrow(/precision/)
})
const filters = reportFilters({ from: '2026-09-01', to: '2026-09-30' })
const env = {
  LUNIA_POSTHOG_REPORTING_ENABLED: 'true',
  POSTHOG_REPORT_PROJECT_ID: '123',
  POSTHOG_QUERY_READ_KEY: 'SyntheticPrivateKeyMarker',
}
const results = ['service_viewed', 'inquiry_started', 'inquiry_submitted'].map((event, order) => ({
  action_id: event,
  name: event,
  order,
  count: [100, 40, 20][order],
  people: ['PrivatePersonMarker'],
}))
test('aggregate reporting makes no provider call by default or with incomplete/unsafe configuration', async () => {
  const send = vi.fn<typeof fetch>()
  expect(await enquiryFunnel(filters, {}, send)).toEqual({ state: 'disabled' })
  expect(
    await enquiryFunnel(filters, { ...env, LUNIA_POSTHOG_REPORTING_ENABLED: 'false' }, send),
  ).toEqual({ state: 'disabled' })
  for (const patch of [
    { POSTHOG_QUERY_READ_KEY: '' },
    { POSTHOG_REPORT_PROJECT_ID: '../other' },
    { POSTHOG_REPORT_PROJECT_ID: '' },
  ])
    expect(await enquiryFunnel(filters, { ...env, ...patch }, send)).toEqual({
      state: 'unavailable',
    })
  expect(send).not.toHaveBeenCalled()
})
test('EU funnel reader sends a fixed aggregate query and returns counts only', async () => {
  const send = vi.fn<typeof fetch>(async () =>
    Response.json({ results, properties: { email: 'PrivateCustomerMarker' } }),
  )
  const output = await enquiryFunnel(filters, env, send)
  expect(output).toEqual({ state: 'ready', counts: [100, 40, 20] })
  expect(send).toHaveBeenCalledOnce()
  const [url, options] = send.mock.calls[0]
  expect(url).toBe('https://eu.posthog.com/api/projects/123/query/')
  expect(options).toMatchObject({ method: 'POST', cache: 'no-store', redirect: 'error' })
  const body = JSON.parse(String(options?.body))
  expect(body.query).toMatchObject({
    kind: 'FunnelsQuery',
    dateRange: { date_from: filters.start, date_to: '2026-09-30T23:59:59.999Z' },
    series: results.map((row) => ({ kind: 'EventsNode', event: row.name })),
    funnelsFilter: {
      funnelOrderType: 'ordered',
      funnelWindowInterval: 24,
      funnelWindowIntervalUnit: 'hour',
    },
  })
  expect(JSON.stringify(output)).not.toMatch(/Private|email|people|properties|key/)
})
test('partial, malformed, oversized and failed provider responses remain unavailable and redact details', async () => {
  for (const data of [
    { results: [] },
    { results, query_status: { complete: false } },
    { results: [results[0], { ...results[1], count: 101 }, results[2]] },
    { results: [results[0], { ...results[1], count: 1.5 }, results[2]] },
    { results: [results[0], { ...results[1], action_id: 'another_event' }, results[2]] },
    { results: [results[0], { ...results[1], order: 0 }, results[2]] },
  ]) {
    expect(await enquiryFunnel(filters, env, async () => Response.json(data))).toEqual({
      state: 'unavailable',
    })
  }
  for (const response of [
    new Response('PrivateErrorMarker', { status: 403 }),
    new Response('x'.repeat(65000)),
    new Response('not json'),
  ])
    expect(await enquiryFunnel(filters, env, async () => response)).toEqual({
      state: 'unavailable',
    })
  expect(
    await enquiryFunnel(filters, env, async () => {
      throw new Error('SyntheticPrivateKeyMarker')
    }),
  ).toEqual({ state: 'unavailable' })
})
