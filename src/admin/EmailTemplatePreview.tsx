'use client'
import { useFormFields } from '@payloadcms/ui'
import { useState } from 'react'
import {
  emailVariables,
  renderEmail,
  syntheticEmailVariables,
  type EmailVariables,
} from '@/customer-records/email-renderer'
import { EmailFrame } from './record-ui'

export function EmailTemplatePreview() {
  const subject = (useFormFields(([fields]) => fields.subject?.value) as string) || ''
  const body = (useFormFields(([fields]) => fields.body?.value) as string) || ''
  const [variables, setVariables] = useState<EmailVariables>(syntheticEmailVariables)
  let rendered,
    error = ''
  try {
    rendered = renderEmail(subject, body, variables)
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Incomplete template.'
  }
  return (
    <section className="customer-records">
      <h2>Live email preview</h2>
      <p>
        Uses the sending renderer with synthetic examples. Editing or previewing never sends.
        Allowed variables are shown below.
      </p>
      <details>
        <summary>Example variables</summary>
        <div className="customer-grid">
          {emailVariables.map((key) => (
            <label key={key}>
              {key}
              <input
                value={variables[key] || ''}
                onChange={(event) => setVariables({ ...variables, [key]: event.target.value })}
              />
            </label>
          ))}
        </div>
      </details>
      {error ? (
        <p role="status" className="customer-error">
          {error}
        </p>
      ) : (
        rendered && (
          <>
            <h3>{rendered.subject}</h3>
            <EmailFrame html={rendered.html} />
          </>
        )
      )}
    </section>
  )
}
