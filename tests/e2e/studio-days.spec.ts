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

test('refreshed terms require a fresh agreement while preserving customer details', async ({
  page,
}) => {
  await page.goto(`/studio-days/${slug}`)
  await page.getByRole('button', { name: 'Decline optional', exact: true }).click()
  await fill(page)
  const email = await page.getByLabel('Email address', { exact: true }).inputValue()
  await change({ priceMinor: 23400, changePolicy: 'Synthetic revised cancellation conditions.' })
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh times and review details', exact: true }).click()
  const agreement = page.getByLabel('I agree to the displayed')
  await expect(agreement).not.toBeChecked()
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue(
    'Synthetic Studio Visitor',
  )
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(email)
  await expect(page.locator('.studio-review')).toContainText('€234.00')
  await expect(page.locator('.studio-review')).toContainText(
    'Synthetic revised cancellation conditions.',
  )
  await page.getByLabel('Session time ·').selectOption({ index: 1 })
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/studio-sessions') && request.method() === 'POST')
      requests.push(request.url())
  })
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  await expect(agreement).toBeFocused()
  expect(requests).toHaveLength(0)
  expect(await bookings()).toHaveLength(0)
  await agreement.check()
  await page.getByLabel('Session time ·').selectOption({ index: 2 })
  await expect(agreement).not.toBeChecked()
  await agreement.check()
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your session is reserved.' })).toBeVisible()
  expect((await bookings())[0].studioSnapshot).toMatchObject({
    priceMinor: 23400,
    changePolicy: 'Synthetic revised cancellation conditions.',
  })
})

test('staff can deliberately start another booking after saving one', async ({ page }) => {
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto(`/admin/studio-days/${id}`)
  await page.getByText('Add a session for a customer', { exact: true }).click()
  const identities: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/studio-sessions') && request.method() === 'POST')
      identities.push(request.postDataJSON().submissionId)
  })
  for (const number of [1, 2]) {
    const select = page.getByRole('combobox', { name: 'Session', exact: true })
    const name = page.getByLabel('Customer name', { exact: true })
    const email = page.getByLabel('Customer email', { exact: true })
    const agreement = page.getByLabel('The customer agreed to the displayed offer')
    await expect(select).toHaveValue('')
    await expect(name).toHaveValue('')
    await expect(email).toHaveValue('')
    await expect(agreement).not.toBeChecked()
    await select.selectOption({ index: number })
    await name.fill(`Synthetic repeat customer ${number}`)
    await email.fill(`repeat-${randomUUID()}@example.test`)
    await agreement.check()
    await page.getByRole('button', { name: 'Save customer session', exact: true }).click()
    await expect.poll(async () => (await bookings()).length).toBe(number)
    await expect(page.getByRole('button', { name: 'Session saved', exact: true })).toBeDisabled()
    if (number === 1)
      await page.getByRole('button', { name: 'Book another session', exact: true }).click()
  }
  expect(identities).toHaveLength(2)
  expect(new Set(identities).size).toBe(2)
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/studio-staff-repeat.png', fullPage: true })
})

