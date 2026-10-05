import { getPayload } from 'payload'
import config from '@payload-config'
import { publishedServices } from '@/inquiries/services'
import { InquiryForm } from '@/components/InquiryForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Make an enquiry' }
export default async function InquirePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>
}) {
  const services =
    process.env.LUNIA_SHOWCASE === 'true'
      ? []
      : await publishedServices(await getPayload({ config }))
  const selected = (await searchParams).service
  const initialService = services.some((s) => s.id === selected) ? selected : ''
  return (
    <section className="inquiry-page">
      <div className="inquiry-intro">
        <p className="eyebrow">LET’S MAKE SOMETHING PERSONAL</p>
        <h1>
          Tell us what
          <br />
          you have in mind.
        </h1>
        <p>
          Choose a photography service and share your idea. The photographer will review your
          enquiry and follow up personally.
        </p>
        <p className="preview-note">
          Website preview · Use synthetic details only. No visitor emails are sent and no booking is
          made.
        </p>
      </div>
      <InquiryForm services={services} initialService={initialService} />
    </section>
  )
}
