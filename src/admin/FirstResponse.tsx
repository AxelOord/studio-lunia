'use client'
import { useEffect, useState } from 'react'
import { isoDate, localDate, useRecordAction } from './record-ui'
import { workspaceJSON } from './workspace-ui'

function localInput(value = new Date().toISOString()) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
}
export function FirstResponse({ enquiry }: { enquiry: number }) {
  const [current, setCurrent] = useState<string | null>()
  const [date, setDate] = useState(() => localInput())
  const [reason, setReason] = useState('')
  const [attested, setAttested] = useState(false)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState('')
  const { busy, message, run } = useRecordAction()
  useEffect(() => {
    let cancelled = false
    void workspaceJSON<{ recordedAt: string | null }>(
      `/api/conversion-report?responseFor=${enquiry}`,
    )
      .then((result) => {
        if (cancelled) return
        setCurrent(result.recordedAt)
        setDate(localInput(result.recordedAt || undefined))
        setError('')
      })
      .catch(() => {
        if (!cancelled) setError('The response record could not load. Retry before editing it.')
      })
    return () => {
      cancelled = true
    }
  }, [enquiry, version])
  async function save(clear = false) {
    const result = await run({
      action: clear ? 'clearFirstResponse' : 'recordFirstResponse',
      enquiry,
      occurredAt: isoDate(date),
      reason,
      attested,
    })
    if (result) {
      setAttested(false)
      setReason('')
      setVersion((value) => value + 1)
    }
  }
  return (
    <details className="workspace-secondary customer-records first-response">
      <summary>First human response</summary>
      <p>
        Recorded first personal outbound response:{' '}
        <strong>
          {current === undefined ? 'Loading…' : current ? localDate(current) : 'Not recorded'}
        </strong>
        .
      </p>
      <p>
        Record or correct the time you first personally replied outside this site. Automated
        receipts, prepared drafts and customer replies do not count. This action sends no email.
      </p>
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setVersion((value) => value + 1)}>
            Retry response record
          </button>
        </p>
      )}
      <label>
        First personal response time (your local timezone)
        <input
          type="datetime-local"
          step="1"
          value={date}
          disabled={busy || current === undefined || Boolean(error)}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <label>
        Response record reason
        <textarea
          value={reason}
          minLength={10}
          maxLength={2000}
          disabled={busy || current === undefined || Boolean(error)}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <label className="response-attestation">
        <input
          type="checkbox"
          checked={attested}
          disabled={busy || current === undefined || Boolean(error)}
          onChange={(event) => setAttested(event.target.checked)}
        />
        I confirm this is the first personal outbound response for this enquiry.
      </label>
      <div className="customer-actions">
        <button
          type="button"
          disabled={
            busy ||
            Boolean(error) ||
            current === undefined ||
            !date ||
            !attested ||
            reason.trim().length < 10
          }
          onClick={() => void save()}
        >
          Record first response time
        </button>
        <button
          type="button"
          disabled={busy || Boolean(error) || !current || reason.trim().length < 10}
          onClick={() => void save(true)}
        >
          Clear incorrect response time
        </button>
      </div>
      <p role="status">{message}</p>
    </details>
  )
}
