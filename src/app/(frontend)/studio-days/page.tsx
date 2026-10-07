import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Studio days' }
export default async function Page() {
  const days =
    process.env.LUNIA_SHOWCASE === 'true'
      ? []
      : (
          await (
            await getPayload({ config })
          ).find({
            collection: 'studio-days',
            overrideAccess: false,
            draft: false,
            depth: 0,
            limit: 100,
            sort: 'localDate',
          })
        ).docs
  return (
    <section className="studio-day-intro">
      <p className="eyebrow">PHOTOGRAPHY SESSIONS</p>
      <h1>Studio days</h1>
      <p>
        Explore the photographer’s studio days. Each page shows the session, location, price and
        availability.
      </p>
      {!days.length && <p>No studio days are published yet. Please check back later.</p>}
      <div className="studio-days-grid">
        {days.map((day) => (
          <article key={day.id} className="studio-day-card">
            <p className="eyebrow">{day.localDate}</p>
            <h2>
              <Link href={`/studio-days/${day.slug}`}>{day.title}</Link>
            </h2>
            <p>{day.location}</p>
            <p>
              {day.confirmationMode === 'manual'
                ? 'Photographer approval required'
                : 'Immediate confirmation'}
            </p>
            <Link href={`/studio-days/${day.slug}`}>View session details ↗</Link>
          </article>
        ))}
      </div>
    </section>
  )
}
