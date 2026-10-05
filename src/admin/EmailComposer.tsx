'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { recordURL, useRecordAction } from './record-ui'

export function EmailComposer({ enquiry, booking }: { enquiry?: number; booking?: number }) {
  const [templates, setTemplates] = useState<{ id: number; name: string; kind: string }[]>([])
  const [selected, setSelected] = useState('')
  const [link, setLink] = useState('')
  const { busy, message, run } = useRecordAction()
  useEffect(() => {
    fetch('/api/customer-records')
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {})
  }, [])
  const prepare = async (test: boolean) => {
    const result = await run({
      action: test ? 'prepareTestEmail' : 'prepareEmail',
      template: Number(selected),
      ...(booking ? { booking } : { enquiry }),
    })
    if (result?.id) setLink(recordURL('email-messages', result.id))
  }
  return (
    <section className="customer-records">
      <h3>Prepare an email</h3>
      <p>
        A customer draft stays private and unscheduled. A sandbox test substitutes synthetic values;
        review its frozen content before the explicit send action.
      </p>
      <label>
        Approved template
        <select
          aria-label="Approved template"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Choose a template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} · {template.kind}
            </option>
          ))}
        </select>
      </label>
      {!templates.length && (
        <p>
          Create and approve wording in{' '}
          <Link href="/admin/collections/email-templates">Email templates</Link> first.
        </p>
      )}
      <div className="customer-actions">
        <button type="button" disabled={busy || !selected} onClick={() => void prepare(false)}>
          Prepare private customer draft
        </button>
        <button type="button" disabled={busy || !selected} onClick={() => void prepare(true)}>
          Prepare synthetic sandbox test
        </button>
      </div>
      <p role="status">{message}</p>
      {link && <a href={link}>Open exact prepared email</a>}
    </section>
  )
}
