export const emailVariables = [
  'contact_name',
  'service_title',
  'booking_status',
  'session_time',
  'expected_value',
  'studio_name',
] as const
export type EmailVariables = Partial<Record<(typeof emailVariables)[number], string>>
export const syntheticEmailVariables: EmailVariables = {
  contact_name: 'Synthetic Preview Customer',
  service_title: 'Synthetic photography service',
  booking_status: 'proposed',
  session_time: 'Example date to be agreed',
  expected_value: 'Example amount to be agreed',
  studio_name: 'Studio Lunia',
}
export type RenderedEmail = {
  subject: string
  text: string
  html: string
  variables: EmailVariables
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  )
export function renderEmail(
  subject: string,
  body: string,
  variables: EmailVariables,
): RenderedEmail {
  if (
    !subject.trim() ||
    subject.length > 200 ||
    /[\r\n\x00-\x1f]/.test(subject) ||
    !body.trim() ||
    body.length > 12000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(body)
  )
    throw new Error('Enter a subject and body within the allowed lengths.')
  const used: EmailVariables = {}
  const replace = (value: string) =>
    value.replace(/\{\{([^{}]+)\}\}/g, (_, raw: string) => {
      const key = raw.trim() as (typeof emailVariables)[number]
      if (!emailVariables.includes(key)) throw new Error(`Unknown variable: ${key.slice(0, 50)}`)
      const replacement = variables[key]
      if (typeof replacement !== 'string' || !replacement.trim() || replacement.length > 500)
        throw new Error(`Missing variable: ${key}`)
      used[key] = replacement
      return replacement
    })
  const resolvedSubject = replace(subject).trim()
  const text = replace(body).trim()
  if (
    /[\r\n\x00-\x1f]/.test(resolvedSubject) ||
    resolvedSubject.length > 240 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text) ||
    /\{\{|\}\}/.test(resolvedSubject + text)
  )
    throw new Error('Check the template variables and subject.')
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(
      (part) =>
        `<p style="margin:0 0 18px;line-height:1.6">${escape(part).replace(/\n/g, '<br>')}</p>`,
    )
    .join('')
  return {
    subject: resolvedSubject,
    text,
    variables: used,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f3ef;color:#25251f;font-family:Arial,sans-serif"><main style="max-width:600px;margin:auto;padding:28px 20px;background:#ffffff">${paragraphs}</main></body></html>`,
  }
}

export const notificationTemplate = {
  subject: 'Studio Lunia preview: enquiry to review',
  body: 'A synthetic preview enquiry is ready in Payload. Open the Enquiries collection in your Studio Lunia preview, review the record and update its follow-up status. No visitor email has been sent.',
}
