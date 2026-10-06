'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'
import type { Booking } from '../payload-types'
import type { studioWorkspace } from '../studio-days/queries'
import type { StudioAvailability } from '../components/StudioBookingForm'
import { studioPrice, studioTime, type StudioSnapshot } from '../studio-days/domain'
import { WorkspaceShell, workspaceJSON } from './workspace-ui'
import { useRecordAction } from './record-ui'

type StudioWorkspaceData = Awaited<ReturnType<typeof studioWorkspace>>
const relation = (value: number | { id: number } | null | undefined) =>
  typeof value === 'object' ? value?.id : value
export function StudioBookingCard({
  booking,
  onDone,
}: {
  booking: Booking
  onDone: () => Promise<void>
}) {
  const snapshot = booking.studioSnapshot as StudioSnapshot
  const [action, setAction] = useState('')
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState<StudioAvailability>()
  const [days, setDays] = useState<StudioWorkspaceData['publishedDays']>([])
  const [day, setDay] = useState('')
  const [slot, setSlot] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const request = useRef(0)
  const { run, busy, message } = useRecordAction('/api/studio-sessions')
  async function chooseDay(value: string) {
    const version = ++request.current
    setDay(value)
    setTarget(undefined)
    setSlot('')
    setAgreed(false)
    setError('')
    if (!value) return
    setLoading(true)
    try {
      const result = await workspaceJSON<StudioAvailability>(`/api/studio-sessions?day=${value}`)
      if (version === request.current) setTarget(result)
    } catch (error) {
      if (version === request.current)
        setError(error instanceof Error ? error.message : 'Availability could not load.')
    } finally {
      if (version === request.current) setLoading(false)
    }
  }
  async function start(value: string) {
    setAction(value)
    setReason('')
    setAgreed(false)
    setError('')
    if (value === 'reschedule') {
      setDay('')
      setSlot('')
      setTarget(undefined)
      setLoading(true)
      try {
        setDays(
          (await workspaceJSON<StudioWorkspaceData>('/api/studio-sessions?workspace=1'))
            .publishedDays,
        )
      } catch {
        setError('Studio days could not load. Try again.')
      } finally {
        setLoading(false)
      }
    }
  }
  async function save() {
    if (
      await run({
        action,
        booking: booking.id,
        revision: booking.studioRevision,
        reason,
        ...(action === 'reschedule'
          ? {
              day: Number(day),
              slot: Number(slot),
              scheduleRevision: target?.revision,
              conditionsAccepted: agreed,
            }
          : {}),
      })
    ) {
      setAction('')
      await onDone()
    }
  }
  return (
    <article className="studio-booking-card">
      <div className="studio-booking-heading">
        <h3>
          {typeof booking.contact === 'object' && booking.contact
            ? booking.contact.name
            : booking.title}
        </h3>
        <span className="workspace-badge">{booking.status.replaceAll('_', ' ')}</span>
      </div>
      <p>
        <strong>{studioTime(snapshot.startsAt, snapshot.timeZone)}</strong> · {snapshot.timeZone}
      </p>
      <p>
        {snapshot.offerTitle} · {snapshot.location} ·{' '}
        {studioPrice(snapshot.priceMinor, snapshot.currency)}
      </p>
      <div className="customer-actions">
        <Link href={`/admin/customers/${relation(booking.contact)}`}>Customer and history</Link>
        <Link href={`/admin/studio-days/${relation(booking.studioDay)}`}>Studio day</Link>
      </div>
      <details>
        <summary>Agreed session details</summary>
        <p>{snapshot.inclusions}</p>
        <p>{snapshot.changePolicy}</p>
        <p>
          {snapshot.durationMinutes} minute session, then {snapshot.bufferMinutes} minute buffer.
          These details are preserved when the day settings change.
        </p>
      </details>
      <p className="workspace-muted">
        Private test draft: {booking.studioMessageState || 'pending'} · No visitor email sent
      </p>
      {booking.studioMessageState !== 'ready' && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (await run({ action: 'retryMessages', booking: booking.id })) await onDone()
          }}
        >
          Prepare test draft again
        </button>
      )}
      {['pending_approval', 'confirmed'].includes(booking.status) && (
        <div className="customer-actions">
          {booking.status === 'pending_approval' && (
            <button type="button" disabled={busy} onClick={() => void start('approve')}>
              Approve session
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void start('reschedule')}>
            Reschedule
          </button>
          <button type="button" disabled={busy} onClick={() => void start('cancel')}>
            Cancel session
          </button>
        </div>
      )}
      {action && (
        <div className="studio-change-form" role="group" aria-label="Booking change">
          <h4>
            {action === 'approve'
              ? 'Approve this request'
              : action === 'cancel'
                ? 'Cancel this session and release its place'
                : 'Choose a replacement session'}
          </h4>
          {action === 'reschedule' && (
            <>
              <label>
                Replacement studio day
                <select
                  value={day}
                  required
                  disabled={busy || loading}
                  onChange={(event) => void chooseDay(event.target.value)}
                >
                  <option value="">Choose a published studio day</option>
                  {days.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.localDate} · {item.title}
                    </option>
                  ))}
                </select>
              </label>
              {target && (
                <>
                  <label>
                    Replacement time
                    <select
                      value={slot}
                      required
                      disabled={busy}
                      onChange={(event) => {
                        setSlot(event.target.value)
                        setAgreed(false)
                      }}
                    >
                      <option value="">Choose an available time</option>
                      {target.slots.map((item) => (
                        <option key={item.id} value={item.id} disabled={!item.remaining}>
                          {studioTime(item.startsAt, target.offer.timeZone)} · {item.remaining}{' '}
                          places
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="workspace-card">
                    <strong>
                      {target.offer.offerTitle} ·{' '}
                      {studioPrice(target.offer.priceMinor, target.offer.currency)}
                    </strong>
                    <p>
                      {target.offer.location} · {target.offer.durationMinutes} minutes ·{' '}
                      {target.offer.timeZone}
                    </p>
                    <p>{target.offer.inclusions}</p>
                    <p>{target.offer.changePolicy}</p>
                  </div>
                  <label className="studio-agreement">
                    <input
                      type="checkbox"
                      checked={agreed}
                      required
                      onChange={(event) => setAgreed(event.target.checked)}
                    />{' '}
                    The customer agreed to these replacement details, price and conditions.
                  </label>
                </>
              )}
              <p>
                The booking keeps its current approval status. The previous place is released only
                after the replacement is saved.
              </p>
            </>
          )}
          <label>
            Reason for this change
            <textarea
              required
              minLength={10}
              maxLength={2000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          </label>
          <div className="customer-actions">
            <button
              type="button"
              disabled={
                busy ||
                loading ||
                reason.trim().length < 10 ||
                (action === 'reschedule' && (!slot || !agreed))
              }
              onClick={() => void save()}
            >
              {busy ? 'Saving…' : 'Save booking change'}
            </button>
            <button type="button" disabled={busy} onClick={() => setAction('')}>
              Keep current booking
            </button>
          </div>
        </div>
      )}
      {loading && <p role="status">Loading available sessions…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </article>
  )
}
function StaffReservation({
  availability,
  onDone,
}: {
  availability: StudioAvailability
  onDone: () => Promise<void>
}) {
  const { busy, run, message } = useRecordAction('/api/studio-sessions')
  const identity = useRef('')
  const [saved, setSaved] = useState(false)
  return (
    <details className="workspace-secondary">
      <summary>Add a session for a customer</summary>
      <p>
        Uses the same published availability and confirmation mode as the public form. Creates a
        separate customer record; matching emails are not merged.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          identity.current ||= crypto.randomUUID()
          const values = Object.fromEntries(new FormData(event.currentTarget))
          if (
            await run({
              ...values,
              action: 'staffReserve',
              day: availability.id,
              revision: availability.revision,
              slot: Number(values.slot),
              conditionsAccepted: values.conditionsAccepted === 'on',
              submissionId: identity.current,
            })
          ) {
            setSaved(true)
            await onDone()
          }
        }}
      >
        <label>
          Session
          <select name="slot" required disabled={busy || saved}>
            <option value="">Choose a time</option>
            {availability.slots.map((slot) => (
              <option key={slot.id} value={slot.id} disabled={!slot.remaining}>
                {studioTime(slot.startsAt, availability.offer.timeZone)} · {slot.remaining} places
              </option>
            ))}
          </select>
        </label>
        <div className="customer-grid">
          <label>
            Customer name
            <input name="name" required minLength={2} maxLength={100} disabled={busy || saved} />
          </label>
          <label>
            Customer email
            <input name="email" type="email" required maxLength={254} disabled={busy || saved} />
          </label>
        </div>
        <p>
          {availability.offer.offerTitle} ·{' '}
          {studioPrice(availability.offer.priceMinor, availability.offer.currency)} ·{' '}
          {availability.offer.location}
        </p>
        <p>{availability.offer.changePolicy}</p>
        <label className="studio-agreement">
          <input type="checkbox" name="conditionsAccepted" required disabled={busy || saved} /> The
          customer agreed to the displayed offer, price and conditions.
        </label>
        <button disabled={busy || saved}>
          {saved ? 'Session saved' : busy ? 'Saving…' : 'Save customer session'}
        </button>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  )
}
export function StudioWorkspace({ initial }: { initial: StudioWorkspaceData }) {
  const [data, setData] = useState(initial)
  const [error, setError] = useState('')
  async function reload() {
    try {
      setData(
        await workspaceJSON(
          `/api/studio-sessions?workspace=1${data.day ? `&day=${data.day.id}` : ''}`,
        ),
      )
      setError('')
    } catch {
      setError('This view could not refresh. Reload before repeating a saved action.')
    }
  }
  const pending = data.bookings.filter((booking) => booking.status === 'pending_approval')
  return (
    <WorkspaceShell
      title={data.day?.title || 'Studio days'}
      description="Manage the photographer’s rented studio days and customer sessions."
      actions={
        <>
          <Link href="/admin/collections/studio-days/create">New studio day</Link>
          <button onClick={() => void reload()}>Refresh availability</button>
        </>
      }
    >
      {error && <p role="alert">{error}</p>}
      {!data.day ? (
        <>
          <div className="studio-admin-grid">
            {data.days.map((day) => (
              <article key={day.id} className="workspace-card">
                <span className="workspace-badge">{day._status}</span>
                <h2>
                  <Link href={`/admin/studio-days/${day.id}`}>{day.title}</Link>
                </h2>
                <p>
                  {day.localDate} · {day.timeZone}
                </p>
                <p>{day.location}</p>
                <p>
                  {day.confirmationMode === 'manual'
                    ? 'Approval required'
                    : 'Immediate confirmation'}{' '}
                  · {day.bookingsOpen ? 'Bookings open' : 'Bookings closed'}
                </p>
                <Link href={`/admin/collections/studio-days/${day.id}`}>
                  Edit offer and availability
                </Link>
              </article>
            ))}
          </div>
          {!data.days.length && (
            <section className="workspace-card">
              <h2>Create your first studio day</h2>
              <p>
                Add the rented location, session offer and available hours, review a private draft,
                then publish.
              </p>
            </section>
          )}
          {data.hasMoreDays && (
            <Link href="/admin/collections/studio-days">Browse all studio days</Link>
          )}
        </>
      ) : (
        <>
          <div className="customer-actions">
            <Link href="/admin/studio-days">All studio days</Link>
            <Link href={`/admin/collections/studio-days/${data.day.id}`}>
              Edit, publish or close this day
            </Link>
            <Link href={`/preview/studio-days/${data.day.slug}`}>Private saved-draft preview</Link>
            {data.availability && (
              <Link href={`/studio-days/${data.availability.slug}`}>Open published page</Link>
            )}
          </div>
          <section className="workspace-card">
            <h2>
              {pending.length
                ? `${pending.length} ${pending.length === 1 ? 'request needs' : 'requests need'} approval`
                : 'Session overview'}
            </h2>
            <p>
              Pending requests hold one place until you approve or cancel them. No request expires
              automatically.
            </p>
            {data.availability ? (
              <>
                <p>
                  <strong>
                    Published availability: {data.availability.state.replaceAll('_', ' ')}
                  </strong>{' '}
                  ·{' '}
                  {data.availability.offer.confirmationMode === 'manual'
                    ? 'Approval required'
                    : 'Immediate confirmation'}
                </p>
                <div className="studio-slot-list">
                  {data.availability.slots.map((slot) => (
                    <div key={slot.id}>
                      <strong>
                        {studioTime(slot.startsAt, data.availability!.offer.timeZone)}
                      </strong>
                      <span>
                        {slot.remaining} {slot.remaining === 1 ? 'place' : 'places'} available
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p>No public availability. Complete the settings and publish the day when ready.</p>
            )}
          </section>
          {data.availability?.state === 'available' && (
            <StaffReservation availability={data.availability} onDone={reload} />
          )}
          <h2>Customer sessions ({data.bookings.length})</h2>
          {!data.bookings.length && <p>No sessions have been reserved.</p>}
          {[
            ...pending,
            ...data.bookings.filter((booking) => booking.status !== 'pending_approval'),
          ].map((booking) => (
            <StudioBookingCard
              key={`${booking.id}:${booking.studioRevision}`}
              booking={booking}
              onDone={reload}
            />
          ))}
          {data.hasMoreBookings && (
            <Link href="/admin/collections/bookings">Browse all booking records</Link>
          )}
        </>
      )}
    </WorkspaceShell>
  )
}
