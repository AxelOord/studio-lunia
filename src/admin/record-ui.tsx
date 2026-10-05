'use client'
import { useRef, useState } from 'react'
import './customer-records.css'

export function useRecordAction() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const pending = useRef<{ value: string; key: string } | undefined>(undefined)
  const locked = useRef(false)
  async function run(input: Record<string, unknown>) {
    if (locked.current) return
    const value = JSON.stringify(input)
    if (!pending.current || pending.current.value !== value)
      pending.current = { value, key: crypto.randomUUID() }
    locked.current = true
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/customer-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, key: pending.current.key }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not confirm this action.')
      // Keep the completed identity too: a second click on unchanged details
      // must return the same result, even after the first response arrived.
      setMessage(
        data.status
          ? `Email status: ${data.status}.`
          : 'Saved. The record and dated history are available below.',
      )
      return data as { id?: number; collection?: string; status?: string }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not confirm this action. Retry without changing the details.',
      )
    } finally {
      locked.current = false
      setBusy(false)
    }
  }
  return { busy, message, run }
}
export const recordURL = (collection: string, id: number) =>
  `/admin/collections/${collection}/${id}`
export const localDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : 'Not recorded'
export const inputDate = (value?: string | null) => {
  const date = value ? new Date(value) : new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export const isoDate = (value: string) => (value ? new Date(value).toISOString() : undefined)
export function EmailFrame({ html }: { html: string }) {
  const [mobile, setMobile] = useState(false)
  return (
    <div>
      <div className="customer-actions">
        <button type="button" aria-pressed={!mobile} onClick={() => setMobile(false)}>
          Desktop email
        </button>
        <button type="button" aria-pressed={mobile} onClick={() => setMobile(true)}>
          Mobile email
        </button>
      </div>
      <iframe
        className="email-frame"
        title="Email content preview"
        sandbox=""
        srcDoc={html}
        style={{ maxWidth: mobile ? 340 : 640 }}
      />
    </div>
  )
}
