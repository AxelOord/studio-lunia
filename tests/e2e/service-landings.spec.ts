import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

const origin = 'http://127.0.0.1:3000'
let editor: APIRequestContext
let sourceID: number, landingID: number
let slug: string, service: string
let ownedEmails: string[]

test.beforeEach(async ({ playwright }) => {
  ownedEmails = []
  editor = await playwright.request.newContext({ baseURL: origin })
  expect(
    (
      await editor.post('/api/users/login', {
        data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
      })
    ).ok(),
  ).toBe(true)
  const source = await editor.post('/api/pages', {
    data: {
      title: 'Synthetic landing source',
      slug: `source-${randomUUID()}`,
      description: 'Synthetic service fixture',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Synthetic services',
          items: [
            {
              title: 'Synthetic personal portraits',
              body: 'A synthetic portrait service for this browser test.',
              inclusions: 'Synthetic planning conversation\nSynthetic image selection',
              priceGuidance: 'Synthetic guidance — discuss the scope first.',
            },
          ],
        },
      ],
    },
  })
  expect(source.ok()).toBe(true)
  const { doc } = await source.json()
  sourceID = doc.id
  service = `${doc.id}:${doc.layout[0].items[0].id}`
  slug = `landing-${randomUUID()}`
  const landing = await editor.post('/api/pages', {
    data: {
      title: 'Synthetic service landing',
      slug,
      description: 'Synthetic landing test only',
      _status: 'published',
      inquiryService: service,
      layout: [
        {
          blockType: 'hero',
          eyebrow: 'SYNTHETIC SERVICE PREVIEW',
          heading: 'Portraits that begin with your idea.',
          body: 'Synthetic copy and abstract artwork for review. No commercial promise is made.',
        },
      ],
    },
  })
  expect(landing.ok()).toBe(true)
  landingID = (await landing.json()).doc.id
})
test.afterEach(async () => {
  const url = new URL(process.env.DATABASE_URL!)
  expect(['localhost', '127.0.0.1']).toContain(url.hostname)
  expect(url.pathname).toMatch(/^\/lunia_test_[a-f0-9]{32}$/)
  const db = new Client({ connectionString: url.href })
  await db.connect()
  try {
    for (const email of ownedEmails) {
      const rows = (
        await db.query('SELECT id, contact_id FROM enquiries WHERE email = $1', [email])
      ).rows
      for (const row of rows) {
        await db.query('DELETE FROM customer_activities WHERE enquiry_id = $1', [row.id])
        await db.query('DELETE FROM email_messages WHERE enquiry_id = $1', [row.id])
        await db.query('DELETE FROM enquiries WHERE id = $1', [row.id])
        await db.query('DELETE FROM contacts WHERE id = $1', [row.contact_id])
      }
    }
  } finally {
    await db.end()
    if (landingID) await editor.delete(`/api/pages/${landingID}`)
    if (sourceID) await editor.delete(`/api/pages/${sourceID}`)
    await editor.dispose()
  }
})
async function fill(page: Page) {
  const email = `landing-${randomUUID()}@example.test`
  ownedEmails.push(email)
  await expect(page.getByLabel('Photography service')).toHaveValue(service)
  await page.getByLabel('Your name', { exact: true }).fill('Synthetic Landing Visitor')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page
    .getByLabel('What do you have in mind?')
    .fill('A private synthetic portrait idea for this landing test.')
  return email
}
async function saved(email: string) {
  const response = await editor.get(
    `/api/enquiries?where[email][equals]=${encodeURIComponent(email)}`,
  )
  expect(response.ok()).toBe(true)
  const { docs } = await response.json()
  expect(docs).toHaveLength(1)
  return docs[0]
}

