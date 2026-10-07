'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import type { ConversionOverviewData } from '../reporting/queries'
import {
  reportFilters,
  reportURL,
  type Metric,
  type Money,
  type ReportFilters,
  type Stream,
} from '../reporting/domain'
import { WorkspaceShell, workspaceJSON, currencyAmount } from './workspace-ui'
import './conversions.css'

function ratio(numerator: number, denominator: number) {
  return denominator
    ? `${numerator} / ${denominator} · ${((100 * numerator) / denominator).toFixed(1)}%`
    : 'Unavailable · denominator is zero'
}
function MoneyValues({ values }: { values: Money[] }) {
  return values.length ? (
    <ul className="report-money">
      {values.map((value) => (
        <li key={value.currency}>
          <strong>{value.currency}</strong> · Expected{' '}
          {currencyAmount(value.expected, value.currency)} · Recorded net{' '}
          {currencyAmount(value.recorded, value.currency)}
        </li>
      ))}
    </ul>
  ) : (
    <p className="workspace-muted">No value or money recorded for this cohort.</p>
  )
}
function Funnel({
  metric,
  stream,
  onSources,
}: {
  metric: Metric
  stream: Stream
  onSources: () => void
}) {
  const bespoke = stream === 'bespoke'
  return (
    <section
      className="workspace-card report-funnel"
      aria-label={bespoke ? 'Bespoke enquiry outcomes' : 'Studio booking outcomes'}
    >
      <p className="workspace-label">
        {bespoke ? 'Bespoke · enquiry creation cohort' : 'Studio · booking creation cohort'}
      </p>
      <h2>{bespoke ? 'Bespoke enquiries' : 'Studio bookings'}</h2>
      <dl className="report-metrics">
        <div>
          <dt>{bespoke ? 'Enquiries' : 'Booking requests'}</dt>
          <dd>{metric.intents}</dd>
        </div>
        {bespoke && (
          <div>
            <dt>Qualified · proposal recorded</dt>
            <dd>{metric.qualified}</dd>
          </div>
        )}
        <div>
          <dt>
            {bespoke ? 'Enquiries with a confirmed/completed booking' : 'Confirmed or completed'}
          </dt>
          <dd>{metric.converted}</dd>
        </div>
        <div>
          <dt>Linked unique contacts</dt>
          <dd>{metric.contacts}</dd>
        </div>
      </dl>
      <p>
        Conversion: <strong>{ratio(metric.converted, metric.intents)}</strong>.{' '}
        {bespoke
          ? 'Each enquiry counts once even with several proposals.'
          : 'Each booking counts once after changes or retries.'}
      </p>
      <p className="workspace-muted">
        Contacts are linked record IDs; matching email addresses are never merged.{' '}
        {metric.unlinked > 0 && `${metric.unlinked} enquiries have no linked contact.`}
      </p>
      <dl className="report-statuses">
        <div>
          <dt>Proposed</dt>
          <dd>{metric.proposed}</dd>
        </div>
        <div>
          <dt>Pending approval</dt>
          <dd>{metric.pending}</dd>
        </div>
        <div>
          <dt>Confirmed</dt>
          <dd>{metric.confirmed}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{metric.completed}</dd>
        </div>
        <div>
          <dt>Cancelled</dt>
          <dd>{metric.cancelled}</dd>
        </div>
      </dl>
      <p>
        {metric.bookings} distinct bookings. Cancellation rate:{' '}
        <strong>{ratio(metric.cancellation.numerator, metric.cancellation.denominator)}</strong>.
      </p>
      <p className="workspace-muted">
        Cancellation denominator: confirmed + completed + cancelled; proposals and pending approvals
        are excluded.
      </p>
      {bespoke && (
        <div className="report-response">
          <h3>First human response</h3>
          <p>
            {metric.medianResponseHours === null
              ? 'Median unavailable · no response timestamps recorded.'
              : `Median ${metric.medianResponseHours.toFixed(1)} hours among recorded responses.`}
          </p>
          <p>
            Recorded response coverage:{' '}
            <strong>
              {metric.responded} / {metric.intents} enquiries
            </strong>
            .
          </p>
          <p className="workspace-muted">
            Staff-attested first personal outbound response. Missing timestamps are unknown;
            automated receipts and drafts do not count.
          </p>
        </div>
      )}
      <h3>Expected value & recorded net payments</h3>
      <MoneyValues values={metric.money} />
      <button type="button" onClick={onSources}>
        View {bespoke ? 'bespoke' : 'studio'} source records
      </button>
    </section>
  )
}
const operations = [
  ['newEnquiries', 'New enquiries', '/admin/collections/enquiries?where[followUp][equals]=new'],
  [
    'waitingFollowUps',
    'Waiting follow-ups',
    '/admin/collections/follow-ups?where[state][in]=planned,paused,blocked,failed',
  ],
  [
    'upcomingBookings',
    'Upcoming bookings',
    '/admin/collections/bookings?where[status][equals]=confirmed&where[sessionAt][greater_than]=',
  ],
  [
    'emailFailures',
    'Email failures',
    '/admin/collections/email-messages?where[status][in]=failed,uncertain,manual,bounced,delayed',
  ],
  [
    'notificationFailures',
    'Notification failures',
    '/admin/collections/enquiries?where[notificationStatus][in]=failed,manual',
  ],
  [
    'studioDraftFailures',
    'Studio draft failures',
    '/admin/collections/bookings?where[studioMessageState][equals]=failed',
  ],
] as const
export function ConversionOverview({
  initial,
  initialError = '',
}: {
  initial?: ConversionOverviewData
  initialError?: string
}) {
  const [data, setData] = useState(initial)
  const defaults = initial?.filters || reportFilters({})
  const [from, setFrom] = useState(defaults.from),
    [to, setTo] = useState(defaults.to)
  const [touch, setTouch] = useState(defaults.touch),
    [groupBy, setGroupBy] = useState(defaults.groupBy)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError)
  const pending = useRef(defaults),
    version = useRef(0)
  const sourceHeading = useRef<HTMLHeadingElement>(null)
  async function load(filters: ReportFilters, focusSources = false) {
    const request = ++version.current
    pending.current = filters
    setBusy(true)
    setError('')
    try {
      const next = await workspaceJSON<ConversionOverviewData>(
        reportURL(filters).replace('/admin/conversions', '/api/conversion-report'),
      )
      if (request !== version.current) return
      setData(next)
      history.replaceState(null, '', reportURL(filters))
      if (focusSources) requestAnimationFrame(() => sourceHeading.current?.focus())
    } catch (cause) {
      if (request === version.current)
        setError(cause instanceof Error ? cause.message : 'The report could not load.')
    } finally {
      if (request === version.current) setBusy(false)
    }
  }
  const applied = data?.filters || defaults
  function patch(values: Record<string, string | number>, sources = false) {
    void load(reportFilters({ ...applied, ...values }), sources)
  }
  return (
    <WorkspaceShell
      title="Conversion overview"
      description="Trace enquiries and studio bookings to their recorded outcomes."
      actions={
        <button disabled={busy} onClick={() => void load(applied)}>
          Refresh report
        </button>
      }
    >
      <form
        className="report-filters workspace-card"
        onSubmit={(event) => {
          event.preventDefault()
          try {
            void load(reportFilters({ from, to, touch, groupBy }))
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Check your report dates.')
          }
        }}
      >
        <label>
          From · UTC
          <input
            type="date"
            required
            value={from}
            disabled={busy}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Through · UTC
          <input
            type="date"
            required
            value={to}
            disabled={busy}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label>
          Campaign attribution
          <select
            value={touch}
            disabled={busy}
            onChange={(event) => setTouch(event.target.value as 'first' | 'last')}
          >
            <option value="last">Last eligible touch</option>
            <option value="first">First eligible touch</option>
          </select>
        </label>
        <label>
          Break down by
          <select
            value={groupBy}
            disabled={busy}
            onChange={(event) => setGroupBy(event.target.value as 'offers' | 'campaigns')}
          >
            <option value="offers">Service / studio day</option>
            <option value="campaigns">Campaign</option>
          </select>
        </label>
        <button disabled={busy}>Apply report filters</button>
      </form>
      {busy && <p role="status">Loading report…</p>}
      {error && (
        <div role="alert" className="workspace-card">
          {error} {data && 'The previously loaded report remains below.'}
          <button type="button" disabled={busy} onClick={() => void load(pending.current)}>
            Retry report
          </button>
        </div>
      )}
      {data && (
        <div aria-busy={busy}>
          <section aria-label="Current work" className="report-current">
            <h2>Needs attention now</h2>
            <p>
              All dates · current state. Waiting follow-ups include planned, paused, blocked and
              failed plans; upcoming bookings are confirmed future sessions.
            </p>
            <div className="report-operation-grid">
              {operations.map(([key, label, href]) => (
                <Link
                  href={key === 'upcomingBookings' ? href + encodeURIComponent(data.asOf) : href}
                  key={key}
                  className="workspace-card"
                >
                  <span>{label}</span>
                  <strong>{data.operational[key]}</strong>
                  <span className="workspace-muted">Open records →</span>
                </Link>
              ))}
            </div>
          </section>
          <div className="report-definition">
            <h2>
              Created {data.filters.from} through {data.filters.to} · UTC
            </h2>
            <p>
              Current outcomes for enquiries or studio bookings created in this period, as of{' '}
              {new Date(data.asOf).toLocaleString()}. Later status changes and all money entries for
              those records are included. This is not a payment-date or session-date revenue report.
            </p>
            <p>
              <strong>Expected value</strong> is the value of confirmed/completed bookings.
              <strong> Recorded net payments</strong> are manual payments less refunds, including
              correction reversals and cancelled bookings. They are not bank-verified collection or
              profit. Currencies are kept separate; no exchange rate is applied.
            </p>
          </div>
          {data.bespoke.intents + data.studio.intents === 0 && (
            <p role="status" className="workspace-card">
              No enquiries or studio bookings were created in this period. Choose another date range
              or open the source collections.
            </p>
          )}
          <div className="report-funnels">
            <Funnel
              metric={data.bespoke}
              stream="bespoke"
              onSources={() => patch({ sourceStream: 'bespoke', group: '', sourcePage: 1 }, true)}
            />
            <Funnel
              metric={data.studio}
              stream="studio"
              onSources={() => patch({ sourceStream: 'studio', group: '', sourcePage: 1 }, true)}
            />
          </div>
          <section className="workspace-card" aria-label="Studio occupancy">
            <h2>Studio occupancy · session dates</h2>
            <p>
              <strong>{ratio(data.occupancy.allocated, data.occupancy.capacity)}</strong> current
              published slot-places allocated across {data.occupancy.slots} slots starting in this
              UTC period.
            </p>
            <p>
              Includes pending approvals and overlapping commitments from older schedules. A longer
              existing session can block several current slots. Closed booking windows remain in
              capacity; cancelled or unpublished days do not. This is today&apos;s published
              inventory, not historical capacity.
            </p>
            <p>
              {data.occupancy.outside} active commitments starting in this period sit outside
              current published inventory. Review their studio days separately.
            </p>
            <Link href="/admin/studio-days">Review studio days</Link>
          </section>
          <section className="workspace-card" aria-label="Outcome breakdown">
            <h2>
              {data.filters.groupBy === 'campaigns'
                ? 'Campaign breakdown'
                : 'Service & studio-day breakdown'}
            </h2>
            <p>
              {data.filters.groupBy === 'campaigns'
                ? `${data.filters.touch === 'first' ? 'First' : 'Last'} eligible saved touch. Unknown and withheld sources remain separate; no click IDs are displayed.`
                : 'Bespoke services use the original enquiry; studio bookings use their current agreed studio day. Each intent stays in one group per breakdown.'}
            </p>
            <p>
              Cost per confirmed booking: <strong>Unavailable · no matched campaign spend</strong>.
            </p>
            <div
              className="report-table-scroll"
              role="region"
              aria-label="Scrollable outcome breakdown"
              tabIndex={0}
            >
              <table className="report-table">
                <caption>
                  {data.groupCount} groups · showing up to 20 on page {data.filters.groupPage}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Group</th>
                    <th scope="col">Intents</th>
                    <th scope="col">Converted intents</th>
                    <th scope="col">Booking outcomes</th>
                    <th scope="col">Value by currency</th>
                    <th scope="col">Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {data.groups.map((group) => (
                    <tr key={group.key}>
                      <th scope="row">
                        {group.label}
                        <small>
                          {group.stream === 'bespoke' ? 'Bespoke enquiries' : 'Studio bookings'}
                        </small>
                      </th>
                      <td>{group.metrics.intents}</td>
                      <td>
                        {group.metrics.converted} / {group.metrics.intents}
                      </td>
                      <td>
                        {group.metrics.confirmed} confirmed · {group.metrics.completed} completed ·{' '}
                        {group.metrics.cancelled} cancelled
                      </td>
                      <td>
                        <MoneyValues values={group.metrics.money} />
                      </td>
                      <td>
                        <button
                          disabled={busy}
                          aria-label={`View records for ${group.label} · ${group.stream}`}
                          onClick={() =>
                            patch({ group: group.key, sourceStream: 'all', sourcePage: 1 }, true)
                          }
                        >
                          View records
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.groups.length && <p>No groups in this period.</p>}
            <div className="customer-actions">
              <button
                disabled={busy || applied.groupPage <= 1}
                onClick={() => patch({ groupPage: applied.groupPage - 1 })}
              >
                Previous groups
              </button>
              <button
                disabled={busy || applied.groupPage * 20 >= data.groupCount}
                onClick={() => patch({ groupPage: applied.groupPage + 1 })}
              >
                Next groups
              </button>
            </div>
          </section>
          <section className="workspace-card" aria-label="Source records">
            <h2 ref={sourceHeading} tabIndex={-1}>
              Source records
            </h2>
            <p>
              {data.filters.group
                ? data.selectedGroup || 'Selected group is unavailable in this cohort.'
                : data.filters.sourceStream === 'all'
                  ? 'All cohort intents'
                  : `${data.filters.sourceStream} cohort intents`}{' '}
              · {data.sourceCount} records. Enquiries appear before studio bookings, ordered by
              record ID.
            </p>
            <button
              disabled={busy}
              onClick={() => patch({ group: '', sourceStream: 'all', sourcePage: 1 })}
            >
              Show all cohort sources
            </button>
            <ul className="report-sources">
              {data.sources.map((source) => (
                <li key={source.stream + source.id}>
                  <Link href={source.href}>
                    {source.stream === 'bespoke' ? 'Enquiry' : 'Studio booking'} #{source.id}
                  </Link>
                  <span>Created {new Date(source.createdAt).toLocaleString()}</span>
                  <Link href={source.bookingsHref}>Booking records</Link>
                  <Link href={source.moneyHref}>Money entries</Link>
                </li>
              ))}
            </ul>
            {!data.sources.length && <p>No source records on this page.</p>}
            <div className="customer-actions">
              <button
                disabled={busy || applied.sourcePage <= 1}
                onClick={() => patch({ sourcePage: applied.sourcePage - 1 }, true)}
              >
                Previous sources
              </button>
              <button
                disabled={busy || applied.sourcePage * 20 >= data.sourceCount}
                onClick={() => patch({ sourcePage: applied.sourcePage + 1 }, true)}
              >
                Next sources
              </button>
            </div>
          </section>
          <section className="workspace-card" aria-label="Consented session funnel">
            <h2>Consented session funnel · PostHog EU</h2>
            {data.funnel.state === 'ready' ? (
              <ol className="report-analytics">
                {['Viewed a service', 'Started an enquiry', 'Submitted an enquiry'].map(
                  (label, index) => (
                    <li key={label}>
                      <span>{label}</span>
                      <strong>
                        {data.funnel.state === 'ready' ? data.funnel.counts[index] : ''}
                      </strong>
                    </li>
                  ),
                )}
              </ol>
            ) : (
              <p role="status">
                {data.funnel.state === 'disabled'
                  ? 'Analytics reporting is off. No provider query was made.'
                  : 'Analytics counts are unavailable. Internal outcomes remain available; refresh to try the read again.'}
              </p>
            )}
            <p>
              Ordered within 24 hours across all services. Counts represent consenting anonymous
              sessions, not people or the creation cohorts above. A session can view one service and
              enquire about another. Consent refusal, blocking and collection failures leave gaps;
              coverage of all visits is unknown.
            </p>
            <p>
              <strong>
                Studio visitor and booking-step counts: unavailable · studio reporting is not
                connected. Optional measurement requires consent and approved setup. These counts
                are not inferred from saved bookings.
              </strong>{' '}
              No visitor-to-booking rate or cross-system identity match is inferred.
            </p>
          </section>
        </div>
      )}
    </WorkspaceShell>
  )
}
