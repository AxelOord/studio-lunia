export const purposes = ['enquiry_followup', 'preparation', 'session_reminder'] as const
export type FollowUpPurpose = (typeof purposes)[number]
export const purposeLabels: Record<FollowUpPurpose, string> = {
  enquiry_followup: 'Enquiry follow-up',
  preparation: 'Session preparation',
  session_reminder: 'Session reminder',
}
export const followUpStates = [
  'planned',
  'blocked',
  'paused',
  'cancelled',
  'simulated',
  'failed',
] as const
export const editableStates = ['planned', 'blocked', 'paused', 'failed']
export const blockLabels: Record<string, string> = {
  reply_detection_unavailable:
    'Real reply detection is not configured. No-response automation is blocked.',
  reply_received: 'A later reply is recorded. Review the conversation before planning again.',
  booking_cancelled: 'The linked booking was cancelled.',
  booked: 'This enquiry already has a confirmed or completed booking.',
  enquiry_closed: 'The enquiry is closed.',
  contact_changed: 'The enquiry is now linked to a different customer. Review this plan.',
  contact_stopped: 'Follow-ups are stopped for this customer.',
  delivery_problem: 'An email has a delivery problem or an uncertain outcome.',
  session_changed: 'The linked session changed. This reminder is obsolete.',
  session_unconfirmed: 'A current confirmed session is required.',
  session_passed: 'The session has already started or passed.',
  recipient_changed: 'The customer email changed. Edit and review the recipient again.',
  rule_changed:
    'The planning rule changed or its test approval was withdrawn. Review and create a new plan.',
  late_reminder:
    'The planned reminder is already overdue for this session. Review instead of catching up automatically.',
}

export function validTimeZone(value: string) {
  if (!value || value.length > 80) throw new Error('Choose a valid timezone.')
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value }).format()
  } catch {
    throw new Error('Choose a valid timezone.')
  }
  return value
}

export function localTimeAt(instant: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant))
  const part = (name: string) => parts.find((p) => p.type === name)?.value
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

// Explicit candidates keep gaps and repeated DST times visible in both UI and API.
export function timeCandidates(localTime: string, timeZone: string) {
  validTimeZone(timeZone)
  if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localTime))
    throw new Error('Enter a complete date and time.')
  const guess = new Date(`${localTime}:00Z`)
  if (!Number.isFinite(guess.getTime()) || guess.toISOString().slice(0, 16) !== localTime)
    throw new Error('Enter a valid calendar date and time.')
  const candidates: { instant: string; offset: number }[] = []
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = new Date(guess.getTime() - offset * 60000).toISOString()
    if (localTimeAt(instant, timeZone) === localTime) candidates.push({ instant, offset })
  }
  return candidates.sort((a, b) => a.instant.localeCompare(b.instant))
}

export function plannedInstant(localTime: string, timeZone: string, offset?: number) {
  const candidates = timeCandidates(localTime, timeZone)
  if (!candidates.length)
    throw new Error(
      'This local time does not exist because the clock changes. Choose another time.',
    )
  if (candidates.length > 1 && offset === undefined)
    throw new Error('This time occurs twice. Choose the intended UTC offset.')
  const selected =
    offset === undefined ? candidates[0] : candidates.find((item) => item.offset === offset)
  if (!selected) throw new Error('The chosen UTC offset does not match this time and timezone.')
  return selected.instant
}
