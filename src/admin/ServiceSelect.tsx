'use client'
import { useField } from '@payloadcms/ui'
import type { ServiceChoice } from '../lib/inquiry'

export function ServiceSelect({
  path,
  readOnly,
  services,
}: {
  path: string
  readOnly?: boolean
  services: ServiceChoice[]
}) {
  const { value, setValue, disabled, showError, errorMessage } = useField<string>({ path })
  const missing = Boolean(value) && !services.some((service) => service.id === value)
  return (
    <div className="field-type select">
      <label className="field-label" htmlFor={`field-${path}`}>
        Landing page service (optional)
      </label>
      <select
        id={`field-${path}`}
        value={value || ''}
        disabled={disabled || readOnly}
        aria-describedby={`description-${path}${showError ? ` error-${path}` : ''}`}
        aria-invalid={showError}
        onChange={(event) => setValue(event.target.value)}
        style={{
          width: '100%',
          padding: '12px',
          font: 'inherit',
          color: 'inherit',
          background: 'var(--theme-input-bg)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 4,
        }}
      >
        <option value="">Standard page — no service landing</option>
        {missing && <option value={value}>Selected service is unavailable — choose another</option>}
        {services.map((service) => (
          <option key={service.id} value={service.id}>
            {service.title}
          </option>
        ))}
      </select>
      <p className="field-description" id={`description-${path}`}>
        Choose a published service card. Its approved details and a matching enquiry action appear
        with the first section. Publish service changes, then reload this editor to refresh choices.
      </p>
      {showError && (
        <p id={`error-${path}`} role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
