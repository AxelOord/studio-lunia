'use client'
import { useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

export function RetryNotification() {
  const { id } = useDocumentInfo()
  const [message, setMessage] = useState(
    'Failed or interrupted notifications can be retried up to three times within 23 hours of the first attempt. Older notifications without a frozen snapshot require manual review. Otherwise follow up manually. Accepted means provider acceptance, not verified delivery. Visitor email is never sent in preview.',
  )
  const [busy, setBusy] = useState(false)
  return (
    <div>
      <p role="status">{message}</p>
      <button
        type="button"
        disabled={!id || busy}
        onClick={async () => {
          setBusy(true)
          try {
            const result = await fetch(`/api/inquiry/${id}/retry`, { method: 'POST' })
            const data = await result.json()
            setMessage(
              result.ok
                ? `Notification: ${data.status}. Reload this record to see its latest state.`
                : 'Could not retry. Reload the record and try again.',
            )
          } catch {
            setMessage('Could not retry. Your enquiry remains saved; follow up manually if needed.')
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Retrying…' : 'Retry photographer notification'}
      </button>
    </div>
  )
}
