import type { ReportFilters } from './domain'

const events = ['service_viewed', 'inquiry_started', 'inquiry_submitted'] as const
export type FunnelResult =
  | { state: 'disabled' | 'unavailable'; counts?: never }
  | { state: 'ready'; counts: [number, number, number] }

export async function enquiryFunnel(
  filters: Pick<ReportFilters, 'start' | 'until'>,
  env: Record<string, string | undefined> = process.env,
  send: typeof fetch = fetch,
): Promise<FunnelResult> {
  if (env.LUNIA_POSTHOG_REPORTING_ENABLED !== 'true') return { state: 'disabled' }
  const project = env.POSTHOG_REPORT_PROJECT_ID,
    key = env.POSTHOG_QUERY_READ_KEY
  if (!project || !/^\d{1,12}$/.test(project) || !key) return { state: 'unavailable' }
  try {
    const response = await send(`https://eu.posthog.com/api/projects/${project}/query/`, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query: {
          kind: 'FunnelsQuery',
          dateRange: {
            date_from: filters.start,
            date_to: new Date(Date.parse(filters.until) - 1).toISOString(),
          },
          series: events.map((event) => ({ kind: 'EventsNode', event })),
          funnelsFilter: {
            funnelOrderType: 'ordered',
            funnelWindowInterval: 24,
            funnelWindowIntervalUnit: 'hour',
          },
        },
        name: 'Studio Lunia consented enquiry funnel',
        refresh: 'blocking',
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (
      !response.ok ||
      !response.body ||
      Number(response.headers.get('content-length') || 0) > 64000
    )
      return { state: 'unavailable' }
    const reader = response.body.getReader()
    let text = '',
      size = 0
    const decoder = new TextDecoder()
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > 64000) {
          await reader.cancel()
          return { state: 'unavailable' }
        }
        text += decoder.decode(part.value, { stream: true })
      }
      text += decoder.decode()
    } finally {
      reader.releaseLock()
    }
    const data = JSON.parse(text) as {
      results?: unknown
      is_cached?: boolean
      query_status?: { complete?: boolean }
    }
    if (data.query_status && data.query_status.complete !== true) return { state: 'unavailable' }
    if (!Array.isArray(data.results) || data.results.length !== 3) return { state: 'unavailable' }
    const counts: number[] = []
    for (let index = 0; index < events.length; index++) {
      const row = data.results[index] as {
        action_id?: unknown
        name?: unknown
        order?: unknown
        count?: unknown
      } | null
      if (
        !row ||
        row.action_id !== events[index] ||
        row.order !== index ||
        typeof row.count !== 'number' ||
        !Number.isSafeInteger(row.count) ||
        row.count < 0 ||
        (index > 0 && row.count > counts[index - 1])
      )
        return { state: 'unavailable' }
      counts.push(row.count)
    }
    return { state: 'ready', counts: counts as [number, number, number] }
  } catch {
    return { state: 'unavailable' }
  }
}
