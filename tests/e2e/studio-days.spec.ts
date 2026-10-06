import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const origin = 'http://127.0.0.1:3000'
let editor: APIRequestContext
let id: number
let slug: string
test.beforeEach(async ({ playwright }) => {
  editor = await playwright.request.newContext({ baseURL: origin })
  expect(
    (
      await editor.post('/api/users/login', {
        data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
      })
    ).ok(),
  ).toBe(true)
  slug = `studio-${randomUUID()}`
  const response = await editor.post('/api/studio-days', {
    data: {
      title: 'Synthetic portrait studio day',
      slug,
      location: 'Synthetic test studio · no real venue',
      localDate: '2027-03-27',
      timeZone: 'Europe/Amsterdam',
      offerTitle: 'Synthetic portrait session',
      inclusions: 'Synthetic planning conversation\nSynthetic image selection',
      durationMinutes: 30,
      bufferMinutes: 15,
      capacity: 1,
      priceMinor: 12300,
      currency: 'EUR',
      opensLocal: '09:00',
      closesLocal: '12:00',
      bookingDeadlineLocal: '2027-03-27T08:00',
      changePolicy:
        'Synthetic conditions: contact the preview editor to arrange a test change or cancellation.',
      confirmationMode: 'immediate',
      bookingsOpen: true,
      dayState: 'scheduled',
      _status: 'published',
      layout: [
        {
          blockType: 'text',
          heading: 'A synthetic session example',
          body: 'No real venue, price or availability is offered. Approved photographs and commercial copy will come from the photographer.',
        },
      ],
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
  id = (await response.json()).doc.id
})
test.afterEach(async () => {
  const url = new URL(process.env.DATABASE_URL!)
  expect(['localhost', '127.0.0.1']).toContain(url.hostname)
  expect(url.pathname).toMatch(/^\/lunia_test_[a-f0-9]{32}$/)
  const db = new Client({ connectionString: url.href })
  await db.connect()
  try {
    const contacts = (
      await db.query('SELECT contact_id FROM bookings WHERE studio_day_id = $1', [id])
    ).rows.map((row) => row.contact_id)
    await db.query(
      'DELETE FROM payload_jobs WHERE id IN (SELECT job_i_d FROM follow_ups WHERE contact_id = ANY($1))',
      [contacts],
    )
    await db.query('DELETE FROM follow_ups WHERE contact_id = ANY($1)', [contacts])
    await db.query('DELETE FROM customer_activities WHERE contact_id = ANY($1)', [contacts])
    await db.query('DELETE FROM email_messages WHERE contact_id = ANY($1)', [contacts])
    await db.query('DELETE FROM bookings WHERE studio_day_id = $1', [id])
    await db.query('DELETE FROM contacts WHERE id = ANY($1)', [contacts])
    await db.query('DELETE FROM studio_slots WHERE day_id = $1', [id])
    await db.query('DELETE FROM _studio_days_v WHERE parent_id = $1', [id])
    await db.query('DELETE FROM studio_days WHERE id = $1', [id])
  } finally {
    await db.end()
    await editor.dispose()
  }
})
async function change(data: Record<string, unknown>) {
  const response = await editor.patch(`/api/studio-days/${id}`, { data })
  expect(response.ok(), await response.text()).toBe(true)
  return (await response.json()).doc
}
async function fill(page: Page, index = 1) {
  await page.getByLabel('Session time ·').selectOption({ index })
  await page.getByLabel('Your name', { exact: true }).fill('Synthetic Studio Visitor')
  await page
    .getByLabel('Email address', { exact: true })
    .fill(`studio-${randomUUID()}@example.test`)
  await page.getByLabel('I agree to the displayed').check()
}
async function bookings() {
  const response = await editor.get(`/api/bookings?depth=0&where[studioDay][equals]=${id}`)
  expect(response.ok()).toBe(true)
  return (await response.json()).docs
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

test('mobile booking saves once after a lost response without consent and reaches the private customer workspace', async ({
  page,
}) => {
  test.setTimeout(120000)
  const errors: string[] = [],
    tracking: string[] = [],
    identities: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/api\/(campaign|measurement)|posthog/.test(request.url())) tracking.push(request.url())
  })
  await page.goto(
    `/studio-days/${slug}?utm_source=google&utm_campaign=synthetic_studio&gclid=SyntheticClick`,
  )
  await expect(
    page.getByRole('heading', { name: 'Synthetic portrait studio day', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('€123.00', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: 'test-results/studio-day-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Decline optional', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/studio-day-mobile.png', fullPage: true })
  await fill(page)
  let interrupted = false
  await page.route('**/api/studio-sessions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    identities.push(route.request().postDataJSON().submissionId)
    const response = await route.fetch()
    if (!interrupted) {
      interrupted = true
      expect(response.ok()).toBe(true)
      await route.abort()
    } else await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Choose your session' }).getByRole('alert'),
  ).toContainText('could not confirm')
  await expect(
    page.getByRole('region', { name: 'Choose your session' }).getByRole('alert'),
  ).toBeFocused()
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue(
    'Synthetic Studio Visitor',
  )
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your session is reserved.' })).toBeVisible()
  await page.screenshot({ path: 'test-results/studio-receipt-mobile.png', fullPage: true })
  expect(identities).toHaveLength(2)
  expect(new Set(identities).size).toBe(1)
  const saved = await bookings()
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({
    status: 'confirmed',
    enquiry: null,
    attribution: { status: 'withheld', consent: 'denied' },
  })
  expect(tracking).toEqual([])
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto(`/admin/customers/${saved[0].contact}`)
  await expect(page.getByRole('button', { name: 'Booking (1)', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByText('Synthetic portrait session · confirmed', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reschedule', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Conversation & history', exact: true }).click()
  await expect(page.getByText('Studio session confirmed', { exact: true })).toBeVisible()
  await noOverflow(page)
  expect(errors).toEqual([])
})

test('tagged consent attaches only allowed attribution and an in-flight withdrawal withholds the next booking', async ({
  page,
}) => {
  test.setTimeout(120000)
  await change({ capacity: 2 })
  await page.goto(
    `/studio-days/${slug}?utm_source=google&utm_campaign=studio_test&gclid=SyntheticClick&email=private@example.test`,
  )
  await page.getByLabel(/Remember campaign tags/).check()
  await page.getByRole('button', { name: 'Save choices', exact: true }).click()
  await fill(page)
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your session is reserved.' })).toBeVisible()
  const first = (await bookings())[0]
  expect(first.attribution).toMatchObject({
    consent: 'granted',
    source: 'google',
    snapshot: { first: { tags: { utm_campaign: 'studio_test' } } },
  })
  expect(JSON.stringify(first.attribution)).not.toContain('private@')
  await page.goto(`/studio-days/${slug}`)
  await fill(page, 2)
  await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
  let release: () => void = () => {}
  const pause = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/privacy', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    await pause
    await route.continue()
  })
  await page.getByRole('button', { name: 'Withdraw optional consent', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your session is reserved.' })).toBeVisible()
  release()
  const saved = await bookings()
  expect(saved).toHaveLength(2)
  expect(
    saved.find((booking: { id: number }) => booking.id !== first.id).attribution,
  ).toMatchObject({ status: 'withheld', consent: 'denied' })
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) => cookie.name === 'lunia_campaign'),
    )
    .toBe(false)
})

test('manual request approval, rescheduling and cancellation work in the mobile photographer workspace', async ({
  page,
}) => {
  test.setTimeout(120000)
  await change({ confirmationMode: 'manual' })
  await page.goto(`/studio-days/${slug}`)
  await page.getByRole('button', { name: 'Decline optional', exact: true }).click()
  await fill(page)
  await page.getByRole('button', { name: 'Request this session', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Your session is awaiting approval.' }),
  ).toBeVisible()
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto(`/admin/studio-days/${id}`)
  await expect(page.getByRole('heading', { name: '1 request needs approval' })).toBeVisible()
  await page.screenshot({ path: 'test-results/studio-admin-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/studio-admin-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Approve session', exact: true }).click()
  await page.getByLabel('Reason for this change').fill('Synthetic request reviewed and approved.')
  await page.getByRole('button', { name: 'Save booking change', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Session overview', exact: true })).toBeVisible()
  await expect.poll(async () => (await bookings())[0].status).toBe('confirmed')
  expect(
    (
      await editor.patch(`/api/studio-days/${id}?draft=true`, {
        data: { location: 'Private future venue draft' },
      })
    ).ok(),
  ).toBe(true)
  await page.getByRole('button', { name: 'Reschedule', exact: true }).click()
  await page.getByLabel('Replacement studio day').selectOption(String(id))
  await page.getByLabel('Replacement time').selectOption({ index: 2 })
  await expect(page.locator('.studio-change-form')).toContainText(
    'Synthetic test studio · no real venue',
  )
  await expect(page.locator('.studio-change-form')).not.toContainText('Private future venue draft')
  await page.getByLabel('The customer agreed to these replacement').check()
  await page
    .getByLabel('Reason for this change')
    .fill('Customer agreed to the replacement session.')
  await page.getByRole('button', { name: 'Save booking change', exact: true }).click()
  await expect.poll(async () => (await bookings())[0].studioRevision).toBe(3)
  await page.getByRole('button', { name: 'Cancel session', exact: true }).click()
  await page.getByLabel('Reason for this change').fill('Customer requested synthetic cancellation.')
  await page.getByRole('button', { name: 'Save booking change', exact: true }).click()
  await expect.poll(async () => (await bookings())[0].status).toBe('cancelled')
  await noOverflow(page)
  await expect(page.getByRole('button', { name: 'Approve session', exact: true })).toHaveCount(0)
  await page.getByText('Add a session for a customer', { exact: true }).click()
  await page.getByLabel('Session', { exact: true }).selectOption({ index: 1 })
  await page.getByLabel('Customer name', { exact: true }).fill('Synthetic Staff Customer')
  await page
    .getByLabel('Customer email', { exact: true })
    .fill(`staff-${randomUUID()}@example.test`)
  await page.getByLabel('The customer agreed to the displayed offer').check()
  await page.getByRole('button', { name: 'Save customer session', exact: true }).click()
  await expect.poll(async () => (await bookings()).length).toBe(2)
  await expect(
    page.getByRole('heading', { name: '1 request needs approval', exact: true }),
  ).toBeVisible()
})

test('private draft preview and public unavailable states remain explicit in the native publishing flow', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000)
  await change({ _status: 'draft' })
  await page.goto(`/studio-days/${slug}`)
  await expect(
    page.getByRole('heading', { name: 'Synthetic portrait studio day', exact: true }),
  ).toHaveCount(0)
  const anonymous = await browser.newContext({ baseURL: origin })
  const denied = await anonymous.request.get(`/preview/studio-days/${slug}`)
  expect(denied.status()).toBe(404)
  await anonymous.close()
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto(`/admin/collections/studio-days/${id}`)
  await expect(page.getByRole('textbox', { name: 'Title *', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/studio-native-editor.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('textbox', { name: 'Title *', exact: true })
    .fill('Edited synthetic studio day')
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
  await expect
    .poll(async () => (await (await editor.get(`/api/studio-days/${id}?draft=true`)).json()).title)
    .toBe('Edited synthetic studio day')
  await page.getByRole('tab', { name: 'Date and availability', exact: true }).click()
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/studio-native-editor-mobile.png', fullPage: true })
  await page.goto(`/preview/studio-days/${slug}`)
  await expect(page.getByText(/Private saved-draft preview/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm this session', exact: true })).toHaveCount(
    0,
  )
  await expect(
    page.getByRole('heading', { name: 'Edited synthetic studio day', exact: true }),
  ).toBeVisible()
  await page.goto(`/admin/collections/studio-days/${id}`)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect
    .poll(async () => (await (await editor.get(`/api/studio-days/${id}`)).json())._status)
    .toBe('published')
  await change({ bookingsOpen: false })
  await page.goto(`/studio-days/${slug}`)
  await expect(
    page.getByText('Booking is closed for this studio day.', { exact: true }),
  ).toBeVisible()
  await change({ dayState: 'cancelled' })
  await page.reload()
  await expect(page.getByText(/This studio day has been cancelled/)).toBeVisible()
  await change({
    dayState: 'scheduled',
    localDate: '2026-01-02',
    bookingDeadlineLocal: '2026-01-02T08:00',
  })
  await page.reload()
  await expect(page.getByText('This studio day has passed.', { exact: true })).toBeVisible()
})