test('a tagged landing works without consent, retains service and details after a lost response, and reaches the private workspace once', async ({
  page,
}) => {
  const optional: string[] = [],
    keys: string[] = [],
    errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/posthog|api\/(measurement|campaign)/.test(request.url())) optional.push(request.url())
  })
  await page.goto(`/${slug}?utm_source=google&utm_medium=cpc&gclid=synthetic_landing_click`)
  await expect(page.getByRole('checkbox').first()).not.toBeChecked()
  await expect(page.getByRole('checkbox').last()).not.toBeChecked()
  await page.getByRole('button', { name: 'Decline optional' }).click()
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
  await expect(page.getByText('Synthetic planning conversation', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Synthetic guidance — discuss the scope first.', { exact: false }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true })
  const action = page.getByRole('link', { name: 'Enquire about this service' })
  await action.focus()
  await expect(action).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Photography service')).toHaveValue(service)
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(page.locator('.form-error')).toBeFocused()
  const email = await fill(page)
  let first = true
  await page.route('**/api/inquiry', async (route) => {
    keys.push(route.request().postDataJSON().submissionId)
    if (!first) return route.continue()
    first = false
    const response = await route.fetch()
    expect(response.ok()).toBe(true)
    await route.abort('failed')
  })
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(page.locator('.form-error')).toContainText(
    'try again to safely check and save it once',
  )
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(email)
  await expect(page.getByLabel('Photography service')).toHaveValue(service)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/landing-form-mobile-retry.png', fullPage: true })
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Thank you. Your enquiry is saved.' }),
  ).toBeVisible()
  await expect(
    page.getByText('This is an enquiry, not a confirmed booking.', { exact: false }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/landing-receipt-mobile.png', fullPage: true })
  expect(keys).toHaveLength(2)
  expect(keys[0]).toBe(keys[1])
  const lead = await saved(email)
  expect(lead.serviceId).toBe(service)
  expect(lead.serviceTitle).toBe('Synthetic personal portraits')
  expect(lead.attribution.status).toBe('withheld')
  expect(lead.attribution.snapshot).toBeUndefined()
  expect(optional).toEqual([])
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto(
    `/admin/customers/${typeof lead.contact === 'object' ? lead.contact.id : lead.contact}`,
  )
  await expect(
    page.getByRole('heading', { name: 'Synthetic Landing Visitor', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('A private synthetic portrait idea for this landing test.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Conversation & history', exact: true }).click()
  await expect(page.getByText('Enquiry received', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('landing campaign consent carries minimized tags to the enquiry and withdrawal stops optional events', async ({
  page,
}) => {
  const events: Record<string, string>[] = [],
    campaigns: unknown[] = []
  await page.route('**/api/privacy', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, json: { ...(await response.json()), configured: true } })
  })
  await page.route('**/api/measurement', async (route) => {
    events.push(route.request().postDataJSON())
    await route.fulfill({ status: 204 })
  })
  page.on('request', (request) => {
    if (request.url().endsWith('/api/campaign')) campaigns.push(request.postDataJSON())
  })
  await page.goto(
    `/${slug}?utm_source=google&utm_medium=cpc&utm_campaign=synthetic_portraits&gclid=synthetic_landing_click&email=private@example.test&utm_term=private+idea`,
  )
  await page.getByRole('checkbox', { name: /Remember campaign/ }).check()
  await page.getByRole('checkbox', { name: /Measure service/ }).check()
  await page.getByRole('button', { name: 'Save choices' }).click()
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) => cookie.name === 'lunia_campaign'),
    )
    .toBe(true)
  await page.getByRole('link', { name: 'Enquire about this service' }).click()
  const email = await fill(page)
  await page
    .getByLabel('What do you have in mind?')
    .fill('A second private synthetic message that analytics must never receive.')
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Thank you. Your enquiry is saved.' }),
  ).toBeVisible()
  const lead = await saved(email)
  expect(lead.attribution.snapshot.first.tags).toMatchObject({
    utm_source: 'google',
    utm_campaign: 'synthetic_portraits',
    gclid: 'synthetic_landing_click',
  })
  expect(lead.attribution.snapshot.last.tags).toMatchObject({ utm_source: 'google' })
  expect(events.map((event) => event.event).sort()).toEqual(['inquiry_started', 'service_viewed'])
  for (const event of events) expect(Object.keys(event).sort()).toEqual(['event', 'service'])
  expect(JSON.stringify({ events, campaigns, attribution: lead.attribution })).not.toContain(
    'private',
  )
  expect(JSON.stringify(events)).not.toContain(email)
  await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
  await page.getByRole('button', { name: 'Withdraw optional consent' }).click()
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) =>
        ['lunia_campaign', 'lunia_measurement'].includes(cookie.name),
      ),
    )
    .toBe(false)
  const previousEvents = events.length
  await page.goto(
    `/${slug}?utm_source=newsletter&utm_medium=email&utm_id=withheld_after_withdrawal`,
  )
  await page.getByRole('link', { name: 'Enquire about this service' }).click()
  const afterWithdrawal = await fill(page)
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Thank you. Your enquiry is saved.' }),
  ).toBeVisible()
  expect((await saved(afterWithdrawal)).attribution.status).toBe('withheld')
  expect(events).toHaveLength(previousEvents)
})

test('the native service selector updates authenticated live preview and publishing; unavailable targets never substitute another service', async ({
  page,
}) => {
  await editor.patch(`/api/pages/${landingID}`, { data: { inquiryService: '' } })
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto(`/admin/collections/pages/${landingID}`)
  await page.getByText('Page settings', { exact: true }).click()
  await page.getByLabel('Landing page service (optional)').selectOption(service)
  if (!(await page.locator('#live-preview-iframe').count()))
    await page.getByRole('button', { name: 'Live Preview', exact: true }).click()
  const preview = page.frameLocator('#live-preview-iframe')
  await expect(preview.getByText('Synthetic personal portraits', { exact: true })).toBeVisible()
  await expect(preview.getByRole('link', { name: 'Enquire about this service' })).toHaveAttribute(
    'href',
    `/inquire?service=${encodeURIComponent(service)}`,
  )
  const anonymous = await page.request.get(`/${slug}`)
  expect(await anonymous.text()).not.toContain('Synthetic planning conversation')
  await page.screenshot({ path: 'test-results/landing-native-editor.png', fullPage: true })
  await page.getByRole('button', { name: /Publish changes/ }).click()
  await expect
    .poll(async () => (await (await editor.get(`/api/pages/${landingID}`)).json()).inquiryService)
    .toBe(service)
  const forged = await editor.post(`/preview/live/${landingID}/populate`, {
    headers: { origin },
    data: {
      data: {
        ...(await (await editor.get(`/api/pages/${landingID}`)).json()),
        inquiryOffer: { title: 'Forged offer', id: '999999:forged' },
      },
    },
  })
  expect(forged.ok()).toBe(true)
  expect((await forged.json()).inquiryOffer.title).toBe('Synthetic personal portraits')
  await page.goto(`/${slug}`)
  await expect(page.getByText('Synthetic planning conversation', { exact: true })).toBeVisible()
  expect((await editor.patch(`/api/pages/${sourceID}`, { data: { _status: 'draft' } })).ok()).toBe(
    true,
  )
  await page.reload()
  await expect(page.getByRole('status')).toContainText('not currently available')
  await expect(page.getByRole('link', { name: 'Enquire about this service' })).toHaveCount(0)
  await page.goto(`/inquire?service=${encodeURIComponent(service)}`)
  await expect(page.getByLabel('Photography service')).toHaveValue('')
  await expect(
    page.getByText('The requested service is no longer available.', { exact: false }),
  ).toBeVisible()
})
