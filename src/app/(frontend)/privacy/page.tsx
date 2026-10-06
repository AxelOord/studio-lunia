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
        service views, enquiry starts and saved enquiries. Events contain random session and opaque
        service identifiers, never your name, email, message, campaign tags or full URLs. We do not
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
      <h2>Optional page tests</h2>
      <p>
        With your separate permission, a signed browser cookie keeps a page-test variant for up to
        30 days from grant. We store a keyed anonymous identifier, assigned variant, visible CTA
        exposure and whether a matching enquiry was saved within 30 days. No form details, contact
        record, campaign tags or full URLs are included. Results describe browsers, not people.
        Withdrawal removes the cookie and blocks future use of that identifier; existing test counts
        remain. Live experiments are disabled for this groundwork. Staff simulations use separate,
        labelled experiments.
      </p>
      <h2>Change your mind</h2>
      <p>
        Use Privacy choices below to decline or withdraw any optional purpose. Your preference is
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
