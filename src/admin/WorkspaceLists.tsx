'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import type { PaginatedDocs } from 'payload'
import type { FollowUp } from '../payload-types'
import type { inbox } from '../followups/queries'
import { localDate, useRecordAction } from './record-ui'
import { PlanSummary, WorkspaceShell, workspaceJSON } from './workspace-ui'

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
  async function search(page = 1) {
    const version = ++searchVersion.current
    setBusy(true)
    setError('')
    try {
      const result = await workspaceJSON<InboxData>('/api/customer-workspace', {
        action: 'inbox',
        query,
        filter,
        page,
      })
      if (version !== searchVersion.current) return
      setData(result)
      window.history.replaceState(null, '', `/admin?filter=${filter}&page=${page}`)
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
      description="See who needs a reply, what they asked for, and the next step."
    >
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
        <label>
          Show
          <select
            aria-label="Show"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {[
              ['all', 'All customers'],
              ['new', 'New enquiries'],
              ['waiting', 'Waiting for a reply'],
              ['upcoming', 'Upcoming sessions'],
              ['attention', 'Needs attention'],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy}>{busy ? 'Searching…' : 'Apply filters'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div className="workspace-inbox" aria-busy={busy}>
        {!data.rows.length && (
          <section className="workspace-card">
            <h2>No customers in this view</h2>
            <p>Try another filter. New service enquiries appear here after they are submitted.</p>
          </section>
        )}
        {data.rows.map(({ contact, enquiry, activity, plan }) => (
          <article className="workspace-card inbox-row" key={contact.id}>
            <div>
              <h2>
                <Link href={`/admin/customers/${contact.id}?filter=${filter}&page=${data.page}`}>
                  {contact.name}
                </Link>
              </h2>
              <p>{enquiry?.serviceTitle || 'No enquiry yet'}</p>
              <span className="workspace-badge">{enquiry?.followUp || 'contact'}</span>
            </div>
            <div>
              <p className="workspace-label">Latest activity</p>
              <p>{activity?.summary || 'Contact created'}</p>
              <small>{localDate(activity?.occurredAt || contact.createdAt)}</small>
            </div>
            <div>
              <p className="workspace-label">Next step</p>
              <p>
                {contact.followUpsStopped
                  ? 'Follow-ups stopped'
                  : plan
                    ? `${plan.state}: ${plan.subject}`
                    : enquiry?.followUp === 'new'
                      ? 'Review enquiry and prepare a reply'
                      : 'Review conversation'}
              </p>
              <Link href={`/admin/customers/${contact.id}?filter=${filter}&page=${data.page}`}>
                Open workspace →
              </Link>
            </div>
          </article>
        ))}
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
export function FollowUpQueue({ initial }: { initial: PaginatedDocs<FollowUp> }) {
  const [data, setData] = useState(initial)
  const [error, setError] = useState('')
  const loadVersion = useRef(0)
  const { run, busy, message } = useRecordAction('/api/customer-workspace')
  async function load(page: number) {
    const version = ++loadVersion.current
    try {
      setError('')
      const result = await workspaceJSON<PaginatedDocs<FollowUp>>(
        `/api/customer-workspace?page=${page}`,
      )
      if (version === loadVersion.current) setData(result)
    } catch {
      if (version === loadVersion.current) setError('Could not refresh the queue. Try again.')
    }
  }
  return (
    <WorkspaceShell
      title="Planned follow-ups"
      description="Review the exact message and its stop conditions before a test run."
    >
      <div className="customer-actions">
        <button
          disabled={busy}
          onClick={async () => {
            if (await run({ action: 'runSimulations' })) await load(data.page || 1)
          }}
        >
          Run due simulations
        </button>
        <button onClick={() => void load(data.page || 1)}>Refresh queue</button>
        <Link href="/admin/collections/follow-up-rules">Review test planning rules</Link>
      </div>
      <p role="status">{message}</p>
      {error && <p role="alert">{error}</p>}
      {!data.docs.length && (
        <section className="workspace-card">
          <h2>No follow-ups planned</h2>
          <p>
            Open a customer workspace to prepare a plan. No timing or message rules are enabled by
            default.
          </p>
        </section>
      )}
      <div className="workspace-plan-grid">
        {data.docs.map((plan) => (
          <article className="workspace-card" key={plan.id}>
            <PlanSummary plan={plan} />
            <p>{typeof plan.contact === 'object' ? plan.contact.name : 'Customer'}</p>
            <Link
              href={`/admin/customers/${typeof plan.contact === 'object' ? plan.contact.id : plan.contact}#follow-ups`}
            >
              Review and manage plan
            </Link>
          </article>
        ))}
      </div>
      <div className="workspace-pagination">
        <button disabled={!data.hasPrevPage} onClick={() => void load((data.page || 1) - 1)}>
          Previous
        </button>
        <span>Page {data.page || 1}</span>
        <button disabled={!data.hasNextPage} onClick={() => void load((data.page || 1) + 1)}>
          Next
        </button>
      </div>
    </WorkspaceShell>
  )
}
