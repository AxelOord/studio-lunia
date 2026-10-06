import { expect, test } from 'vitest'
import { studioConfiguration, studioIntervals, studioPrice } from '../src/studio-days/domain'

const base = {
  location: 'Synthetic studio',
  localDate: '2027-03-28',
  timeZone: 'Europe/Amsterdam',
  offerTitle: 'Synthetic offer',
  inclusions: 'Synthetic inclusion',
  durationMinutes: 30,
  bufferMinutes: 0,
  capacity: 1,
  priceMinor: 100,
  currency: 'EUR',
  changePolicy: 'Synthetic terms',
  confirmationMode: 'immediate',
  bookingsOpen: true,
  dayState: 'scheduled',
  opensLocal: '02:30',
  closesLocal: '05:00',
  bookingDeadlineLocal: '2027-03-27T12:00',
}
test('studio schedules reject DST gaps and require explicit offsets in folds', () => {
  expect(() => studioConfiguration(base)).toThrow(/does not exist/)
  const fold = {
    ...base,
    localDate: '2027-10-31',
    closesLocal: '03:30',
    bookingDeadlineLocal: '2027-10-30T12:00',
  }
  expect(() => studioConfiguration(fold)).toThrow(/twice/)
  const first = studioConfiguration({ ...fold, openOffset: 120 })
  const second = studioConfiguration({ ...fold, openOffset: 60 })
  expect(studioIntervals(first)).toHaveLength(4)
  expect(studioIntervals(second)).toHaveLength(2)
  expect(() => studioConfiguration({ ...fold, openOffset: 0 })).toThrow(/does not match/)
})
test('slots fit session plus buffer and currency uses the actual minor-unit precision', () => {
  const config = studioConfiguration({
    ...base,
    opensLocal: '09:00',
    closesLocal: '10:00',
    bufferMinutes: 15,
  })
  expect(studioIntervals(config)).toHaveLength(1)
  expect(studioPrice(12300, 'EUR')).toContain('123.00')
  expect(studioPrice(12300, 'JPY')).toContain('12,300')
  expect(() =>
    studioConfiguration({ ...base, opensLocal: '09:00', closesLocal: '09:30', bufferMinutes: 15 }),
  ).toThrow(/fit/)
})
