export const metadata = { title: 'Preview privacy notice' }
export default function PrivacyPage() {
  return (
    <section className="text-section privacy-notice">
      <h1>Preview privacy notice</h1>
      <p>This is a synthetic website preview. Please do not submit real customer information.</p>
      <h2>Your enquiry</h2>
      <p>
        Name, email, selected service and message are saved privately in Payload so the photographer
        can review and manually follow up. No visitor email is sent in this preview. The
        photographer notification contains no contact details or message. This processing works
        without optional tracking consent.
      </p>
      <h2>Your studio session</h2>
      <p>
        Name, email and your agreed session details are saved privately to manage the booking,
        approval and any staff-arranged changes. Pending approval uses one place until approved or
        cancelled. No payment is taken and no visitor email is sent. Private test drafts and dated
        history are retained with the booking. Optional tracking is not required.
      </p>
      <h2>Optional measurement</h2>
      <p>
        Only after you allow it, and when an approved PostHog EU project is connected, we measure
        service views, enquiry starts, saved enquiries, studio-day views, time selections and saved
        studio reservations. Studio completion distinguishes confirmed from awaiting approval.
        Events contain random session and opaque service or studio-day identifiers, never your name,
        email, message, selected session time, campaign tags, click IDs or full URLs. We do not
        record sessions or create person profiles. A measurement cookie lasts for the browser
        session, up to 24 hours.
      </p>
      <h2>Optional campaign storage</h2>
      <p>
        Only after you allow it, we keep first and last campaign tags and Google advertising click
        identifiers in a first-party cookie for up to 30 days and copy them to your enquiry or
        studio booking. Supported tags are source, medium, campaign, campaign ID and content ID.
        Free-text search terms and arbitrary URL parameters are discarded. Without consent,
        attribution is marked withheld.
      </p>
      <h2>Change your mind</h2>
      <p>
        Use Privacy choices below to decline or withdraw either purpose. Your preference is
        remembered for 180 days. Withdrawal removes optional browser cookies and stops future
        collection. It cannot recall events already sent and does not delete an enquiry or studio
        booking already submitted. Ask the preview owner to remove synthetic enquiry records when
        review is complete.
      </p>
      <h2>Before public launch</h2>
      <p>
        This preview notice is not a final legal policy. The site owner must approve the
        controller/contact details, processing basis, operational retention, provider terms,
        analytics retention and any data-subject request process before live customer use. Hosted
        analytics is inactive until separately configured and verified.
      </p>
    </section>
  )
}
