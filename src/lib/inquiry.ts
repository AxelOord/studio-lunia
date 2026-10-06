export type ServiceChoice = {
  id: string
  title: string
  description?: string
  inclusions?: string | null
  priceGuidance?: string | null
  responseExpectation?: string | null
}
export type InquiryInput = {
  service: string
  name: string
  email: string
  message: string
  submissionId: string
  website: string
}
export type InquiryErrors = Partial<Record<keyof InquiryInput, string>>
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const servicePattern = /^[0-9]+:[a-zA-Z0-9-]{1,80}$/

export function validateInquiry(value: unknown): { data?: InquiryInput; errors: InquiryErrors } {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const text = (key: string) => (typeof v[key] === 'string' ? (v[key] as string).trim() : '')
  const data: InquiryInput = {
    service: text('service'),
    name: text('name'),
    email: text('email').toLowerCase(),
    message: text('message'),
    submissionId: text('submissionId'),
    website: text('website'),
  }
  const errors: InquiryErrors = {}
  if (!servicePattern.test(data.service)) errors.service = 'Choose a service.'
  if (data.name.length < 2 || data.name.length > 100 || /[\r\n\x00-\x1f]/.test(data.name))
    errors.name = 'Enter your name (2–100 characters).'
  if (data.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email))
    errors.email = 'Enter a valid email address.'
  if (
    data.message.length < 10 ||
    data.message.length > 3000 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(data.message)
  )
    errors.message = 'Tell us about your enquiry (10–3,000 characters).'
  if (!uuidPattern.test(data.submissionId)) errors.submissionId = 'Refresh the page and try again.'
  if (data.website) errors.website = 'Unable to accept this enquiry.'
  return { data: Object.keys(errors).length ? undefined : data, errors }
}
