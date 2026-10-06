import Link from 'next/link'
import type { StudioDay } from '@/payload-types'
import { ContentBlocks } from './ContentBlocks'
import { StudioBookingForm, type StudioAvailability } from './StudioBookingForm'
import { StudioDayHeading } from './StudioDayHeading'
import { studioConfiguration, studioPrice, studioTime } from '@/studio-days/domain'

export function StudioDayPage({
  day,
  availability,
  preview = false,
}: {
  day: StudioDay
  availability?: StudioAvailability
  preview?: boolean
}) {
  let offer
  try {
    offer = studioConfiguration(day as unknown as Record<string, unknown>)
  } catch {
    /* Native drafts can be incomplete. */
  }
  return (
    <>
      {preview && (
        <div className="preview-banner">
          Private saved-draft preview · bookings disabled ·{' '}
          <Link href={`/admin/collections/studio-days/${day.id}`}>Return to editor</Link>
        </div>
      )}
      <section className="studio-day-intro">
        <Link href="/studio-days" className="text-button">
          All studio days
        </Link>
        <p className="eyebrow">A SESSION WITH THE PHOTOGRAPHER</p>
        {preview ? <h1>{day.title}</h1> : <StudioDayHeading day={day.id} title={day.title} />}
        {offer ? (
          <>
            <p className="studio-day-date">
              {studioTime(offer.opensAt, offer.timeZone)} · {offer.timeZone}
            </p>
            <div className="studio-offer-grid">
              <div>
                <h2>{offer.offerTitle}</h2>
                <p>{offer.inclusions}</p>
              </div>
              <dl>
                <div>
                  <dt>Location</dt>
                  <dd>{offer.location}</dd>
                </div>
                <div>
                  <dt>Session</dt>
                  <dd>{offer.durationMinutes} minutes</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>{studioPrice(offer.priceMinor, offer.currency)}</dd>
                </div>
                <div>
                  <dt>Booking deadline</dt>
                  <dd>{studioTime(offer.bookingDeadline, offer.timeZone)}</dd>
                </div>
              </dl>
            </div>
            <details className="studio-conditions">
              <summary>Change and cancellation conditions</summary>
              <p>{offer.changePolicy}</p>
            </details>
            {!preview && availability?.state === 'available' && (
              <a href="#choose-session" className="button-link">
                Choose a session <span aria-hidden="true">↗</span>
              </a>
            )}
            <p>
              {offer.confirmationMode === 'manual'
                ? 'Requests require the photographer’s approval.'
                : 'Available sessions are confirmed immediately when saved.'}
            </p>
          </>
        ) : (
          <p>Complete the offer and availability settings before publishing.</p>
        )}
        <p className="preview-note">
          Website prototype · No payment or visitor email. Synthetic details only.
        </p>
      </section>
      {!!day.layout?.length && <ContentBlocks blocks={day.layout} editorPreview={preview} />}
      {!preview && availability && <StudioBookingForm initial={availability} />}
    </>
  )
}