test('staff can move to a shifted overlapping slot without exposing a public capacity bypass', async ({
  page,
}) => {
  await page.goto(`/studio-days/${slug}`)
  await page.getByRole('button', { name: 'Decline optional', exact: true }).click()
  await fill(page)
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your session is reserved.' })).toBeVisible()
  const booked = (await bookings())[0]
  await change({ opensLocal: '09:15', durationMinutes: 45, acknowledgeBookings: true })
  const publicResponse = await page.request.get(
    `/api/studio-sessions?day=${id}&excludeBooking=${booked.id}`,
  )
  const available = await publicResponse.json()
  expect(available.slots[0].remaining).toBe(0)
  expect(JSON.stringify(available)).not.toContain('Synthetic Studio Visitor')
  expect(
    (await page.request.get(`/api/studio-sessions?day=${id}&replacementFor=${booked.id}`)).status(),
  ).toBe(401)
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/admin/studio-days/${id}`)
  await page.getByRole('button', { name: 'Reschedule', exact: true }).click()
  await page.getByLabel('Replacement studio day').selectOption(String(id))
  const target = page.getByLabel('Replacement time')
  await expect(target.locator('option').nth(1)).toBeEnabled()
  await target.selectOption({ index: 1 })
  await page.getByLabel('The customer agreed to these replacement').check()
  await page
    .getByLabel('Reason for this change')
    .fill('Customer agreed to the shifted, longer session.')
  await noOverflow(page)
  await page.screenshot({
    path: 'test-results/studio-shifted-reschedule-mobile.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Save booking change', exact: true }).click()
  await expect.poll(async () => (await bookings())[0].studioRevision).toBe(2)
  expect((await bookings())[0].studioSnapshot).toMatchObject({
    durationMinutes: 45,
    startsAt: '2027-03-27T08:15:00.000Z',
  })
})

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
  await page.getByRole('combobox', { name: 'Session', exact: true }).selectOption({ index: 1 })
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

test('stale slot selection recovers to a private sold-out state on desktop and mobile', async ({
  page,
}) => {
  await change({ closesLocal: '09:30', bufferMinutes: 0 })
  await page.goto(`/studio-days/${slug}`)
  await page.getByRole('button', { name: 'Decline optional', exact: true }).click()
  await fill(page)
  const availability = await (await editor.get(`/api/studio-sessions?day=${id}`)).json()
  const saved = await editor.post('/api/studio-sessions', {
    headers: { origin },
    data: {
      action: 'staffReserve',
      day: id,
      slot: availability.slots[0].id,
      revision: availability.revision,
      submissionId: randomUUID(),
      name: 'Private Synthetic Customer',
      email: `private-${randomUUID()}@example.test`,
      conditionsAccepted: true,
    },
  })
  expect(saved.ok(), await saved.text()).toBe(true)
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  const slotError = page.getByRole('region', { name: 'Choose your session' }).getByRole('alert')
  await expect(slotError).toContainText('That session is full.')
  await expect(slotError).toBeFocused()
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue(
    'Synthetic Studio Visitor',
  )
  await page.getByRole('button', { name: 'Refresh times and review details', exact: true }).click()
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(
      page.getByText('Every session is currently allocated.', { exact: false }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Browse other studio days' })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Confirm this session', exact: true }),
    ).toHaveCount(0)
    await expect(page.getByText('Private Synthetic Customer', { exact: true })).toHaveCount(0)
    await noOverflow(page)
  }
  expect(await bookings()).toHaveLength(1)
  await page.screenshot({ path: 'test-results/studio-sold-out-mobile.png', fullPage: true })
  const bookingID = (await saved.json()).id
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto(`/admin/collections/bookings/${bookingID}`)
  await expect(page.getByRole('button', { name: 'Cancel session', exact: true })).toBeVisible()
  await page.route(`**/api/customer-records?booking=${bookingID}`, (route) =>
    route.fulfill({ status: 503, json: { error: 'Synthetic unavailable response' } }),
  )
  await page.getByRole('button', { name: 'Cancel session', exact: true }).click()
  await page
    .getByLabel('Reason for this change')
    .fill('Synthetic cancellation after customer review.')
  await page.getByRole('button', { name: 'Save booking change', exact: true }).click()
  await expect(page.locator('.customer-records').getByRole('alert')).toContainText(
    'Could not load this record.',
  )
  await expect.poll(async () => (await bookings())[0].status).toBe('cancelled')
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

async function configuredMeasurement(page: Page) {
  // Only simulate readiness in the browser. Server capture remains disabled.
  await page.route('**/api/privacy', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, json: { ...(await response.json()), configured: true } })
  })
}

test('studio measurement observes current consented exposure and a real time choice once; lost receipts retry safely on mobile', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await configuredMeasurement(page)
  const events: Record<string, unknown>[] = []
  await page.route('**/api/measurement', async (route) => {
    events.push(route.request().postDataJSON())
    await route.fulfill({ status: 204 })
  })
  await page.goto(`/studio-days/${slug}?email=private@example.test&gclid=PrivateClick`)
  await fill(page)
  expect(events).toEqual([])
  await page.getByLabel(/Measure service/).check()
  await page.getByRole('button', { name: 'Save choices', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
  await page
    .getByRole('heading', { name: 'Synthetic portrait studio day', exact: true })
    .scrollIntoViewIfNeeded()
  await expect.poll(() => events.length).toBe(1)
  // Granting consent does not backfill the earlier slot selection.
  expect(events).toEqual([{ event: 'studio_day_viewed', day: id }])
  await page.screenshot({ path: 'test-results/studio-measurement-desktop.png', fullPage: true })
  await page.getByLabel('Session time ·').selectOption({ index: 2 })
  await page.getByLabel('Session time ·').selectOption({ index: 1 })
  await page.getByLabel('I agree to the displayed').check()
  await expect.poll(() => events.length).toBe(2)
  expect(events).toEqual([
    { event: 'studio_day_viewed', day: id },
    { event: 'studio_slot_selected', day: id },
  ])
  const submissions: Record<string, unknown>[] = []
  await page.route('**/api/studio-sessions', async (route) => {
    submissions.push(route.request().postDataJSON())
    if (submissions.length === 1) {
      const response = await route.fetch()
      expect(response.ok()).toBe(true)
      await route.abort('failed') // Lose the response after the real database commit.
    } else await route.continue()
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  const alert = page.getByRole('region', { name: 'Choose your session' }).getByRole('alert')
  await expect(alert).toContainText('could not confirm')
  await expect(alert).toBeFocused()
  await noOverflow(page)
  await page.screenshot({
    path: 'test-results/studio-measurement-retry-mobile.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your session is reserved.' })).toBeVisible()
  await expect(page.locator('.inquiry-success')).toBeFocused()
  expect(submissions).toHaveLength(2)
  expect(submissions[0].submissionId).toBe(submissions[1].submissionId)
  expect(submissions.every((value) => value.analyticsAllowed === true)).toBe(true)
  expect(await bookings()).toHaveLength(1)
  expect(events).toHaveLength(2) // Browser cannot emit completion.
  expect(JSON.stringify(events)).not.toMatch(/private|Private|email|slot:|gclid/)
  await page.screenshot({
    path: 'test-results/studio-measurement-receipt-mobile.png',
    fullPage: true,
  })
  expect(errors).toEqual([])
})

test('withdrawal cancels a queued studio step and withholds booking measurement even when saving consent fails', async ({
  page,
}) => {
  await page.request.post('/api/privacy', {
    headers: { origin },
    data: { analytics: true, campaigns: false },
  })
  await configuredMeasurement(page)
  const events: Record<string, unknown>[] = []
  let release!: () => void
  const paused = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/measurement', async (route) => {
    events.push(route.request().postDataJSON())
    await paused
    await route.fulfill({ status: 204 }).catch(() => {})
  })
  try {
    await page.goto(`/studio-days/${slug}`)
    await expect.poll(() => events.length).toBe(1)
    await fill(page)
    await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
    await page.route('**/api/privacy', async (route) => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 503 })
      else await route.fallback()
    })
    await page.getByRole('button', { name: 'Withdraw optional consent', exact: true }).click()
    await expect(
      page.getByRole('region', { name: 'Privacy choices' }).getByRole('alert'),
    ).toContainText('Collection is paused on this page')
    release()
    const submission = page.waitForRequest(
      (request) => request.url().endsWith('/api/studio-sessions') && request.method() === 'POST',
    )
    await page.getByRole('button', { name: 'Confirm this session', exact: true }).click()
    expect((await submission).postDataJSON().analyticsAllowed).toBe(false)
    await expect(page.getByRole('heading', { name: 'Your session is reserved.' })).toBeVisible()
    expect(events).toEqual([{ event: 'studio_day_viewed', day: id }])
    await page.setViewportSize({ width: 390, height: 844 })
    await noOverflow(page)
    await page.screenshot({
      path: 'test-results/studio-measurement-withdrawal-mobile.png',
      fullPage: true,
    })
  } finally {
    release()
  }
})

test('a delayed privacy read cannot restore studio tracking after a newer decline', async ({
  page,
}) => {
  await page.request.post('/api/privacy', {
    headers: { origin },
    data: { analytics: true, campaigns: false },
  })
  let release!: () => void
  let loaded!: () => void
  const paused = new Promise<void>((resolve) => {
    release = resolve
  })
  const readLoaded = new Promise<void>((resolve) => {
    loaded = resolve
  })
  await page.route('**/api/privacy', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const old = await response.json()
    loaded()
    await paused
    await route.fulfill({ response, json: { ...old, configured: true } })
  })
  const events: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/measurement')) events.push(request.url())
  })
  try {
    await page.goto(`/studio-days/${slug}`)
    await readLoaded
    await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
    await page.getByRole('button', { name: 'Decline optional', exact: true }).click()
    const completed = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/privacy') && response.request().method() === 'GET',
    )
    release()
    await completed
    await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
    await page
      .getByRole('heading', { name: 'Synthetic portrait studio day', exact: true })
      .scrollIntoViewIfNeeded()
    await fill(page)
    await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
    await expect(page.getByLabel(/Measure service/)).not.toBeChecked()
    expect(events).toEqual([])
    expect(
      (await page.context().cookies()).some((cookie) => cookie.name === 'lunia_measurement'),
    ).toBe(false)
  } finally {
    release()
  }
})

test('studio collector rejects forged completions and private or unavailable selections through real HTTP', async ({
  request,
}) => {
  const post = (data: Record<string, unknown>, source = origin) =>
    request.post('/api/measurement', { headers: { origin: source }, data })
  expect((await post({ event: 'studio_day_viewed', day: id })).status()).toBe(204)
  await request.post('/api/privacy', {
    headers: { origin },
    data: { analytics: true, campaigns: false },
  })
  expect(
    (await post({ event: 'studio_day_viewed', day: id }, 'https://evil.example')).status(),
  ).toBe(403)
  for (const data of [
    { event: 'studio_booking_submitted', day: id, status: 'confirmed' },
    { event: 'studio_day_viewed', day: 'private@example.test' },
    { event: 'studio_slot_selected', day: -1 },
  ])
    expect((await post(data)).status()).toBe(400)
  expect((await post({ event: 'studio_day_viewed', day: id })).status()).toBe(204)
  expect((await post({ event: 'studio_slot_selected', day: id })).status()).toBe(204)
  await change({ bookingsOpen: false })
  expect((await post({ event: 'studio_day_viewed', day: id })).status()).toBe(204)
  expect((await post({ event: 'studio_slot_selected', day: id })).status()).toBe(400)
  await change({ _status: 'draft' })
  expect((await post({ event: 'studio_day_viewed', day: id })).ok()).toBe(false)
})
