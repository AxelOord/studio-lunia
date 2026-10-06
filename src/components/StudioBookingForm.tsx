'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { studioAvailability } from '@/studio-days/queries'
import type { bookingReceipt } from '@/studio-days/reservations'
import { studioPrice, studioTime } from '@/studio-days/domain'
import { usePrivacy } from './PrivacyControls'

export type StudioAvailability = Awaited<ReturnType<typeof studioAvailability>>
const stateMessages: Record<string, string> = {
  cancelled:
    'This studio day has been cancelled. Existing bookings are reviewed personally by the photographer.',
  past: 'This studio day has passed.',
  closed: 'Booking is closed for this studio day.',
  sold_out: 'Every session is currently allocated. No waiting list is created by this page.',
}
export function StudioBookingForm({ initial }: { initial: StudioAvailability }) {
  const [availability, setAvailability] = useState(initial)
  const [slot, setSlot] = useState('')
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<ReturnType<typeof bookingReceipt>>()
  const submission = useRef('')
  const submitting = useRef(false)
  const result = useRef<HTMLDivElement>(null)
  const { syncCampaign, settleMeasurement, submissionPermissions } = usePrivacy()
  useEffect(() => {
    submission.current = crypto.randomUUID()
  }, [])
  useEffect(() => {
    if (error || receipt) result.current?.focus()
  }, [error, receipt])
  const offer = availability.offer
  async function refresh() {
    setBusy(true)
    try {
      const response = await fetch(`/api/studio-sessions?day=${initial.id}`, { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const next: StudioAvailability = await response.json()
      setAvailability(next)
      setSlot('')
      submission.current = crypto.randomUUID()
      setError('')
      setConflict(false)
    } catch {
      setError('Availability could not refresh. Your entered details are still here; try again.')
    } finally {
      setBusy(false)
    }
  }
  if (receipt)
    return (
      <div id="choose-session" className="inquiry-success" tabIndex={-1} ref={result} role="status">
        <p className="eyebrow">
          {receipt.status === 'pending_approval'
            ? 'REQUEST SAVED'
            : receipt.status === 'cancelled'
              ? 'BOOKING CANCELLED'
              : 'SESSION CONFIRMED'}
        </p>
        <h2>
          {receipt.status === 'pending_approval'
            ? 'Your session is awaiting approval.'
            : receipt.status === 'cancelled'
              ? 'This booking has been cancelled.'
              : 'Your session is reserved.'}
        </h2>
        <p>
          Reference: <strong>{receipt.receipt}</strong>
        </p>
        <p>
          {studioTime(receipt.session.startsAt, receipt.session.timeZone)} ·{' '}
          {receipt.session.timeZone}
        </p>
        <p>
          {receipt.session.location} · {receipt.session.offerTitle}
        </p>
        {receipt.status === 'pending_approval' && (
          <p>
            A place is allocated while the photographer reviews your request. It stays allocated
            until approval or cancellation.
          </p>
        )}
        <p>Prototype: no payment was taken and no visitor email was sent. Save this reference.</p>
        <Link href="/studio-days">View studio days</Link>
      </div>
    )
  return (
    <section id="choose-session" className="studio-reservation" aria-label="Choose your session">
      <div className="studio-form-heading">
        <p className="eyebrow">YOUR SESSION</p>
        <h2>Choose a time</h2>
        <p>
          {offer.confirmationMode === 'manual'
            ? 'Photographer approval required. Your request allocates one place until it is approved or cancelled.'
            : 'Your session is confirmed immediately after a successful submission.'}
        </p>
      </div>
      {availability.state !== 'available' ? (
        <div role="status">
          <p>{stateMessages[availability.state]}</p>
          <Link href="/studio-days">Browse other studio days</Link>
        </div>
      ) : (
        <form
          className="inquiry-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (submitting.current) return
            const fields = Object.fromEntries(new FormData(event.currentTarget))
            submitting.current = true
            setBusy(true)
            setError('')
            setConflict(false)
            try {
              await syncCampaign()
              await settleMeasurement()
              const response = await fetch('/api/studio-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...fields,
                  action: 'reserve',
                  ...submissionPermissions(),
                  conditionsAccepted: fields.conditionsAccepted === 'on',
                  day: availability.id,
                  slot: Number(slot),
                  revision: availability.revision,
                  submissionId: submission.current,
                }),
                signal: AbortSignal.timeout(15000),
              })
              const data = await response.json()
              if (response.ok) setReceipt(data)
              else {
                setError(data.error || 'Check your details and retry.')
                setConflict(response.status === 409)
              }
            } catch {
              setError(
                'We could not confirm the result. Keep these details and retry to check the same booking safely.',
              )
            } finally {
              submitting.current = false
              setBusy(false)
            }
          }}
        >
          {error && (
            <div ref={result} role="alert" tabIndex={-1} className="form-error">
              <strong>{error}</strong>
              {conflict && (
                <button type="button" onClick={() => void refresh()} disabled={busy}>
                  Refresh times and review details
                </button>
              )}
            </div>
          )}
          <label htmlFor="studio-slot">Session time · {offer.timeZone}</label>
          <select
            id="studio-slot"
            required
            value={slot}
            onChange={(event) => setSlot(event.target.value)}
            disabled={busy}
          >
            <option value="">Choose an available session</option>
            {availability.slots.map((item) => (
              <option key={item.id} value={item.id} disabled={!item.remaining}>
                {studioTime(item.startsAt, offer.timeZone)}
                {item.remaining
                  ? ` · ${item.remaining} ${item.remaining === 1 ? 'place' : 'places'} left`
                  : ' · full'}
              </option>
            ))}
          </select>
          <p className="field-help">
            Selecting a time does not hold it. Availability is checked again when you submit.
          </p>
          <div className="studio-review">
            <strong>
              {offer.offerTitle} · {studioPrice(offer.priceMinor, offer.currency)}
            </strong>
            <p>
              {offer.location} · {offer.durationMinutes} minutes
            </p>
            <p>{offer.inclusions}</p>
            <p>{offer.changePolicy}</p>
          </div>
          <div className="form-pair">
            <div>
              <label htmlFor="studio-name">Your name</label>
              <input
                id="studio-name"
                name="name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="studio-email">Email address</label>
              <input
                id="studio-email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                disabled={busy}
              />
            </div>
          </div>
          <label className="check-choice">
            <input type="checkbox" name="conditionsAccepted" required disabled={busy} /> I agree to
            the displayed session details and change and cancellation conditions.
          </label>
          <div className="form-trap" aria-hidden="true">
            <label htmlFor="studio-website">Leave empty</label>
            <input id="studio-website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <p className="field-help">
            Your name and email are stored privately to manage this session. Optional tracking is
            not required. <Link href="/privacy">Privacy notice</Link>.
          </p>
          <button className="button-link" disabled={busy}>
            {busy
              ? 'Saving your session…'
              : offer.confirmationMode === 'manual'
                ? 'Request this session'
                : 'Confirm this session'}
          </button>
          <p className="field-help" role="status">
            Prototype · Synthetic details only. No payment is taken and no visitor email is sent.
          </p>
        </form>
      )}
    </section>
  )
}
