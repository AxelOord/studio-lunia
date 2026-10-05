import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { test, expect, type APIRequestContext } from '@playwright/test'
let editor: APIRequestContext
let pageID: number
let enquiryID: number
let contactID: number
let bookingID: number
let templateID: number
const operationKeys: string[] = []
const origin = 'http://127.0.0.1:3000'
test.beforeAll(async ({ playwright }) => {
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
      title: 'Synthetic customer records',
      slug: `records-${randomUUID()}`,
      description: 'Synthetic browser verification',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Synthetic services',
          items: [{ title: 'Synthetic record session', body: 'Synthetic service only.' }],
        },
      ],
    },
  })
  expect(page.ok()).toBe(true)
  const { doc } = await page.json()
  pageID = doc.id
  const email = `records-ui-${randomUUID()}@example.test`
  expect(
    (
      await editor.post('/api/inquiry', {
        headers: { origin },
        data: {
          service: `${pageID}:${doc.layout[0].items[0].id}`,
          name: 'Synthetic UI Customer',
          email,
          message: 'Synthetic browser record enquiry only.',
          website: '',
          submissionId: randomUUID(),
        },
      })
    ).ok(),
  ).toBe(true)
  const lead = (
    await (
      await editor.get(`/api/enquiries?where[email][equals]=${encodeURIComponent(email)}&depth=0`)
    ).json()
  ).docs[0]
  enquiryID = lead.id
  contactID = lead.contact
  const template = await editor.post('/api/email-templates', {
    data: {
      name: 'Synthetic browser template',
      kind: 'enquiry',
      subject: 'Hello {{contact_name}}',
      body: 'About {{service_title}}.\n\nSynthetic preview only.',
      approved: true,
    },
  })
  expect(template.ok()).toBe(true)
  templateID = (await template.json()).doc.id
})
test.afterAll(async () => {
  // The app intentionally prohibits destructive history edits. Local-only test
  // cleanup targets precisely this suite's synthetic graph through its DB role.
  const source = new URL(process.env.DATABASE_URL!)
  expect(['localhost', '127.0.0.1']).toContain(source.hostname)
  const db = new Client({ connectionString: source.href })
  await db.connect()
  try {
    await db.query('DELETE FROM customer_activities WHERE contact_id = $1', [contactID])
    await db.query('DELETE FROM revenue_entries WHERE contact_id = $1', [contactID])
    await db.query('DELETE FROM email_messages WHERE contact_id = $1', [contactID])
    await db.query('DELETE FROM bookings WHERE contact_id = $1', [contactID])
    await db.query('DELETE FROM enquiries WHERE id = $1', [enquiryID])
    await db.query('DELETE FROM contacts WHERE id = $1', [contactID])
    await db.query('DELETE FROM email_templates WHERE id = $1', [templateID])
    await db.query('DELETE FROM customer_operations WHERE operation_key = ANY($1)', [operationKeys])
  } finally {
    await db.end()
  }
  if (pageID) await editor.delete(`/api/pages/${pageID}`)
  await editor.dispose()
})
test('staff can propose, confirm and record money with visible dated history on desktop and mobile', async ({
  page,
}) => {
  await page.context().addCookies((await editor.storageState()).cookies)
  const errors: string[] = []
  const analytics: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/posthog|api\/measurement/.test(request.url())) analytics.push(request.url())
    if (request.url().endsWith('/api/customer-records') && request.method() === 'POST') {
      const data = request.postDataJSON()
      if (data.key) operationKeys.push(data.key)
    }
  })
  await page.goto(`/admin/collections/enquiries/${enquiryID}`)
  await expect(page.getByRole('heading', { name: 'Booking proposal', exact: true })).toBeVisible()
  await page.getByLabel('Expected value in minor units', { exact: true }).fill('12500')
  await page.getByLabel('Currency code', { exact: true }).fill('EUR')
  await page
    .getByLabel('Proposed session time (optional; your local timezone)')
    .fill('2026-12-10T10:30')
  await page.getByRole('button', { name: 'Create booking proposal', exact: true }).click()
  const link = page.getByRole('link', { name: 'Open booking proposal' })
  await expect(link).toBeVisible()
  bookingID = Number((await link.getAttribute('href'))!.split('/').at(-1))
  const repeated = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/customer-records') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Create booking proposal', exact: true }).click()
  expect((await repeated).ok()).toBe(true)
  expect(
    (await (await editor.get(`/api/customer-records?contact=${contactID}`)).json()).bookings,
  ).toHaveLength(1)
  await link.click()
  await expect(page.getByRole('heading', { name: 'Booking actions', exact: true })).toBeVisible()
  await page.getByLabel('Booking status', { exact: true }).selectOption('confirmed')
  await page.getByLabel('Reason for booking change').fill('Synthetic agreed session confirmation.')
  await page.getByRole('button', { name: 'Record booking change' }).click()
  await expect(page.getByLabel('Reason for booking change')).toHaveValue('')
  await page.getByLabel('Amount in minor units (positive)').fill('5000')
  await page
    .getByLabel('Record or correction reason', { exact: true })
    .fill('Synthetic payment received outside the site.')
  await page.getByRole('button', { name: 'Record money', exact: true }).click()
  await expect(page.getByText(/Net manually recorded: 5000 EUR minor units/)).toBeVisible()
  await expect(page.locator('.customer-records').first()).toHaveCSS('border-top-width', '1px')
  await page.screenshot({ path: 'test-results/customer-booking-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('heading', { name: 'Booking actions', exact: true }).scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/customer-booking-mobile.png', fullPage: true })
  await page.goto(`/admin/collections/contacts/${contactID}`)
  await expect(page.getByRole('heading', { name: 'Customer history' })).toBeVisible()
  await page
    .getByLabel('Known reply note')
    .fill('Synthetic known reply, manually recorded after a call.')
  await page.getByRole('button', { name: 'Record staff-reported reply' }).click()
  await expect(page.getByText('Known reply recorded by staff', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Synthetic record session' })).toHaveCount(2)
  await page.screenshot({ path: 'test-results/customer-timeline-mobile.png', fullPage: true })
  expect(errors).toEqual([])
  expect(analytics).toEqual([])
})
test('template live preview never sends; prepared email has exact frozen content and customer sending stays disabled', async ({
  page,
}) => {
  await page.context().addCookies((await editor.storageState()).cookies)
  const sends: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/customer-records') && request.method() === 'POST') {
      const data = request.postDataJSON()
      if (data.key) operationKeys.push(data.key)
      if (data.action === 'sendEmail') sends.push(request.url())
    }
  })
  await page.goto(`/admin/collections/email-templates/${templateID}`)
  await expect(page.getByRole('heading', { name: 'Live email preview' })).toBeVisible()
  const subject = page.getByRole('textbox', { name: /^Subject/ })
  await subject.fill('Updated {{contact_name}}')
  await expect(page.getByText('Updated Synthetic Preview Customer', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mobile email', exact: true }).click()
  await page.locator('iframe').scrollIntoViewIfNeeded()
  await expect(page.frameLocator('iframe').locator('p').first()).toBeVisible()
  await page.screenshot({ path: 'test-results/customer-template-preview.png', fullPage: true })
  expect(sends).toEqual([])
  // Unsaved editor preview does not rewrite the saved approved source.
  const key = randomUUID()
  operationKeys.push(key)
  const proposed = await editor.post('/api/customer-records', {
    headers: { origin },
    data: { action: 'proposeBooking', key, enquiry: enquiryID, expectedMinor: 0, currency: 'EUR' },
  })
  expect(proposed.ok()).toBe(true)
  bookingID = (await proposed.json()).id
  page.on('dialog', (dialog) => void dialog.accept())
  await page.goto(`/admin/collections/bookings/${bookingID}`)
  await page.getByLabel('Approved template').selectOption(String(templateID))
  await page.getByRole('button', { name: 'Prepare private customer draft' }).click()
  await page.getByRole('link', { name: 'Open exact prepared email' }).click()
  await expect(
    page.getByText('This customer draft is private and unscheduled. Customer sending is disabled.'),
  ).toBeVisible()
  await expect(
    page
      .frameLocator('iframe[title="Email content preview"]')
      .getByText('About Synthetic record session.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send this sandbox email' })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('iframe').scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/customer-email-mobile.png', fullPage: true })
  expect(sends).toEqual([])
})
test('private endpoint and native collections enforce access and origin; webhook remains disabled', async ({
  request,
}) => {
  expect((await request.get(`/api/customer-records?contact=${contactID}`)).status()).toBe(401)
  expect(
    (
      await request.post('/api/customer-records', {
        headers: { origin },
        data: { action: 'search', query: '', filter: 'all' },
      })
    ).status(),
  ).toBe(401)
  expect(
    (
      await editor.post('/api/customer-records', {
        headers: { origin: 'https://untrusted.example' },
        data: { action: 'recordReply', contact: contactID, key: randomUUID() },
      })
    ).status(),
  ).toBe(403)
  for (const collection of [
    'contacts',
    'bookings',
    'revenue-entries',
    'customer-activities',
    'email-templates',
    'email-messages',
  ])
    expect([401, 403]).toContain((await request.get(`/api/${collection}`)).status())
  expect(
    (await request.post('/api/resend/webhook', { data: { type: 'email.delivered' } })).status(),
  ).toBe(503)
  const result = await editor.post('/api/customer-records', {
    headers: { origin },
    data: { action: 'search', query: 'Synthetic UI', filter: 'new' },
  })
  expect(result.ok()).toBe(true)
  expect((await result.json()).contacts.some((c: { id: number }) => c.id === contactID)).toBe(true)
})
