'use client'
import { useDocumentInfo } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'
import type { Booking, RevenueEntry } from '@/payload-types'
import { EmailComposer } from './EmailComposer'
import { inputDate, isoDate, localDate, useRecordAction } from './record-ui'

type View = { booking: Booking; entries: RevenueEntry[]; realisedMinor: number; truncated: boolean }
export function BookingActions() {
  const { id } = useDocumentInfo()
  const [view, setView] = useState<View>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('proposed')
  const [session, setSession] = useState('')
  const [expected, setExpected] = useState('0')
  const [reason, setReason] = useState('')
  const [kind, setKind] = useState('payment')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => inputDate())
  const [moneyReason, setMoneyReason] = useState('')
  const [entry, setEntry] = useState('')
  const { busy, message, run } = useRecordAction()
  const refresh = useCallback(() => {
    if (!id) return Promise.resolve()
    return fetch(`/api/customer-records?booking=${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load this record.')
        return response.json() as Promise<View>
      })
      .then((data) => {
        setView(data)
        setStatus(data.booking.status)
        setSession(data.booking.sessionAt ? inputDate(data.booking.sessionAt) : '')
        setExpected(String(data.booking.expectedMinor))
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
  const reversed = new Set(
    view?.entries.map((item) =>
      typeof item.reverses === 'object' ? item.reverses?.id : item.reverses,
    ),
  )
  return (
    <>
      <section className="customer-records">
        <h2>Booking actions</h2>
        {error && <p role="alert">{error}</p>}
        <p>
          Staff records only. These actions do not reserve calendar capacity or process payments.
        </p>
        {view && (
          <p>
            <strong>
              Expected: {view.booking.expectedMinor} {view.booking.currency} minor units. Net
              manually recorded: {view.realisedMinor} {view.booking.currency} minor units.
            </strong>
          </p>
        )}
        <div className="customer-grid">
          <label>
            Booking status
            <select
              aria-label="Booking status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {['proposed', 'confirmed', 'completed', 'cancelled'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Session time (your local timezone)
            <input
              type="datetime-local"
              value={session}
              onChange={(event) => setSession(event.target.value)}
            />
          </label>
          <label>
            Expected value in minor units
            <input
              type="number"
              min="0"
              step="1"
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
            />
          </label>
          <label>
            Reason for booking change
            <textarea
              value={reason}
              minLength={10}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !view || reason.trim().length < 10}
          onClick={async () => {
            const result = await run({
              action: 'changeBooking',
              booking: Number(id),
              status,
              sessionAt: isoDate(session),
              expectedMinor: Number(expected),
              reason,
            })
            if (result) {
              setReason('')
              await refresh()
            }
          }}
        >
          Record booking change
        </button>
        <h3>Manual money record</h3>
        <p>
          Record money already received or refunded outside this site. Corrections append a reversal
          and replacement, preserving the original.
        </p>
        <label>
          Record or correct
          <select
            aria-label="Record or correct"
            value={entry}
            onChange={(event) => setEntry(event.target.value)}
          >
            <option value="">Add a new record</option>
            {view?.entries
              .filter((item) => item.kind !== 'reversal' && !reversed.has(item.id))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  Correct #{item.id}: {item.kind} {item.amountMinor} · {localDate(item.occurredAt)}
                </option>
              ))}
          </select>
        </label>
        <div className="customer-grid">
          <label>
            Kind
            <select
              aria-label="Money record kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="payment">Payment received</option>
              <option value="refund">Refund made</option>
            </select>
          </label>
          <label>
            Amount in minor units (positive)
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label>
            Money received or refunded at (your local timezone)
            <input
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label>
            Record or correction reason
            <textarea
              value={moneyReason}
              minLength={10}
              maxLength={2000}
              onChange={(event) => setMoneyReason(event.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !view || !date || !amount || moneyReason.trim().length < 10}
          onClick={async () => {
            const result = await run({
              action: entry ? 'correctMoney' : 'recordMoney',
              booking: Number(id),
              ...(entry ? { entry: Number(entry) } : {}),
              kind,
              amountMinor: Number(amount),
              occurredAt: isoDate(date),
              reason: moneyReason,
            })
            if (result) {
              setAmount('')
              setMoneyReason('')
              setEntry('')
              await refresh()
            }
          }}
        >
          {entry ? 'Append correction' : 'Record money'}
        </button>
        <p role="status">{message}</p>
        <h3>Money history</h3>
        {view?.truncated && <p>Latest 100 entries shown; the net total includes all entries.</p>}
        <ol className="customer-list">
          {view?.entries.map((item) => (
            <li key={item.id}>
              <strong>
                #{item.id} {item.label}: {item.amountMinor} {item.currency} minor units
              </strong>
              <span className="customer-meta">
                {localDate(item.occurredAt)} ·{' '}
                {reversed.has(item.id) ? 'Corrected by a later entry' : item.kind}
              </span>
              {item.reason}
            </li>
          ))}
        </ol>
      </section>
      <EmailComposer booking={Number(id)} />
    </>
  )
}
