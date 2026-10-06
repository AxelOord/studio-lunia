'use client'
import { useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'
import { EmailComposer } from './EmailComposer'
import { FirstResponse } from './FirstResponse'
import { isoDate, recordURL, useRecordAction } from './record-ui'

export function EnquiryActions() {
  const { id } = useDocumentInfo()
  const [currency, setCurrency] = useState('')
  const [amount, setAmount] = useState('0')
  const [date, setDate] = useState('')
  const [link, setLink] = useState('')
  const { busy, message, run } = useRecordAction()
  if (!id) return null
  return (
    <>
      <section className="customer-records">
        <h2>Booking proposal</h2>
        <p>
          Create a staff-led proposal. This does not confirm a booking, reserve a slot or charge a
          payment.
        </p>
        <div className="customer-grid">
          <label>
            Expected value in minor units
            <input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label>
            Currency code
            <input
              placeholder="For example EUR"
              maxLength={3}
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            />
          </label>
        </div>
        <label>
          Proposed session time (optional; your local timezone)
          <input
            type="datetime-local"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            const result = await run({
              action: 'proposeBooking',
              enquiry: Number(id),
              expectedMinor: Number(amount),
              currency,
              sessionAt: isoDate(date),
            })
            if (result?.id) setLink(recordURL('bookings', result.id))
          }}
        >
          Create booking proposal
        </button>
        <p role="status">{message}</p>
        {link && <a href={link}>Open booking proposal</a>}
      </section>
      <FirstResponse key={String(id)} enquiry={Number(id)} />
      <EmailComposer enquiry={Number(id)} />
    </>
  )
}
