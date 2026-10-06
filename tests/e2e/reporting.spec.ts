import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

test.use({ timezoneId: 'UTC' })
const origin = 'http://127.0.0.1:3000'
const reportURL = '/admin/conversions?from=2026-08-01&to=2026-08-31'
let editor: APIRequestContext
let pageID: number, enquiryID: number, contactID: number, bookingID: number
let keys: string[]
async function localDB(work: (db: Client) => Promise<void>) {
  const url = new URL(process.env.DATABASE_URL!)
  expect(['localhost', '127.0.0.1']).toContain(url.hostname)
  expect(url.pathname).toMatch(/^\/lunia_test_[a-f0-9]{32}$/)
  const db = new Client({ connectionString: url.href })
  await db.connect()
  try {
    await work(db)
  } finally {
    await db.end()
  }
}
async function operation(input: Record<string, unknown>) {
  const key = randomUUID()
  keys.push(key)
  const response = await editor.post('/api/customer-records', {
    headers: { origin },
    data: { ...input, key },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}
test.beforeEach(async ({ playwright }) => {
  keys = []
  editor = await playwright.request.newContext({ baseURL: origin })
  expect(
    (
      await editor.post('/api/users/login', {
        data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
      })
    ).ok(),
  ).toBe(true)
  const page = await editor.post('/api/pages', {
    data: {
      title: 'Synthetic report service',
      slug: 'report-' + randomUUID(),
      description: 'Synthetic reporting browser fixture',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Synthetic services',
          items: [
            { title: 'Synthetic baseline portrait', body: 'Synthetic service for reporting.' },
          ],
        },
      ],
    },
  })
  expect(page.ok(), await page.text()).toBe(true)
  const { doc } = await page.json()
  pageID = doc.id
  const email = 'report-' + randomUUID() + '@example.test'
  const lead = await editor.post('/api/inquiry', {
    headers: { origin },
    data: {
      service: pageID + ':' + doc.layout[0].items[0].id,
      name: 'PrivateReportNameMarker',
      email,
      message: 'PrivateReportMessageMarker synthetic fixture.',
      website: '',
      submissionId: randomUUID(),
    },
  })
  expect(lead.ok(), await lead.text()).toBe(true)
  const found = await (
    await editor.get('/api/enquiries?depth=0&where[email][equals]=' + encodeURIComponent(email))
  ).json()
  enquiryID = found.docs[0].id
  contactID = found.docs[0].contact
  await localDB(async (db) => {
    await db.query("UPDATE enquiries SET created_at='2026-08-15T12:00:00Z' WHERE id=$1", [
      enquiryID,
    ])
  })
  bookingID = (
    await operation({
      action: 'proposeBooking',
      enquiry: enquiryID,
      expectedMinor: 12500,
      currency: 'EUR',
      sessionAt: '2027-01-10T10:00:00Z',
    })
  ).id
  await operation({
    action: 'changeBooking',
    booking: bookingID,
    status: 'confirmed',
    expectedMinor: 12500,
    reason: 'Synthetic confirmed baseline booking.',
  })
  await operation({
    action: 'recordMoney',
    booking: bookingID,
    kind: 'payment',
    amountMinor: 10000,
    occurredAt: '2026-08-16T12:00:00Z',
    reason: 'Synthetic manual payment recorded outside site.',
  })
})
test.afterEach(async () => {
  await localDB(async (db) => {
    await db.query('DELETE FROM customer_activities WHERE contact_id=$1', [contactID])
    await db.query('DELETE FROM revenue_entries WHERE contact_id=$1', [contactID])
    await db.query('DELETE FROM email_messages WHERE contact_id=$1', [contactID])
    await db.query('DELETE FROM bookings WHERE contact_id=$1', [contactID])
    await db.query('DELETE FROM enquiries WHERE id=$1', [enquiryID])
    await db.query('DELETE FROM contacts WHERE id=$1', [contactID])
    await db.query('DELETE FROM customer_operations WHERE operation_key=ANY($1)', [keys])
  })
  await editor.delete('/api/pages/' + pageID)
  await editor.dispose()
})
async function login(page: Page) {
  await page.context().addCookies((await editor.storageState()).cookies)
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/customer-records') &&
      request.postDataJSON().key
    )
      keys.push(request.postDataJSON().key)
  })
}
async function noOverflow(page: Page) {
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    outside: Array.from(document.querySelectorAll('main *'))
      .filter((element) => element.getBoundingClientRect().right > innerWidth)
      .slice(0, 15)
      .map((element) => ({
        tag: element.tagName,
        class: element.className,
        text: element.textContent?.slice(0, 60),
      })),
  }))
  expect(layout.documentWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width)
}
async function recordResponse(page: Page, at: string, reason: string) {
  await page
    .getByLabel('First personal response time (your local timezone)')
    .fill(at.replace(/:00$/, ''))
  await page.getByLabel('Response record reason', { exact: true }).fill(reason)
  await page.getByLabel('I confirm this is the first personal outbound response').check()
  await page.getByRole('button', { name: 'Record first response time', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await (await editor.get('/api/conversion-report?responseFor=' + enquiryID)).json())
          .recordedAt,
    )
    .toBe(at + '.000Z')
}
test('cohort report traces exact source records, captures and corrects first human response, and stays usable on mobile', async ({
  page,
}) => {
  await login(page)
  const errors: string[] = [],
    tracking: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/posthog|api\/measurement/.test(request.url())) tracking.push(request.url())
  })
  await page.goto(reportURL)
  await expect(
    page.getByRole('heading', { name: 'Conversion overview', exact: true }),
  ).toBeVisible()
  const bespoke = page.getByRole('region', { name: 'Bespoke enquiry outcomes', exact: true })
  await expect(bespoke).toContainText('1 / 1 · 100.0%')
  await expect(bespoke).toContainText('Expected €125.00 · Recorded net €100.00')
  await expect(bespoke).toContainText('Median unavailable')
  await expect(page.getByRole('region', { name: 'Consented session funnel' })).toContainText(
    'Analytics reporting is off.',
  )
  await page.getByRole('button', { name: 'View bespoke source records', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Source records', exact: true })).toBeFocused()
  const moneyLink = page.getByRole('link', { name: 'Money entries', exact: true })
  const moneyHref = (await moneyLink.getAttribute('href'))!
  const ledger = await editor.get(moneyHref.replace('/admin/collections', '/api') + '&depth=0')
  expect(ledger.ok(), await ledger.text()).toBe(true)
  const entries = await ledger.json()
  expect(entries.totalDocs).toBe(1)
  expect(entries.docs[0]).toMatchObject({ booking: bookingID, amountMinor: 10000 })
  await moneyLink.click()
  await expect(page).toHaveURL(new RegExp('/admin/collections/revenue-entries'))
  await expect(page.getByRole('table')).toContainText(entries.docs[0].label)
  await page.goto(reportURL)
  await page.getByRole('link', { name: 'Enquiry #' + enquiryID, exact: true }).click()
  await expect(page).toHaveURL(new RegExp('/admin/collections/enquiries/' + enquiryID))
  await page.getByText('First human response', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await recordResponse(
    page,
    '2026-08-15T14:00:00',
    'Verified the first personal response for baseline.',
  )
  await page.goto(reportURL)
  await expect(bespoke).toContainText('Median 2.0 hours')
  await page.screenshot({ path: 'test-results/conversion-overview-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow(page)
  await page
    .locator('.report-funnels')
    .screenshot({ path: 'test-results/conversion-funnels-mobile.png' })
  await page.getByRole('combobox', { name: 'Break down by', exact: true }).selectOption('campaigns')
  await page.getByRole('button', { name: 'Apply report filters', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Outcome breakdown', exact: true })).toContainText(
    'Withheld · no campaign consent',
  )
  await expect(page.getByRole('region', { name: 'Outcome breakdown', exact: true })).toContainText(
    'Unavailable · no matched campaign spend',
  )
  await noOverflow(page)
  const breakdown = page.getByRole('region', { name: 'Scrollable outcome breakdown' })
  await breakdown.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => breakdown.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  await page.getByRole('region', { name: 'Outcome breakdown', exact: true }).screenshot({
    path: 'test-results/conversion-breakdown-mobile.png',
  })
  await page.goto('/admin/collections/enquiries/' + enquiryID)
  await page.getByText('First human response', { exact: true }).click()
  await recordResponse(
    page,
    '2026-08-15T16:00:00',
    'Corrected the first personal response timestamp.',
  )
  await noOverflow(page)
  await page
    .locator('details')
    .filter({ has: page.getByText('First human response', { exact: true }) })
    .screenshot({ path: 'test-results/conversion-response-mobile.png' })
  await page
    .getByLabel('Response record reason', { exact: true })
    .fill('Cleared an incorrect staff response attestation.')
  await page.getByRole('button', { name: 'Clear incorrect response time', exact: true }).click()
  await expect
    .poll(
      async () =>
        (await (await editor.get('/api/conversion-report?responseFor=' + enquiryID)).json())
          .recordedAt,
    )
    .toBeNull()
  await page.goto(reportURL)
  await expect(bespoke).toContainText('Median unavailable')
  expect(errors).toEqual([])
  expect(tracking).toEqual([])
})
test('report access, empty cohorts and recoverable read failures do not fabricate metrics or lose filters', async ({
  page,
  playwright,
}) => {
  const anonymous = await playwright.request.newContext({ baseURL: origin })
  expect((await anonymous.get('/api/conversion-report')).status()).toBe(401)
  expect((await anonymous.get('/api/conversion-report?responseFor=' + enquiryID)).status()).toBe(
    401,
  )
  await anonymous.dispose()
  const invalid = await editor.get('/api/conversion-report?from=2026-02-30')
  expect(invalid.status()).toBe(422)
  expect(invalid.headers()['cache-control']).toBe('no-store')
  const result = await editor.get('/api/conversion-report?from=2026-08-01&to=2026-08-31')
  expect(result.ok()).toBe(true)
  expect(await result.text()).not.toMatch(
    /PrivateReportNameMarker|PrivateReportMessageMarker|@example.test/,
  )
  await login(page)
  await page.goto(reportURL)
  await page.route('**/api/conversion-report?**', (route) =>
    route.fulfill({ status: 503, json: { error: 'Synthetic reporting read failed.' } }),
  )
  await page.getByRole('button', { name: 'Refresh report', exact: true }).click()
  const reportError = page
    .getByRole('alert')
    .filter({ hasText: 'Synthetic reporting read failed.' })
  await expect(reportError).toContainText('previously loaded report remains')
  await expect(page.getByLabel('From · UTC', { exact: true })).toHaveValue('2026-08-01')
  await page.unroute('**/api/conversion-report?**')
  await page.getByRole('button', { name: 'Retry report', exact: true }).click()
  await expect(reportError).toHaveCount(0)
  await page.getByLabel('From · UTC', { exact: true }).fill('2020-01-01')
  await page.getByLabel('Through · UTC', { exact: true }).fill('2020-01-01')
  await page.getByRole('button', { name: 'Apply report filters', exact: true }).click()
  await expect(
    page.getByText('No enquiries or studio bookings were created in this period.', {
      exact: false,
    }),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Bespoke enquiry outcomes' })).toContainText(
    'Unavailable · denominator is zero',
  )
  await expect(page.getByRole('region', { name: 'Consented session funnel' })).toContainText(
    'not instrumented',
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/conversion-empty-mobile.png', fullPage: true })
  await page.reload()
  await expect(page.getByLabel('From · UTC', { exact: true })).toHaveValue('2020-01-01')
})
