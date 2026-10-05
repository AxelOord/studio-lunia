'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { Booking, EmailMessage, EmailTemplate } from '../payload-types'
import { EmailFrame, inputDate, isoDate, useRecordAction } from './record-ui'
import { currencyAmount, minorAmount, workspaceJSON } from './workspace-ui'

export function ProposalAction({
  enquiry,
  onDone,
}: {
  enquiry: number
  onDone: () => Promise<void>
}) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [error, setError] = useState('')
  const { run, busy, message } = useRecordAction()
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        try {
          if (
            await run({
              action: 'proposeBooking',
              enquiry,
              expectedMinor: minorAmount(amount, currency),
              currency,
            })
          )
            await onDone()
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Check the amount and currency.')
        }
      }}
    >
      <h3>Create a booking proposal</h3>
      <p>Record an agreed estimate. This does not reserve a calendar slot or charge a payment.</p>
      <div className="customer-grid">
        <label>
          Expected value
          <input
            required
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label>
          Currency
          <input
            required
            minLength={3}
            maxLength={3}
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </label>
      </div>
      <button disabled={busy}>Record proposal</button>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
    </form>
  )
}
export function BookingAction({
  booking,
  onDone,
}: {
  booking: Booking
  onDone: () => Promise<void>
}) {
  const [status, setStatus] = useState(booking.status)
  const [session, setSession] = useState(booking.sessionAt ? inputDate(booking.sessionAt) : '')
  const [reason, setReason] = useState('')
  const { run, busy, message } = useRecordAction()
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        if (
          await run({
            action: 'changeBooking',
            booking: booking.id,
            status,
            sessionAt: isoDate(session),
            expectedMinor: booking.expectedMinor,
            reason,
          })
        )
          await onDone()
      }}
    >
      <h3>{booking.title}</h3>
      <p>
        {currencyAmount(booking.expectedMinor, booking.currency)} expected · {booking.status}
      </p>
      <label>
        Booking status
        <select
          aria-label="Booking status"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          {['proposed', 'confirmed', 'completed', 'cancelled'].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        Session time (your device timezone)
        <input
          type="datetime-local"
          value={session}
          onChange={(event) => setSession(event.target.value)}
          required={status === 'confirmed' || status === 'completed'}
        />
      </label>
      <label>
        Reason for change
        <textarea
          required
          minLength={10}
          maxLength={2000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button disabled={busy}>Save booking change</button>
      <p role="status">{message}</p>
    </form>
  )
}
export function DraftAction({
  enquiry,
  templates,
  onDone,
}: {
  enquiry: number
  templates: EmailTemplate[]
  onDone: () => Promise<void>
}) {
  const [template, setTemplate] = useState('')
  const [preview, setPreview] = useState<EmailMessage>()
  const [error, setError] = useState('')
  const { run, busy, message } = useRecordAction()
  return (
    <section>
      <h3>Prepare a reply</h3>
      <p>Save an exact private draft to this conversation. Customer sending is disabled.</p>
      <label>
        Reply template
        <select value={template} onChange={(event) => setTemplate(event.target.value)}>
          <option value="">Choose approved wording</option>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {!templates.length && (
        <p>
          First <Link href="/admin/collections/email-templates">create and approve a template</Link>
          .
        </p>
      )}
      <button
        disabled={!template || busy}
        onClick={async () => {
          setError('')
          const result = await run({ action: 'prepareEmail', enquiry, template: Number(template) })
          if (!result?.id) return
          try {
            setPreview(
              (
                await workspaceJSON<{ message: EmailMessage }>(
                  `/api/customer-records?message=${result.id}`,
                )
              ).message,
            )
            await onDone()
          } catch {
            setError(
              'Draft saved, but its preview could not load. Open it from the conversation and retry.',
            )
          }
        }}
      >
        Prepare private reply draft
      </button>
      <p role="status">{message}</p>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <>
          <button onClick={() => setPreview(undefined)}>Close reply preview</button>
          <p>To: {preview.recipient} · Draft only</p>
          <h4>{preview.subject}</h4>
          <EmailFrame html={preview.html} />
        </>
      )}
    </section>
  )
}
