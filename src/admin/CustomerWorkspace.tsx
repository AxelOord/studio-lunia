'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { workspace } from '../followups/queries'
import type { EmailMessage, FollowUp } from '../payload-types'
import { editableStates } from '../followups/domain'
import { EmailFrame, localDate, useRecordAction } from './record-ui'
import { PlanSummary, WorkspaceShell, workspaceJSON } from './workspace-ui'
import { FollowUpEditor } from './FollowUpEditor'
import { BookingAction, DraftAction, ProposalAction } from './WorkspaceActions'

type CustomerData = Awaited<ReturnType<typeof workspace>>
const relation = (value: number | { id: number } | null | undefined) =>
  typeof value === 'object' ? value?.id : value
export function CustomerWorkspace({ initial }: { initial: CustomerData }) {
  const [data, setData] = useState(initial)
  const [enquiryID, setEnquiryID] = useState(initial.selectedEnquiry || initial.enquiries[0]?.id)
  const [editor, setEditor] = useState<number | 'new'>()
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [email, setEmail] = useState<EmailMessage>()
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const emailRequest = useRef(0)
  useEffect(
    () => () => {
      emailRequest.current++
    },
    [],
  )
  const [showProposal, setShowProposal] = useState(false)
  const { run, busy, message } = useRecordAction('/api/customer-workspace')
  const enquiry = data.enquiries.find((item) => item.id === enquiryID)
  const bookings = data.bookings.filter((item) => relation(item.enquiry) === enquiryID)
  const plans = data.plans.filter((item) => relation(item.enquiry) === enquiryID)
  const editingPlan = data.plans.find((item) => item.id === editor)
  function closeEmail() {
    emailRequest.current++
    setEmail(undefined)
    setEmailLoading(false)
    setEmailError('')
  }
  async function openEmail(id: number) {
    const version = ++emailRequest.current
    setEmail(undefined)
    setEmailError('')
    setEmailLoading(true)
    try {
      const result = await workspaceJSON<{ message: EmailMessage }>(
        `/api/customer-records?message=${id}`,
      )
      if (version === emailRequest.current) setEmail(result.message)
    } catch {
      if (version === emailRequest.current)
        setEmailError('The email preview could not load. Try again.')
    } finally {
      if (version === emailRequest.current) setEmailLoading(false)
    }
  }
  async function reload() {
    try {
      setError('')
      const selectedPlan = typeof editor === 'number' ? editor : data.selectedPlan
      const params = new URLSearchParams({ contact: String(data.contact.id) })
      if (enquiryID) params.set('enquiry', String(enquiryID))
      if (selectedPlan) params.set('plan', String(selectedPlan))
      setData(await workspaceJSON(`/api/customer-workspace?${params}`))
    } catch {
      setError(
        'The action may have saved, but this workspace could not refresh. Refresh before repeating it.',
      )
    }
  }
  async function planAction(action: string, plan: FollowUp) {
    if (await run({ action, plan: plan.id, revision: plan.revision })) await reload()
  }
  return (
    <WorkspaceShell
      title={data.contact.name}
      description="The request, conversation, booking and next steps in one place."
    >
      <div className="workspace-contact">
        <p>
          {data.contact.email}
          {data.contact.phone && <> · {data.contact.phone}</>}
        </p>
        <Link href={`/admin/collections/contacts/${data.contact.id}`}>Edit contact details</Link>
        <button onClick={() => void reload()}>Refresh workspace</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {data.selectionUnavailable && (
        <p role="alert">The linked request or plan is no longer available for this customer.</p>
      )}
      {data.truncated && (
        <p role="status">
          Showing the latest 100 records per section. Older records remain in the collection views.
        </p>
      )}
      <div className="workspace-stop">
        <p>
          {data.contact.followUpsStopped
            ? 'Follow-ups are stopped for this customer. Existing plans stay blocked until explicitly reviewed.'
            : 'Follow-ups may be planned for tests. You can stop them for this customer at any time.'}
        </p>
        <button
          disabled={busy}
          onClick={async () => {
            if (
              await run({
                action: 'stopFollowUps',
                contact: data.contact.id,
                stopped: !data.contact.followUpsStopped,
              })
            )
              await reload()
          }}
        >
          {data.contact.followUpsStopped
            ? 'Allow new test planning'
            : 'Stop all customer follow-ups'}
        </button>
        <p role="status">{message}</p>
      </div>
      {!data.enquiries.length ? (
        <section className="workspace-card">
          <h2>No enquiry linked yet</h2>
          <p>
            Link an existing enquiry explicitly in its record before preparing a proposal or
            follow-up.
          </p>
        </section>
      ) : (
        <>
          <label className="workspace-enquiry-select">
            Customer request
            <select
              value={enquiryID}
              onChange={(event) => {
                setEnquiryID(Number(event.target.value))
                setEditor(undefined)
                setShowProposal(false)
                closeEmail()
              }}
            >
              {data.enquiries.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.serviceTitle} · {localDate(item.createdAt)}
                </option>
              ))}
            </select>
          </label>
          <div className="workspace-columns">
            <div>
              {enquiry && (
                <section className="workspace-card">
                  <p className="workspace-label">
                    Original enquiry · {localDate(enquiry.createdAt)}
                  </p>
                  <h2>{enquiry.serviceTitle}</h2>
                  <span className="workspace-badge">{enquiry.followUp}</span>
                  <p className="workspace-message">{enquiry.message}</p>
                  <Link href={`/admin/collections/enquiries/${enquiry.id}`}>
                    Update enquiry status or link
                  </Link>
                  <hr />
                  <DraftAction
                    key={enquiry.id}
                    enquiry={enquiry.id}
                    templates={data.templates}
                    onDone={reload}
                  />
                </section>
              )}
              <section className="workspace-card">
                <h2>Conversation and history</h2>
                <p>
                  Staff notes and simulated replies are labelled. A real mailbox is not connected.
                </p>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault()
                    if (
                      await run({
                        action: 'simulateReply',
                        contact: data.contact.id,
                        enquiry: enquiryID,
                        text: reply,
                      })
                    ) {
                      setReply('')
                      await reload()
                    }
                  }}
                >
                  <label>
                    Simulated incoming reply
                    <textarea
                      required
                      minLength={10}
                      maxLength={3000}
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Synthetic test reply only"
                    />
                  </label>
                  <button disabled={busy}>Record simulated reply</button>
                </form>
                {!data.messages.length && !data.events.length && (
                  <p>No conversation activity yet.</p>
                )}
                {data.messages.map((item) => (
                  <p key={`mail-${item.id}`}>
                    <button
                      className="workspace-text-button"
                      onClick={() => void openEmail(item.id)}
                    >
                      {item.subject}
                    </button>{' '}
                    <span className="workspace-badge">{item.status}</span> ·{' '}
                    {item.kind.replaceAll('_', ' ')}
                  </p>
                ))}
                {(email || emailLoading || emailError) && (
                  <section aria-label="Saved email preview">
                    <button onClick={closeEmail}>Close email preview</button>
                    {emailLoading && <p role="status">Loading saved email…</p>}
                    {emailError && <p role="alert">{emailError}</p>}
                    {email && (
                      <>
                        <h3>{email.subject}</h3>
                        <p>
                          To: {email.recipient} · {email.status}
                        </p>
                        <EmailFrame html={email.html} />
                      </>
                    )}
                  </section>
                )}
                <ol className="workspace-timeline">
                  {data.events.map((event) => {
                    const details = event.details as { note?: string } | undefined
                    return (
                      <li key={event.id}>
                        <strong>{event.summary}</strong>
                        <small>
                          {localDate(event.occurredAt)} · {event.source}
                        </small>
                        {details?.note && <p className="workspace-message">{details.note}</p>}
                      </li>
                    )
                  })}
                </ol>
              </section>
            </div>
            <aside>
              <section className="workspace-card">
                <h2>Booking</h2>
                {bookings.length ? (
                  bookings.map((booking) => (
                    <details key={`${booking.id}:${booking.updatedAt}`}>
                      <summary>
                        {booking.title} · {booking.status}
                      </summary>
                      <BookingAction booking={booking} onDone={reload} />
                      <Link href={`/admin/collections/bookings/${booking.id}`}>
                        Open value and money records
                      </Link>
                    </details>
                  ))
                ) : (
                  <p>No booking proposal yet.</p>
                )}
                <button onClick={() => setShowProposal(!showProposal)}>
                  {showProposal ? 'Cancel proposal editing' : 'New booking proposal'}
                </button>
                {showProposal && enquiry && (
                  <ProposalAction
                    enquiry={enquiry.id}
                    onDone={async () => {
                      await reload()
                      setShowProposal(false)
                    }}
                  />
                )}
              </section>
              <section className="workspace-card" id="follow-ups">
                <h2>Planned follow-ups</h2>
                <button onClick={() => setEditor('new')}>Plan a follow-up</button>
                {!plans.length && <p>No follow-ups planned for this request.</p>}
                {plans.map((plan) => (
                  <article className="workspace-plan" key={plan.id} id={`follow-up-${plan.id}`}>
                    <PlanSummary plan={plan} />
                    <details>
                      <summary>Exact planned message</summary>
                      <p>To: {plan.recipient}</p>
                      <EmailFrame html={plan.html} />
                    </details>
                    {editableStates.includes(plan.state) && (
                      <div className="customer-actions">
                        <button onClick={() => setEditor(plan.id)}>Edit or reschedule</button>
                        {plan.state === 'paused' ? (
                          <button
                            disabled={busy}
                            onClick={() => void planAction('resumeFollowUp', plan)}
                          >
                            Review and resume
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => void planAction('pauseFollowUp', plan)}
                          >
                            Pause plan
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => void planAction('cancelFollowUp', plan)}
                        >
                          Cancel plan
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            </aside>
          </div>
          {editor && enquiry && (editor === 'new' || editingPlan) && (
            <section className="workspace-card" aria-label="Follow-up editor">
              <FollowUpEditor
                key={editor}
                enquiry={enquiry.id}
                bookings={bookings}
                templates={data.templates}
                plan={editingPlan}
                onRefresh={reload}
                onCancel={() => setEditor(undefined)}
                onDone={async () => {
                  await reload()
                  setEditor(undefined)
                }}
              />
            </section>
          )}
        </>
      )}
    </WorkspaceShell>
  )
}
