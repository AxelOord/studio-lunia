'use client'
import { useDocumentInfo } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'
import type { Booking, CustomerActivity, EmailMessage, Enquiry } from '@/payload-types'
import { inputDate, isoDate, localDate, recordURL, useRecordAction } from './record-ui'

type View = {
  enquiries: Enquiry[]
  bookings: Booking[]
  messages: EmailMessage[]
  events: CustomerActivity[]
  truncated: boolean
  limitations: string
}
export function CustomerTimeline() {
  const { id } = useDocumentInfo()
  const [view, setView] = useState<View>()
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => inputDate())
  const { busy, message, run } = useRecordAction()
  const refresh = useCallback(() => {
    if (!id) return Promise.resolve()
    return fetch(`/api/customer-records?contact=${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load this record.')
        return response.json() as Promise<View>
      })
      .then((data) => {
        setView(data)
        setError('')
      })
      .catch((error) =>
        setError(error instanceof Error ? error.message : 'Could not load this record.'),
      )
  }, [id])
  useEffect(() => {
    void refresh()
  }, [refresh])
  if (!id) return <p>Save this contact to see their timeline.</p>
  return (
    <section className="customer-records">
      <h2>Customer history</h2>
      <button type="button" onClick={() => void refresh()}>
        Refresh history
      </button>
      {error && <p role="alert">{error}</p>}
      {view && (
        <>
          <p>{view.limitations}</p>
          {view.truncated && (
            <p role="status">
              Showing the latest 100 records per section. Use the collection lists for older
              records.
            </p>
          )}
          <div className="customer-grid">
            <div>
              <h3>Enquiries</h3>
              <ul className="customer-list">
                {view.enquiries.map((item) => (
                  <li key={item.id}>
                    <a href={recordURL('enquiries', item.id)}>{item.serviceTitle}</a>
                    <span className="customer-meta">
                      {localDate(item.createdAt)} · {item.followUp}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Bookings</h3>
              <ul className="customer-list">
                {view.bookings.map((item) => (
                  <li key={item.id}>
                    <a href={recordURL('bookings', item.id)}>{item.title}</a>
                    <span className="customer-meta">
                      {item.status} · Session: {localDate(item.sessionAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <h3>Email snapshots</h3>
          <ul className="customer-list">
            {view.messages.map((item) => (
              <li key={item.id}>
                <a href={recordURL('email-messages', item.id)}>{item.subject}</a>
                <span className="customer-meta">
                  {item.kind.replaceAll('_', ' ')} · {item.status} · {localDate(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          <h3>Dated activity</h3>
          <ol className="customer-list">
            {view.events.map((item) => (
              <li key={item.id}>
                <strong>{item.summary}</strong>
                <span className="customer-meta">
                  {localDate(item.occurredAt)} · Source: {item.source} · Recorded:{' '}
                  {localDate(item.createdAt)}
                </span>
                {item.details && (
                  <details>
                    <summary>Recorded detail</summary>
                    <pre className="customer-detail">{JSON.stringify(item.details, null, 2)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      <h3>Record a known reply</h3>
      <p>This adds a private staff note. It does not import or verify an external mailbox.</p>
      <label>
        Reply occurred (your local timezone)
        <input
          type="datetime-local"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <label>
        Known reply note
        <textarea
          value={note}
          minLength={10}
          maxLength={2000}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || note.trim().length < 10 || !date}
        onClick={async () => {
          const result = await run({
            action: 'recordReply',
            contact: Number(id),
            note,
            occurredAt: isoDate(date),
          })
          if (result) {
            setNote('')
            await refresh()
          }
        }}
      >
        Record staff-reported reply
      </button>
      <p role="status">{message}</p>
    </section>
  )
}
