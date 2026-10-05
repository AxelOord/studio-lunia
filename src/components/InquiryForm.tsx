'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { validateInquiry, type InquiryErrors, type ServiceChoice } from '@/lib/inquiry'
import { usePrivacy } from './PrivacyControls'

export function InquiryForm({
  services,
  initialService = '',
}: {
  services: ServiceChoice[]
  initialService?: string
}) {
  const [service, setService] = useState(initialService)
  const [errors, setErrors] = useState<InquiryErrors>({})
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState('')
  const submission = useRef('')
  const submitting = useRef(false)
  const result = useRef<HTMLDivElement>(null)
  const { track, syncCampaign, settleMeasurement } = usePrivacy()
  useEffect(() => {
    submission.current = crypto.randomUUID()
  }, [])
  useEffect(() => {
    if (receipt || error || Object.keys(errors).length) result.current?.focus()
  }, [receipt, error, errors])
  if (receipt)
    return (
      <div className="inquiry-success" ref={result} tabIndex={-1} role="status">
        <p className="eyebrow">ENQUIRY RECEIVED</p>
        <h2>Thank you. Your enquiry is saved.</h2>
        <p>
          Reference: <strong>{receipt}</strong>
        </p>
        <p>
          The photographer can now review it and follow up with you personally. This is an enquiry,
          not a confirmed booking.
        </p>
        <p className="field-help">
          Preview: no email confirmation is sent to visitors. Please use synthetic details only.
        </p>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            submission.current = crypto.randomUUID()
            setReceipt('')
            setService('')
          }}
        >
          Start another enquiry
        </button>
      </div>
    )
  if (!services.length)
    return (
      <p role="status">
        There are no published services to enquire about yet. Please check back later.
      </p>
    )
  return (
    <form
      className="inquiry-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        if (submitting.current) return
        const form = e.currentTarget
        const input = Object.fromEntries(new FormData(form))
        const body = { ...input, submissionId: submission.current }
        const validated = validateInquiry(body)
        setErrors(validated.errors)
        setError('')
        setConflict(false)
        if (!validated.data) return
        submitting.current = true
        setBusy(true)
        try {
          await syncCampaign()
          // Bounded optional requests settle before completion so the funnel remains ordered.
          await settleMeasurement()
          const response = await fetch('/api/inquiry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
          })
          const data = await response.json()
          setConflict(response.status === 409)
          if (response.ok && typeof data.receipt === 'string') setReceipt(data.receipt)
          else if (data.errors) setErrors(data.errors)
          else
            setError(
              data.error ||
                'We could not save your enquiry. Your details are still here; please try again.',
            )
        } catch {
          setError(
            'We could not confirm your enquiry. Your details are still here; try again to safely check and save it once.',
          )
        } finally {
          submitting.current = false
          setBusy(false)
        }
      }}
      onChange={() => {
        if (service) track('inquiry_started', service)
      }}
    >
      {(error || Object.keys(errors).length > 0) && (
        <div className="form-error" ref={result} tabIndex={-1} role="alert">
          <strong>{error || 'Please check the highlighted fields.'}</strong>
          {conflict && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                submission.current = crypto.randomUUID()
                setConflict(false)
                setError('')
              }}
            >
              Start a separate enquiry with these details
            </button>
          )}
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a href={`#inquiry-${field}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <label htmlFor="inquiry-service">Photography service</label>
      <select
        id="inquiry-service"
        name="service"
        required
        value={service}
        disabled={busy}
        aria-invalid={Boolean(errors.service)}
        aria-describedby={errors.service ? 'error-service' : undefined}
        onChange={(e) => {
          setService(e.target.value)
          if (e.target.value) {
            track('service_viewed', e.target.value)
            track('inquiry_started', e.target.value)
          }
        }}
      >
        <option value="">Choose a service</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>
      {errors.service && (
        <p id="error-service" className="field-error">
          {errors.service}
        </p>
      )}
      <div className="form-pair">
        {(['name', 'email'] as const).map((field) => (
          <div key={field}>
            <label htmlFor={`inquiry-${field}`}>
              {field === 'name' ? 'Your name' : 'Email address'}
            </label>
            <input
              id={`inquiry-${field}`}
              name={field}
              type={field === 'email' ? 'email' : 'text'}
              autoComplete={field}
              maxLength={field === 'email' ? 254 : 100}
              required
              disabled={busy}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `error-${field}` : undefined}
            />
            {errors[field] && (
              <p id={`error-${field}`} className="field-error">
                {errors[field]}
              </p>
            )}
          </div>
        ))}
      </div>
      <label htmlFor="inquiry-message">What do you have in mind?</label>
      <p className="field-help" id="message-help">
        Tell us a little about your photography enquiry. Please avoid sensitive personal
        information.
      </p>
      <textarea
        id="inquiry-message"
        name="message"
        rows={6}
        minLength={10}
        maxLength={3000}
        required
        disabled={busy}
        aria-invalid={Boolean(errors.message)}
        aria-describedby={`message-help${errors.message ? ' error-message' : ''}`}
      />
      {errors.message && (
        <p id="error-message" className="field-error">
          {errors.message}
        </p>
      )}
      <div className="form-trap" aria-hidden="true">
        <label htmlFor="inquiry-website">Leave this field empty</label>
        <input id="inquiry-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="field-help">
        Your name, email and message are stored privately for this enquiry and manual follow-up.
        Optional tracking is not required. <Link href="/privacy">Privacy notice</Link>.
      </p>
      <button className="button-link" type="submit" disabled={busy}>
        {busy ? 'Saving your enquiry…' : 'Send enquiry'}
      </button>
      <p className="field-help" role="status">
        {busy
          ? 'Please keep this page open while we save your enquiry.'
          : 'You’ll see a confirmation here after your enquiry is saved.'}
      </p>
    </form>
  )
}
