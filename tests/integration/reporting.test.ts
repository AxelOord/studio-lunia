import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createEditor, createTestCMS } from '../helpers/payload'
import { submitInquiry } from '../../src/inquiries/submit'
import { denied, leadAttribution } from '../../src/inquiries/privacy'
import { recordOperation } from '../../src/customer-records/operations'
import { conversionReport, firstResponse } from '../../src/reporting/queries'
import { campaignTouch, updateCampaign } from '../../src/lib/campaign'
import { reserveStudioSlot, changeStudioBooking } from '../../src/studio-days/reservations'
import { studioAvailability } from '../../src/studio-days/queries'

let fixture: Awaited<ReturnType<typeof createTestCMS>>
let user: Awaited<ReturnType<typeof createEditor>>
let service: string
const period = { from: '2026-09-01', to: '2026-09-30' }
beforeAll(async () => {
  fixture = await createTestCMS()
})
beforeEach(async () => {
  await fixture.reset()
  user = await createEditor(fixture.payload)
  const page = await fixture.payload.create({
    collection: 'pages',
    user,
    overrideAccess: false,
    data: {
      title: 'Synthetic reporting service',
      slug: 'reporting',
      description: 'Synthetic reporting fixture',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Synthetic services',
          items: [{ title: 'Synthetic portrait offer', body: 'Synthetic report fixture only' }],
        },
      ],
    },
  })
  const block = page.layout[0]
  if (block.blockType !== 'services') throw new Error('Missing synthetic service')
  service = page.id + ':' + block.items![0].id
})
afterAll(async () => {
  await fixture?.close()
})
async function enquiry(at = '2026-09-15T12:00:00Z') {
  const result = await submitInquiry(
    fixture.payload,
    {
      service,
      name: 'PrivateNameMarker',
      email: 'PrivateEmailMarker@example.test',
      message: 'PrivateMessageMarker synthetic enquiry details.',
      website: '',
      submissionId: randomUUID(),
    },
    denied,
  )
  if (!result.doc) throw new Error('Missing enquiry')
  await fixture.payload.db.pool.query('UPDATE enquiries SET created_at=$1 WHERE id=$2', [
    at,
    result.doc.id,
  ])
  return result.doc
}
function op(input: Record<string, unknown>, key = randomUUID()) {
  return recordOperation(fixture.payload, user, { ...input, key })
}
async function booking(enquiryID: number, status: string, expectedMinor: number, currency = 'EUR') {
  const key = randomUUID()
  const input = {
    action: 'proposeBooking',
    enquiry: enquiryID,
    expectedMinor,
    currency,
    sessionAt: '2026-09-20T10:00:00Z',
  }
  const first = await op(input, key)
  expect(await op(input, key)).toEqual(first)
  await op({
    action: 'changeBooking',
    booking: first.id,
    status,
    expectedMinor,
    reason: 'Synthetic status for reconciliation.',
  })
  return Number(first.id)
}
test('creation cohorts reconcile repeat contacts, late outcomes, retries, cancellations and corrected money per currency', async () => {
  const { payload } = fixture
  const first = await enquiry('2026-09-01T00:00:00Z'),
    repeat = await enquiry('2026-09-30T23:59:59.999Z')
  const sameEmail = await enquiry()
  await payload.update({
    collection: 'enquiries',
    id: repeat.id,
    user,
    overrideAccess: false,
    data: { contact: first.contact },
  })
  const before = await enquiry('2026-08-31T23:59:59.999Z'),
    after = await enquiry('2026-10-01T00:00:00Z')
  const confirmed = await booking(first.id, 'confirmed', 10000)
  const cancelled = await booking(first.id, 'cancelled', 20000)
  await booking(repeat.id, 'completed', 30000)
  const yen = await booking(repeat.id, 'completed', 5000, 'JPY')
  await booking(before.id, 'confirmed', 99999)
  await booking(after.id, 'confirmed', 99999)
  const paymentKey = randomUUID(),
    pay = {
      action: 'recordMoney',
      booking: confirmed,
      kind: 'payment',
      amountMinor: 10000,
      occurredAt: '2026-09-10T12:00:00Z',
      reason: 'Synthetic payment recorded externally.',
    }
  const original = await op(pay, paymentKey)
  expect(await op(pay, paymentKey)).toEqual(original)
  await op({ ...pay, kind: 'refund', amountMinor: 1000 })
  await op({ ...pay, action: 'correctMoney', entry: original.id, amountMinor: 8000 })
  await op({ ...pay, booking: cancelled, amountMinor: 5000 })
  await op({ ...pay, booking: yen, amountMinor: 4000 })
  const report = await conversionReport(payload, user, period)
  expect(report.bespoke).toMatchObject({
    intents: 3,
    contacts: 2,
    qualified: 2,
    converted: 2,
    bookings: 4,
    confirmed: 1,
    completed: 2,
    cancelled: 1,
    cancellation: { numerator: 1, denominator: 4 },
    money: [
      { currency: 'EUR', expected: 40000, recorded: 12000 },
      { currency: 'JPY', expected: 5000, recorded: 4000 },
    ],
  })
  expect(report.studio.intents).toBe(0)
  expect(report.sources.map((row) => row.id)).toEqual([first.id, repeat.id, sameEmail.id])
  expect(report.groups[0].metrics).toEqual(report.bespoke)
  expect(JSON.stringify(report)).not.toMatch(
    /PrivateNameMarker|PrivateEmailMarker|PrivateMessageMarker/,
  )
  expect((await conversionReport(payload, user, period)).bespoke).toEqual(report.bespoke)
  expect(
    (await conversionReport(payload, user, { from: '2026-08-01', to: '2026-08-31' })).bespoke
      .intents,
  ).toBe(1)
})
test('staff first-response attestation is validated, correctable, clearable and idempotent without counting automation', async () => {
  const { payload } = fixture
  const lead = await enquiry('2026-09-15T08:00:00Z')
  await booking(lead.id, 'proposed', 10000)
  await op({
    action: 'recordReply',
    contact: typeof lead.contact === 'object' ? lead.contact!.id : lead.contact,
    note: 'Synthetic customer reply, not an outbound response.',
    occurredAt: '2026-09-15T09:00:00Z',
  })
  expect((await conversionReport(payload, user, period)).bespoke.responded).toBe(0)
  const key = randomUUID(),
    record = {
      action: 'recordFirstResponse',
      enquiry: lead.id,
      occurredAt: '2026-09-15T10:00:00Z',
      attested: true,
      reason: 'First personal outbound response verified.',
    }
  const saved = await op(record, key)
  expect((await conversionReport(payload, user, period)).bespoke).toMatchObject({
    responded: 1,
    medianResponseHours: 2,
  })
  await op({
    ...record,
    occurredAt: '2026-09-15T11:00:00Z',
    reason: 'Corrected the actual outbound timestamp.',
  })
  expect(await op(record, key)).toEqual(saved)
  expect((await firstResponse(payload, user, lead.id)).recordedAt).toBe('2026-09-15T11:00:00.000Z')
  expect((await conversionReport(payload, user, period)).bespoke.medianResponseHours).toBe(3)
  for (const patch of [
    { attested: false },
    { occurredAt: '2026-09-15T07:59:59Z' },
    { occurredAt: '2099-01-01T00:00:00Z' },
    { reason: 'short' },
  ])
    await expect(op({ ...record, ...patch })).rejects.toThrow()
  await op({
    action: 'clearFirstResponse',
    enquiry: lead.id,
    reason: 'Cleared an incorrectly reported response.',
  })
  expect((await conversionReport(payload, user, period)).bespoke).toMatchObject({
    responded: 0,
    medianResponseHours: null,
  })
  expect((await firstResponse(payload, user, lead.id)).recordedAt).toBeNull()
  const history = await payload.find({
    collection: 'customer-activities',
    user,
    overrideAccess: false,
    where: { kind: { in: ['first_response_recorded', 'first_response_cleared'] } },
  })
  expect(history.totalDocs).toBe(3)
  expect(
    (await payload.count({ collection: 'email-messages', user, overrideAccess: false })).totalDocs,
  ).toBe(0)
})
test('campaign groups preserve frozen historical first/last, withheld and unknown attribution with exact source drilldown', async () => {
  const { payload } = fixture
  const tagged = await enquiry(),
    withheld = await enquiry(),
    unknown = await enquiry()
  const at = Date.parse('2026-09-01T00:00:00Z')
  const snapshot = updateCampaign(
    updateCampaign(
      undefined,
      campaignTouch({ utm_source: 'newsletter', utm_campaign: 'first_offer' }, 'unknown', at),
    ),
    campaignTouch(
      { utm_source: 'google', utm_id: 'last_offer', gclid: 'PrivateClickMarker' },
      'unknown',
      at + 1000,
    ),
  )
  await payload.db.pool.query('UPDATE enquiries SET attribution=$1 WHERE id=$2', [
    JSON.stringify(leadAttribution({ campaigns: true, analytics: false, decided: true }, snapshot)),
    tagged.id,
  ])
  await payload.db.pool.query("UPDATE enquiries SET attribution='{}' WHERE id=$1", [unknown.id])
  const last = await conversionReport(payload, user, { ...period, groupBy: 'campaigns' })
  expect(last.groups.map((row) => row.label)).toEqual(
    expect.arrayContaining([
      'Withheld · no campaign consent',
      'Unknown attribution',
      expect.stringContaining('last_offer'),
    ]),
  )
  expect(last.groups.reduce((total, row) => total + row.metrics.intents, 0)).toBe(3)
  const group = last.groups.find((row) => row.label.includes('last_offer'))!
  const sources = await conversionReport(payload, user, {
    ...period,
    groupBy: 'campaigns',
    group: group.key,
  })
  expect(sources.sources.map((row) => row.id)).toEqual([tagged.id])
  expect(JSON.stringify(last)).not.toContain('PrivateClickMarker')
  const first = await conversionReport(payload, user, {
    ...period,
    groupBy: 'campaigns',
    touch: 'first',
  })
  expect(first.groups.some((row) => row.label.includes('first_offer'))).toBe(true)
  expect([withheld.id, unknown.id]).not.toContain(sources.sources[0].id)
})
test('complete totals and paginated sources cross the database batch boundary without truncation or duplication', async () => {
  const { payload } = fixture
  const lead = await enquiry()
  const contact = typeof lead.contact === 'object' ? lead.contact!.id : lead.contact
  await payload.db.pool.query(
    `INSERT INTO enquiries (contact_id,service_id,service_title,name,email,message,submission_hash,content_hash,attribution,created_at)
    SELECT $1,'1:'||gen_random_uuid()::text,'Synthetic historical offer '||n,'PrivateBulkNameMarker','bulk@example.test',
      'PrivateBulkMessageMarker','batch-'||n,'content-'||n,'{}','2026-09-15T12:00:00Z'
    FROM generate_series(1,1000) n`,
    [contact],
  )
  await payload.db.pool
    .query(`INSERT INTO bookings (title,contact_id,enquiry_id,source,status,session_at,expected_minor,currency,attribution)
    SELECT 'Synthetic batch booking',contact_id,id,'staff_enquiry','confirmed','2026-09-20T10:00:00Z',100,'EUR','{}' FROM enquiries`)
  const report = await conversionReport(payload, user, {
    ...period,
    sourcePage: '51',
    groupPage: '51',
  })
  expect(report.bespoke).toMatchObject({
    intents: 1001,
    contacts: 1,
    qualified: 1001,
    converted: 1001,
    bookings: 1001,
    money: [{ currency: 'EUR', expected: 100100, recorded: 0 }],
  })
  expect(report.sourceCount).toBe(1001)
  expect(report.sources).toHaveLength(1)
  expect(report.groupCount).toBe(1001)
  expect(report.groups).toHaveLength(1)
  expect(JSON.stringify(report)).not.toMatch(/PrivateBulkNameMarker|PrivateBulkMessageMarker/)
})
test('anonymous and row-restricted access fail before any aggregate data is returned', async () => {
  const { payload } = fixture
  const lead = await enquiry()
  await expect(conversionReport(payload, null, period)).rejects.toMatchObject({ status: 401 })
  const original = payload.collections.enquiries.config.access.read
  payload.collections.enquiries.config.access.read = () => ({ id: { equals: lead.id } })
  try {
    await expect(conversionReport(payload, user, period)).rejects.toMatchObject({ status: 403 })
  } finally {
    payload.collections.enquiries.config.access.read = original
  }
})
async function studio() {
  const doc = await fixture.payload.create({
    collection: 'studio-days',
    user,
    overrideAccess: false,
    data: {
      title: 'Synthetic reporting studio',
      slug: 'reporting-studio',
      location: 'Synthetic venue',
      localDate: '2027-03-27',
      timeZone: 'Europe/Amsterdam',
      offerTitle: 'Synthetic portrait session',
      inclusions: 'Synthetic inclusion',
      durationMinutes: 30,
      bufferMinutes: 15,
      capacity: 1,
      priceMinor: 12300,
      currency: 'EUR',
      opensLocal: '09:00',
      closesLocal: '12:00',
      bookingDeadlineLocal: '2027-03-27T08:00',
      changePolicy: 'Synthetic reviewed conditions.',
      confirmationMode: 'manual',
      bookingsOpen: true,
      dayState: 'scheduled',
      _status: 'published',
    },
  })
  const available = await studioAvailability(fixture.payload, doc.id)
  const reserve = (index: number) =>
    reserveStudioSlot(
      fixture.payload,
      {
        day: doc.id,
        slot: available.slots[index].id,
        revision: available.revision,
        name: 'PrivateStudioNameMarker',
        email: 'studio@example.test',
        conditionsAccepted: true,
        submissionId: randomUUID(),
        website: '',
      },
      denied,
    )
  return { doc, reserve }
}
test('studio cohorts and current published occupancy use separate dates and preserve pending/cross-revision commitments', async () => {
  const { payload } = fixture
  const { doc, reserve } = await studio()
  const first = (await reserve(0)).booking,
    second = (await reserve(2)).booking
  const today = new Date().toISOString().slice(0, 10)
  expect((await conversionReport(payload, user, { from: today, to: today })).studio).toMatchObject({
    intents: 2,
    pending: 2,
    converted: 0,
  })
  const sessions = { from: '2027-03-27', to: '2027-03-27' }
  const initial = await conversionReport(payload, user, sessions)
  expect(initial.studio.intents).toBe(0)
  expect(initial.occupancy).toEqual({ capacity: 4, allocated: 2, slots: 4, outside: 0 })
  await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    data: { durationMinutes: 60, acknowledgeBookings: true, _status: 'published' },
  })
  await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    draft: true,
    data: { capacity: 10, opensLocal: '10:00' },
  })
  expect((await conversionReport(payload, user, sessions)).occupancy).toEqual({
    capacity: 2,
    allocated: 2,
    slots: 2,
    outside: 0,
  })
  await changeStudioBooking(payload, user, {
    key: randomUUID(),
    action: 'cancel',
    booking: second.id,
    revision: 1,
    reason: 'Synthetic cancellation for occupancy.',
  })
  expect((await conversionReport(payload, user, sessions)).occupancy.allocated).toBe(1)
  await payload.update({
    collection: 'studio-days',
    id: doc.id,
    user,
    overrideAccess: false,
    data: { dayState: 'cancelled', acknowledgeBookings: true, _status: 'published' },
  })
  expect((await conversionReport(payload, user, sessions)).occupancy).toEqual({
    capacity: 0,
    allocated: 0,
    slots: 0,
    outside: 1,
  })
  expect(
    (await payload.findByID({ collection: 'bookings', id: first.id, user, overrideAccess: false }))
      .studioSnapshot,
  ).toEqual(first.studioSnapshot)
})
test('empty cohorts have unknown rates and keep all-date operational counts separate', async () => {
  const lead = await enquiry()
  await booking(lead.id, 'confirmed', 1000)
  const report = await conversionReport(fixture.payload, user, {
    from: '2020-01-01',
    to: '2020-01-01',
  })
  expect(report.bespoke).toMatchObject({
    intents: 0,
    money: [],
    responded: 0,
    medianResponseHours: null,
    cancellation: { numerator: 0, denominator: 0 },
  })
  expect(report.operational.newEnquiries).toBe(1)
  expect(report.sourceCount).toBe(0)
})
