import type { ServiceChoice } from '@/lib/inquiry'

export function ServiceOffer({ service }: { service: ServiceChoice }) {
  const inclusions = service.inclusions
    ?.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return (
    <section className="service-offer" aria-label="Selected service details">
      <p className="service-offer-title">
        <strong>{service.title}</strong>
      </p>
      {service.description && <p>{service.description}</p>}
      {inclusions?.length ? (
        <ul>
          {inclusions.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}
      {service.priceGuidance && (
        <p>
          <strong>Price guidance:</strong> {service.priceGuidance}
        </p>
      )}
      {service.responseExpectation && <p>{service.responseExpectation}</p>}
    </section>
  )
}

export function EnquirySteps() {
  return (
    <section className="enquiry-steps" aria-labelledby="enquiry-steps-heading">
      <p className="eyebrow">WHAT HAPPENS NEXT</p>
      <h2 id="enquiry-steps-heading">From an idea to an agreed session.</h2>
      <ol>
        <li>
          <strong>Send an enquiry</strong>
          <p>Share your idea and the service you are interested in.</p>
        </li>
        <li>
          <strong>Receive a receipt</strong>
          <p>See your reference after your request is saved.</p>
        </li>
        <li>
          <strong>Discuss a personal proposal</strong>
          <p>The photographer reviews your request and follows up personally.</p>
        </li>
        <li>
          <strong>Confirm the booking</strong>
          <p>A session is confirmed only after its details have been agreed.</p>
        </li>
      </ol>
      <p className="field-help">An enquiry does not reserve a date or confirm a booking.</p>
    </section>
  )
}
