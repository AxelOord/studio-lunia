'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Booking, EmailTemplate, FollowUp } from '../payload-types'
import {
  editableStates,
  localTimeAt,
  purposeLabels,
  purposes,
  timeCandidates,
} from '../followups/domain'
import { EmailFrame, useRecordAction } from './record-ui'
import { workspaceJSON } from './workspace-ui'

type Preview = {
  html: string
  subject: string
  recipient: string
  plannedAt: string
  timeZone: string
  previewToken: string
}
export function FollowUpEditor({
  enquiry,
  bookings,
  templates,
  plan,
  onDone,
  onCancel,
  onRefresh,
}: {
  enquiry: number
  bookings: Booking[]
  templates: EmailTemplate[]
  plan?: FollowUp
  onDone: () => Promise<void>
  onCancel: () => void
  onRefresh: () => Promise<void>
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const [purpose, setPurpose] = useState(plan?.purpose || 'enquiry_followup')
  const [baseRevision, setBaseRevision] = useState(plan?.revision)
  const changed = Boolean(plan && plan.revision !== baseRevision)
  const terminal = Boolean(plan && !editableStates.includes(plan.state))
  const [booking, setBooking] = useState(String(plan?.booking || ''))
  const [template, setTemplate] = useState(String(plan?.template || ''))
  const [timeZone, setTimeZone] = useState(plan?.timeZone || 'UTC')
  const [time, setTime] = useState(() =>
    localTimeAt(plan?.plannedAt || new Date(Date.now() + 86400000), plan?.timeZone || 'UTC'),
  )
  const [offset, setOffset] = useState('')
  const snapshot = plan?.templateSnapshot as { subject?: string; body?: string } | undefined
  const [subject, setSubject] = useState(snapshot?.subject || '')
  const [body, setBody] = useState(snapshot?.body || '')
  const [preview, setPreview] = useState<{ value: string; data: Preview }>()
  const [error, setError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const { run, busy, message, clearMessage } = useRecordAction('/api/customer-workspace')
  const input = {
    enquiry,
    purpose,
    booking: booking ? Number(booking) : undefined,
    template: Number(template),
    timeZone,
    localTime: time,
    offset: offset === '' ? undefined : Number(offset),
    subject,
    body,
  }
  const value = JSON.stringify(input)
  const candidates = useMemo(() => {
    try {
      return timeCandidates(time, timeZone)
    } catch {
      return []
    } // Validation appears on explicit preview.
  }, [time, timeZone])
  const reviewed = !changed && !terminal && preview?.value === value ? preview.data : undefined
  return (
    <form
      className="workspace-editor"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!reviewed) return
        const result = await run({
          ...input,
          action: plan ? 'editFollowUp' : 'createFollowUp',
          plan: plan?.id,
          revision: baseRevision,
          previewToken: reviewed.previewToken,
        })
        if (result) await onDone()
        else await onRefresh()
      }}
    >
      <h3 ref={heading} tabIndex={-1}>
        {plan ? 'Edit planned message' : 'Plan a test follow-up'}
      </h3>
      {(changed || terminal) && plan && (
        <section aria-label="Plan changed" role="alert">
          <h4>This plan changed while you were editing</h4>
          <p>
            Your unsaved edits are still below. Latest saved revision {plan.revision}:{' '}
            {plan.subject} · {plan.state} · {plan.plannedAt} ({plan.timeZone}).
          </p>
          {terminal ? (
            <p>This plan can no longer be edited. Keep a copy of your wording before closing.</p>
          ) : (
            <>
              <p>
                Review the latest saved plan above, then explicitly reapply your edits and review
                the exact message again.
              </p>
              <button
                type="button"
                disabled={busy || previewing}
                onClick={() => {
                  setBaseRevision(plan.revision)
                  setPreview(undefined)
                  setError('')
                  clearMessage()
                }}
              >
                Use latest revision and keep my edits
              </button>
            </>
          )}
        </section>
      )}
      <div className="customer-grid">
        <label>
          Purpose
          <select
            aria-label="Purpose"
            value={purpose}
            onChange={(event) => setPurpose(event.target.value as typeof purpose)}
          >
            {purposes.map((item) => (
              <option key={item} value={item}>
                {purposeLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Linked booking
          <select
            value={booking}
            disabled={Boolean(plan)}
            onChange={(event) => setBooking(event.target.value)}
          >
            <option value="">Enquiry only</option>
            {bookings.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · {item.status}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Approved message template
        <select
          required
          value={template}
          onChange={(event) => {
            setTemplate(event.target.value)
            const selected = templates.find((item) => item.id === Number(event.target.value))
            setSubject(selected?.subject || '')
            setBody(selected?.body || '')
          }}
        >
          <option value="">Choose a template</option>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {!templates.length && (
        <p>
          Create and approve a message in{' '}
          <Link href="/admin/collections/email-templates">Email templates</Link> first.
        </p>
      )}
      <div className="customer-grid">
        <label>
          Planned local date and time
          <input
            required
            type="datetime-local"
            value={time}
            onChange={(event) => {
              setTime(event.target.value)
              setOffset('')
            }}
          />
        </label>
        <label>
          IANA timezone
          <input
            required
            value={timeZone}
            placeholder="Europe/Amsterdam"
            onChange={(event) => {
              setTimeZone(event.target.value)
              setOffset('')
            }}
          />
        </label>
      </div>
      {candidates.length > 1 && (
        <label>
          This time occurs twice. Choose the UTC offset
          <select required value={offset} onChange={(event) => setOffset(event.target.value)}>
            <option value="">Choose occurrence</option>
            {candidates.map((item) => (
              <option key={item.offset} value={item.offset}>
                {item.instant} (UTC offset {item.offset} minutes)
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Message subject
        <input
          required
          maxLength={200}
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </label>
      <label>
        Message wording
        <textarea
          required
          rows={7}
          maxLength={12000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <p>
        Template variables stay available. Preview resolves them using this customer and booking.
        Saving never sends an email.
      </p>
      <div className="customer-actions">
        <button
          type="button"
          disabled={previewing || busy || changed || terminal}
          onClick={async () => {
            setError('')
            setPreviewing(true)
            try {
              setPreview({
                value,
                data: await workspaceJSON('/api/customer-workspace', {
                  ...input,
                  action: 'previewFollowUp',
                }),
              })
            } catch (error) {
              setError(error instanceof Error ? error.message : 'Preview could not load.')
            } finally {
              setPreviewing(false)
            }
          }}
        >
          {previewing ? 'Preparing preview…' : 'Review exact message'}
        </button>
        <button disabled={busy || !reviewed}>Save reviewed test plan</button>
        <button type="button" onClick={onCancel}>
          Cancel editing
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
      {reviewed && (
        <section aria-label="Reviewed follow-up">
          <p>To: {reviewed.recipient}</p>
          <p>
            Planned: {reviewed.plannedAt} UTC · {reviewed.timeZone}
          </p>
          <h4>{reviewed.subject}</h4>
          <EmailFrame html={reviewed.html} />
        </section>
      )}
    </form>
  )
}
