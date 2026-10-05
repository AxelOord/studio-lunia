'use client'
import { useDocumentInfo } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'
import type { EmailMessage } from '@/payload-types'
import { EmailFrame, localDate, useRecordAction } from './record-ui'

type View = {
  message: EmailMessage
  events: { kind: string; occurred_at: string; received_at: string }[]
}
export function EmailMessagePreview() {
  const { id } = useDocumentInfo()
  const [view, setView] = useState<View>()
  const [error, setError] = useState('')
  const { busy, message, run } = useRecordAction()
  const refresh = useCallback(() => {
    if (!id) return Promise.resolve()
    return fetch(`/api/customer-records?message=${id}`)
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
  if (!id) return null
  const item = view?.message
  const canSend =
    item &&
    item.kind !== 'customer_draft' &&
    ['draft', 'queued', 'failed', 'uncertain', 'sending'].includes(item.status)
  return (
    <section className="customer-records">
      <h2>Exact email snapshot</h2>
      <button type="button" onClick={() => void refresh()}>
        Refresh email status
      </button>
      {error && <p role="alert">{error}</p>}
      {item && (
        <>
          <p>
            <strong>Status: {item.status}</strong> · {item.kind.replaceAll('_', ' ')}
          </p>
          <p>
            Accepted means the sending service accepted the request. Delivered means the recipient
            mail server accepted it, not that someone read it. Live delivery callbacks require
            separately approved ingress and provider configuration.
          </p>
          <dl>
            <dt>Recipient</dt>
            <dd>{item.recipient}</dd>
            <dt>Sender</dt>
            <dd>{item.sender || 'Not configured for this draft'}</dd>
            <dt>Subject</dt>
            <dd>{item.subject}</dd>
            <dt>Prepared</dt>
            <dd>{localDate(item.createdAt)}</dd>
            <dt>Last attempt</dt>
            <dd>
              {localDate(item.lastAttemptAt)} ({item.attempts} attempts)
            </dd>
            <dt>Accepted</dt>
            <dd>{localDate(item.acceptedAt)}</dd>
            <dt>Delivered</dt>
            <dd>{localDate(item.deliveredAt)}</dd>
            <dt>Provider ID</dt>
            <dd>{item.providerId || 'Not recorded'}</dd>
          </dl>
          {item.failureCode && <p role="status">Safe failure category: {item.failureCode}</p>}
          <EmailFrame html={item.html} />
          <details>
            <summary>Frozen plain text and variables</summary>
            <pre className="customer-detail">{item.text}</pre>
            <pre className="customer-detail">
              {JSON.stringify(
                { variables: item.variables, template: item.templateSnapshot },
                null,
                2,
              )}
            </pre>
          </details>
          {item.kind === 'customer_draft' ? (
            <p>This customer draft is private and unscheduled. Customer sending is disabled.</p>
          ) : (
            <>
              <p>
                This is an own-recipient sandbox email. Sending uses the frozen recipient and
                content above. Retrying reuses the same provider idempotency key; uncertain or stale
                attempts may require manual review.
              </p>
              <button
                type="button"
                disabled={busy || !canSend}
                onClick={async () => {
                  await run({ action: 'sendEmail', message: Number(id) })
                  await refresh()
                }}
              >
                {item.attempts ? 'Retry the same sandbox email' : 'Send this sandbox email'}
              </button>
            </>
          )}
          <p role="status">{message}</p>
          <h3>Verified delivery facts</h3>
          {!view.events.length && <p>No verified delivery callback recorded.</p>}
          <ol className="customer-list">
            {view.events.map((event, index) => (
              <li key={`${event.kind}-${event.occurred_at}-${index}`}>
                {event.kind}
                <span className="customer-meta">
                  Occurred: {localDate(event.occurred_at)} · Received:{' '}
                  {localDate(event.received_at)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
