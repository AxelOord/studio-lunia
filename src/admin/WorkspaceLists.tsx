'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import type { PaginatedDocs } from 'payload'
import type { FollowUp } from '../payload-types'
import type { inbox } from '../followups/queries'
import { localDate, useRecordAction } from './record-ui'
import { PlanSummary, WorkspaceShell, workspaceJSON } from './workspace-ui'

const inboxFilters = [
  ['all', 'All customers'],
  ['new', 'New enquiries'],
  ['attention', 'Needs attention'],
  ['waiting', 'Waiting for a reply'],
  ['upcoming', 'Upcoming sessions'],
]
type InboxData = Awaited<ReturnType<typeof inbox>>
export function EnquiryInbox({
  initial,
  initialFilter,
}: {
  initial: InboxData
  initialFilter: string
}) {
  const [data, setData] = useState(initial)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(initialFilter)
  const [busy, setBusy] = useState(false)
  const searchVersion = useRef(0)
  const [error, setError] = useState('')
  async function search(page = 1, nextFilter = filter) {
    const version = ++searchVersion.current
    setBusy(true)
    setError('')
    try {
      const result = await workspaceJSON<InboxData>('/api/customer-workspace', {
        action: 'inbox',
        query,
        filter: nextFilter,
        page,
      })
      if (version !== searchVersion.current) return
      setData(result)
      setFilter(nextFilter)
      window.history.replaceState(null, '', `/admin?filter=${nextFilter}&page=${page}`)
    } catch (error) {
      if (version === searchVersion.current)
        setError(error instanceof Error ? error.message : 'Search failed. Try again.')
    } finally {
      if (version === searchVersion.current) setBusy(false)
    }
  }
  return (
    <WorkspaceShell
      title="Enquiry inbox"
      description="Start with a new enquiry or a customer who needs your attention."
    >
      <nav className="workspace-filters" aria-label="Inbox filters">
        {inboxFilters.map(([value, label]) => (
          <button key={value} aria-pressed={filter === value} onClick={() => void search(1, value)}>
            {label} <span className="workspace-count">{data.counts[value]}</span>
          </button>
        ))}
      </nav>
      <form
        className="workspace-search"
        onSubmit={(event) => {
          event.preventDefault()
          void search()
        }}
      >
        <label>
          Search customers
          <input
            type="search"
            placeholder="Name or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      {error && <p role="alert">{error} Your previous results are still shown.</p>}
      <p className="workspace-result-count" role="status">
        {busy
          ? 'Updating customers…'
          : `${data.counts[filter]} ${data.counts[filter] === 1 ? 'customer' : 'customers'} · ${inboxFilters.find(([value]) => value === filter)?.[1]}`}
      </p>
      <div className="workspace-inbox" aria-busy={busy}>
        {!data.rows.length && (
          <section className="workspace-card">
            <h2>No customers in this view</h2>
            <p>
              Try another filter or change your search. New service enquiries appear here after
              submission.
            </p>
          </section>
        )}
        {data.rows.map(({ contact, enquiry, activity, plan }) => {
          const href = `/admin/customers/${contact.id}?filter=${filter}&page=${data.page}${enquiry ? `&enquiry=${enquiry.id}` : ''}`
          const nextAction =
            enquiry?.followUp === 'new'
              ? 'Review enquiry'
              : plan?.state === 'blocked' || plan?.state === 'failed'
                ? 'Review follow-up'
                : 'Open customer'
          return (
            <article className="workspace-card inbox-row" key={contact.id}>
              <div>
                <h2>
                  <Link href={href}>{contact.name}</Link>
                </h2>
                <p>{enquiry?.serviceTitle || 'No enquiry yet'}</p>
                <span className={`workspace-badge state-${enquiry?.followUp || 'contact'}`}>
                  {enquiry?.followUp === 'new' ? 'New enquiry' : enquiry?.followUp || 'Contact'}
                </span>
              </div>
              <div className="inbox-activity">
                <p className="workspace-label">Latest activity</p>
                <p>{activity?.summary || 'Contact created'}</p>
                <small>{localDate(activity?.occurredAt || contact.createdAt)}</small>
              </div>
              <div className="inbox-next">
                <p>
                  {contact.followUpsStopped
                    ? 'Follow-ups stopped'
                    : enquiry?.followUp === 'new'
                      ? 'A personal reply is the next step.'
                      : plan
                        ? `${plan.state === 'blocked' ? 'Review needed' : plan.state}: ${plan.subject}`
                        : 'Review the latest conversation.'}
                </p>
                <Link
                  className="workspace-action-link"
                  href={
                    nextAction === 'Review follow-up' && plan
                      ? `${href}&plan=${plan.id}#follow-up-${plan.id}`
                      : href
                  }
                >
                  {nextAction} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          )
        })}
      </div>
      <div className="workspace-pagination">
        <button disabled={busy || data.page === 1} onClick={() => void search(data.page - 1)}>
          Previous
        </button>
        <span>Page {data.page}</span>
        <button disabled={busy || !data.hasNextPage} onClick={() => void search(data.page + 1)}>
          Next
        </button>
      </div>
    </WorkspaceShell>
  )
}
export function FollowUpQueue({
  initial,
  initialFilter,
}: {
  initial: PaginatedDocs<FollowUp>
  initialFilter: string
}) {
  const [data, setData] = useState(initial)
  const [filter, setFilter] = useState(initialFilter)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const loadVersion = useRef(0)
  const latestView = useRef({ page: initial.page || 1, filter: initialFilter })
  const { run, busy, message } = useRecordAction('/api/customer-workspace')
  async function load(page = latestView.current.page, nextFilter = latestView.current.filter) {
    // Record requested navigation immediately, including while its response is pending.
    latestView.current = { page, filter: nextFilter }
    const version = ++loadVersion.current
    setLoading(true)
    try {
      setError('')
      const result = await workspaceJSON<PaginatedDocs<FollowUp>>(
        `/api/customer-workspace?page=${page}&filter=${nextFilter}`,
      )
      if (version === loadVersion.current) {
        setData(result)
        setFilter(nextFilter)
        window.history.replaceState(null, '', `/admin/follow-ups?filter=${nextFilter}&page=${page}`)
      }
    } catch {
      if (version === loadVersion.current)
        setError('Could not refresh the queue. Your previous results are still shown. Try again.')
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }
  return (
    <WorkspaceShell
      title="Planned follow-ups"
      description="Check who needs attention, then review their message and timing."
    >
      <nav className="workspace-filters" aria-label="Follow-up filters">
        {[
          ['all', 'All plans'],
          ['attention', 'Needs attention'],
          ['planned', 'Planned'],
          ['paused', 'Paused'],
          ['finished', 'Finished'],
        ].map(([value, label]) => (
          <button key={value} aria-pressed={filter === value} onClick={() => void load(1, value)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="workspace-queue-tools">
        <p role="status">
          {loading
            ? 'Updating plans…'
            : `${data.totalDocs} ${data.totalDocs === 1 ? 'plan' : 'plans'} in this view`}
        </p>
        <button disabled={loading} onClick={() => void load(data.page || 1)}>
          Refresh queue
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data.docs.length && (
        <section className="workspace-card">
          <h2>No follow-ups in this view</h2>
          <p>
            Choose another status or open a customer to prepare a plan. Plans are never sent
            automatically.
          </p>
          <Link href="/admin">Open enquiry inbox</Link>
        </section>
      )}
      <div className="workspace-plan-grid" aria-busy={loading}>
        {data.docs.map((plan) => (
          <article className="workspace-card" key={plan.id}>
            <h2 className="workspace-customer-name">
              {typeof plan.contact === 'object' ? plan.contact.name : 'Customer'}
            </h2>
            <PlanSummary plan={plan} />
            <Link
              className="workspace-action-link"
              href={`/admin/customers/${typeof plan.contact === 'object' ? plan.contact.id : plan.contact}?plan=${plan.id}#follow-up-${plan.id}`}
            >
              Review and manage plan
            </Link>
          </article>
        ))}
      </div>
      <div className="workspace-pagination">
        <button
          disabled={loading || !data.hasPrevPage}
          onClick={() => void load((data.page || 1) - 1)}
        >
          Previous
        </button>
        <span>Page {data.page || 1}</span>
        <button
          disabled={loading || !data.hasNextPage}
          onClick={() => void load((data.page || 1) + 1)}
        >
          Next
        </button>
      </div>
      <details className="workspace-secondary">
        <summary>Simulation tools and planning rules</summary>
        <p>Manually check up to 10 due test jobs. No customer email is sent.</p>
        <div className="customer-actions">
          <button
            disabled={busy}
            onClick={async () => {
              if (await run({ action: 'runSimulations' })) await load()
            }}
          >
            Run due simulations
          </button>
          <Link href="/admin/collections/follow-up-rules">Review test planning rules</Link>
        </div>
        <p role="status">{message}</p>
      </details>
    </WorkspaceShell>
  )
}
