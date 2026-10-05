import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { test, expect, type APIRequestContext } from '@playwright/test'
const origin = 'http://127.0.0.1:3000'
let editor: APIRequestContext
let contact = 0,
  enquiry = 0,
  pageID = 0,
  template = 0
let keys: string[] = []
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
  const response = await editor.post('/api/pages', {
    data: {
      title: 'Synthetic guided service',
      slug: `guided-${randomUUID()}`,
      description: 'Synthetic workflow test',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Test services',
          items: [{ title: 'Synthetic guided portrait', body: 'Synthetic only' }],
        },
      ],
    },
  })
  expect(response.ok()).toBe(true)
  const { doc } = await response.json()
  pageID = doc.id
  const email = `guided-${randomUUID()}@example.test`
  expect(
    (
      await editor.post('/api/inquiry', {
        headers: { origin },
        data: {
          service: `${pageID}:${doc.layout[0].items[0].id}`,
          name: 'Synthetic Guided Customer',
          email,
          message: 'I would like to discuss this synthetic portrait enquiry.',
          website: '',
          submissionId: randomUUID(),
        },
      })
    ).ok(),
  ).toBe(true)
  const leads = await (
    await editor.get(`/api/enquiries?where[email][equals]=${encodeURIComponent(email)}&depth=0`)
  ).json()
  enquiry = leads.docs[0].id
  contact = leads.docs[0].contact
  const wording = await editor.post('/api/email-templates', {
    data: {
      name: `Guided test wording ${enquiry}`,
      kind: 'follow_up',
      subject: 'About {{service_title}}',
      body: 'Hello {{contact_name}},\n\nThank you for your enquiry about {{service_title}}.',
      approved: true,
    },
  })
  expect(wording.ok()).toBe(true)
  template = (await wording.json()).doc.id
})
test.afterEach(async () => {
  const url = new URL(process.env.DATABASE_URL!)
  expect(['localhost', '127.0.0.1']).toContain(url.hostname)
  const db = new Client({ connectionString: url.href })
  await db.connect()
  try {
    await db.query(
      "DELETE FROM payload_jobs WHERE id IN (SELECT job_i_d FROM follow_ups WHERE contact_id = $1) OR input->>'plan' IN (SELECT id::text FROM follow_ups WHERE contact_id = $1)",
      [contact],
    )
    await db.query('DELETE FROM follow_ups WHERE contact_id = $1', [contact])
    await db.query('DELETE FROM incoming_replies WHERE contact_id = $1', [contact])
    await db.query('DELETE FROM customer_activities WHERE contact_id = $1', [contact])
    await db.query('DELETE FROM email_messages WHERE contact_id = $1', [contact])
    await db.query('DELETE FROM bookings WHERE contact_id = $1', [contact])
    await db.query('DELETE FROM enquiries WHERE id = $1', [enquiry])
    await db.query('DELETE FROM contacts WHERE id = $1', [contact])
    await db.query('DELETE FROM email_templates WHERE id = $1', [template])
    await db.query('DELETE FROM customer_operations WHERE operation_key = ANY($1)', [keys])
  } finally {
    await db.end()
    if (pageID) await editor.delete(`/api/pages/${pageID}`)
    await editor.dispose()
  }
})
test('guided inbox to customer, draft, booking and follow-up review works with keyboard and mobile', async ({
  page,
}) => {
  test.setTimeout(120000)
  const errors: string[] = [],
    analytics: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/posthog|api\/measurement/.test(request.url())) analytics.push(request.url())
    if (/api\/customer-(workspace|records)$/.test(request.url()) && request.method() === 'POST') {
      const body = request.postDataJSON()
      if (body.key) keys.push(body.key)
    }
  })
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Enquiry inbox', exact: true })).toBeVisible()
  await page.getByLabel('Search customers').fill('No matching synthetic customer')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByRole('heading', { name: 'No customers in this view' })).toBeVisible()
  await page.getByLabel('Search customers').fill('Synthetic Guided')
  await page.getByLabel('Search customers').press('Tab')
  await expect(page.getByLabel('Show', { exact: true })).toBeFocused()
  await page.getByLabel('Show', { exact: true }).selectOption('new')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(
    page.getByRole('link', { name: 'Synthetic Guided Customer', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.workspace-card').first()).toHaveCSS('border-top-width', '1px')
  await page.screenshot({ path: 'test-results/workspace-inbox-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'Synthetic Guided Customer', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Synthetic Guided Customer', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Reply template').selectOption(String(template))
  await page.getByRole('button', { name: 'Prepare private reply draft' }).click()
  await expect(
    page.frameLocator('iframe').first().getByText('Hello Synthetic Guided Customer,'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close reply preview' }).click()
  await page.getByRole('button', { name: 'New booking proposal' }).click()
  await page.getByLabel('Expected value', { exact: true }).fill('245.50')
  await page.getByRole('button', { name: 'Record proposal', exact: true }).click()
  const bookingDetails = page.locator('aside details').first()
  await bookingDetails.locator('summary').click()
  await page.getByLabel('Booking status', { exact: true }).selectOption('confirmed')
  await page
    .getByLabel('Session time (your device timezone)')
    .fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16))
  await page
    .getByLabel('Reason for change', { exact: true })
    .fill('Synthetic agreed session for browser verification.')
  await page.getByRole('button', { name: 'Save booking change' }).click()
  await expect(page.locator('aside summary').first()).toContainText('confirmed')
  const customer = await (await editor.get(`/api/customer-workspace?contact=${contact}`)).json()
  expect(customer.bookings[0].expectedMinor).toBe(24550)
  await page.getByRole('button', { name: 'Plan a follow-up', exact: true }).click()
  const form = page.getByRole('region', { name: 'Follow-up editor' })
  await form.getByLabel('Purpose', { exact: true }).selectOption('preparation')
  await form.getByLabel('Linked booking').selectOption(String(customer.bookings[0].id))
  await form.getByLabel('Approved message template').selectOption(String(template))
  await form
    .getByLabel('Planned local date and time')
    .fill(new Date(Date.now() - 60000).toISOString().slice(0, 16))
  await expect(form.getByRole('button', { name: 'Save reviewed test plan' })).toBeDisabled()
  await form.getByRole('button', { name: 'Review exact message' }).click()
  await expect(form.getByRole('region', { name: 'Reviewed follow-up' })).toBeVisible()
  await form.getByRole('button', { name: 'Save reviewed test plan' }).click()
  await expect(form).toHaveCount(0)
  const plans = page.locator('#follow-ups')
  await expect(plans.locator('.state-planned')).toBeVisible()
  await plans.getByRole('button', { name: 'Pause plan', exact: true }).click()
  await expect(plans.locator('.state-paused')).toBeVisible()
  await plans.getByRole('button', { name: 'Review and resume' }).click()
  await expect(plans.locator('.state-planned')).toBeVisible()
  await plans.getByRole('button', { name: 'Edit or reschedule' }).click()
  await form.getByLabel('Message subject').fill('Edited synthetic follow-up')
  await form.getByRole('button', { name: 'Review exact message' }).click()
  await form.getByRole('button', { name: 'Save reviewed test plan' }).click()
  await expect(plans.getByRole('heading', { name: 'Edited synthetic follow-up' })).toBeVisible()
  await page.screenshot({ path: 'test-results/workspace-customer-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/workspace-customer-mobile.png', fullPage: true })
  await page.goto('/admin/follow-ups')
  await page.getByRole('button', { name: 'Run due simulations' }).click()
  await expect(page.locator('.state-simulated')).toBeVisible()
  await expect(
    page.getByText('Simulation batch checked. No email sent.', { exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/workspace-queue-mobile.png', fullPage: true })
  await page.getByRole('link', { name: 'Review and manage plan' }).click()
  await page
    .getByLabel('Simulated incoming reply')
    .fill('Synthetic customer reply to stop remaining follow-ups.')
  await page.getByRole('button', { name: 'Record simulated reply' }).click()
  await expect(
    page.getByText('Simulated incoming reply; no real mailbox connected', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Stop all customer follow-ups' }).click()
  await expect(page.getByRole('button', { name: 'Allow new test planning' })).toBeVisible()
  expect(errors).toEqual([])
  expect(analytics).toEqual([])
})
test('workspace errors are visible and private, job and real receiving endpoints stay closed', async ({
  page,
  request,
}) => {
  expect((await request.get(`/api/customer-workspace?contact=${contact}`)).status()).toBe(401)
  expect(
    (
      await request.post('/api/customer-workspace', {
        headers: { origin },
        data: { action: 'runSimulations' },
      })
    ).status(),
  ).toBe(401)
  expect(
    (
      await editor.post('/api/customer-workspace', {
        headers: { origin: 'https://untrusted.example' },
        data: { action: 'inbox' },
      })
    ).status(),
  ).toBe(403)
  for (const collection of ['follow-ups', 'follow-up-rules', 'incoming-replies', 'payload-jobs'])
    expect([401, 403]).toContain((await request.get(`/api/${collection}`)).status())
  expect([401, 403]).toContain((await editor.get('/api/payload-jobs/run')).status())
  expect(
    (
      await request.post('/api/incoming-replies/webhook', { data: { type: 'email.received' } })
    ).status(),
  ).toBe(503)
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto('/admin')
  await page.route('**/api/customer-workspace', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Synthetic temporary search failure. Try again.' }),
    }),
  )
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Synthetic temporary search failure' }),
  ).toBeVisible()
  await page.unroute('**/api/customer-workspace')
  await page.getByLabel('Search customers').fill('Synthetic Guided')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(
    page.getByRole('link', { name: 'Synthetic Guided Customer', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Synthetic temporary search failure. Try again.')).toHaveCount(0)
})
