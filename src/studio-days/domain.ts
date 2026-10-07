import { plannedInstant, validTimeZone } from '../followups/domain'

export type StudioConfiguration = {
  location: string
  localDate: string
  timeZone: string
  offerTitle: string
  inclusions: string
  durationMinutes: number
  bufferMinutes: number
  capacity: number
  priceMinor: number
  currency: string
  changePolicy: string
  confirmationMode: 'immediate' | 'manual'
  bookingsOpen: boolean
  dayState: 'scheduled' | 'cancelled'
  opensAt: string
  closesAt: string
  bookingDeadline: string
}
export type SlotInterval = { startsAt: string; endsAt: string; occupiedUntil: string }
export type StudioSnapshot = StudioConfiguration & SlotInterval & { revision: number }

function text(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new Error(`Enter ${label}.`)
  return value.trim()
}
function integer(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`Enter ${label} between ${min} and ${max}.`)
  return value
}
function offset(value: unknown) {
  return value === undefined || value === null || value === ''
    ? undefined
    : integer(value, 'a UTC offset in minutes', -840, 840)
}
export function studioConfiguration(input: Record<string, unknown>): StudioConfiguration {
  const timeZone = validTimeZone(text(input.timeZone, 'a timezone', 80))
  const localDate = text(input.localDate, 'the local studio date', 10)
  const instant = (time: unknown, utcOffset: unknown) =>
    plannedInstant(
      `${localDate}T${text(time, 'a local time (HH:mm)', 5)}`,
      timeZone,
      offset(utcOffset),
    )
  const opensAt = instant(input.opensLocal, input.openOffset)
  const closesAt = instant(input.closesLocal, input.closeOffset)
  if (closesAt <= opensAt)
    throw new Error('Closing time must be after opening on the same local day.')
  const bookingDeadline = plannedInstant(
    text(input.bookingDeadlineLocal, 'the booking deadline', 16),
    timeZone,
    offset(input.deadlineOffset),
  )
  if (bookingDeadline > closesAt) throw new Error('The booking deadline must not be after closing.')
  const currency = text(input.currency, 'a three-letter currency', 3).toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency) || !Intl.supportedValuesOf('currency').includes(currency))
    throw new Error('Choose a supported ISO currency.')
  if (!['immediate', 'manual'].includes(String(input.confirmationMode)))
    throw new Error('Choose a confirmation mode.')
  if (!['scheduled', 'cancelled'].includes(String(input.dayState)))
    throw new Error('Choose a day state.')
  const config: StudioConfiguration = {
    location: text(input.location, 'the studio location', 300),
    localDate,
    timeZone,
    offerTitle: text(input.offerTitle, 'the session offer', 140),
    inclusions: text(input.inclusions, 'what the session includes', 2000),
    durationMinutes: integer(input.durationMinutes, 'session minutes', 5, 480),
    bufferMinutes: integer(input.bufferMinutes, 'buffer minutes', 0, 240),
    capacity: integer(input.capacity, 'places per slot', 1, 10),
    priceMinor: integer(input.priceMinor, 'the price in minor currency units', 0, 100_000_000),
    currency,
    changePolicy: text(input.changePolicy, 'change and cancellation conditions', 3000),
    confirmationMode: input.confirmationMode as StudioConfiguration['confirmationMode'],
    bookingsOpen: input.bookingsOpen === true,
    dayState: input.dayState as StudioConfiguration['dayState'],
    opensAt,
    closesAt,
    bookingDeadline,
  }
  if (!studioIntervals(config).length)
    throw new Error('The available hours must fit a session and its buffer.')
  return config
}
export function studioIntervals(config: StudioConfiguration): SlotInterval[] {
  const slots: SlotInterval[] = []
  const duration = config.durationMinutes * 60000
  const step = (config.durationMinutes + config.bufferMinutes) * 60000
  const end = Date.parse(config.closesAt)
  for (let start = Date.parse(config.opensAt); start + step <= end; start += step) {
    slots.push({
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + duration).toISOString(),
      occupiedUntil: new Date(start + step).toISOString(),
    })
    if (slots.length > 300) throw new Error('Choose hours that produce no more than 300 slots.')
  }
  return slots
}
export function studioTime(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset',
  }).format(new Date(instant))
}
export function studioPrice(minor: number, currency: string) {
  const formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency })
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(minor / 10 ** digits)
}
