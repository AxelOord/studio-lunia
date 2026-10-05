import { randomUUID } from 'node:crypto'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

let editor: APIRequestContext
let serviceId: string
let pageId: number
const stamp = Date.now()
const emails: string[] = []
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
  const result = await editor.post('/api/pages', {
    data: {
      title: 'Synthetic enquiry review',
      slug: `enquiry-review-${stamp}`,
      description: 'Synthetic test service',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Synthetic review services',
          items: [
            {
              title: 'Synthetic portrait enquiry',
              body: 'Synthetic service for browser verification.',
            },
          ],
        },
      ],
    },
  })
  expect(result.ok()).toBe(true)
  const { doc } = await result.json()
  pageId = doc.id
  serviceId = `${doc.id}:${doc.layout[0].items[0].id}`
})
test.afterAll(async () => {
  if (!editor) return
  for (const email of emails) {
    const result = await editor.get(
      `/api/enquiries?where[email][equals]=${encodeURIComponent(email)}`,
    )
    for (const doc of (await result.json()).docs ?? [])
      await editor.delete(`/api/enquiries/${doc.id}`)
  }
  if (pageId) await editor.delete(`/api/pages/${pageId}`)
  await editor.dispose()
})
async function fill(page: Page) {
  const email = `inquiry-${randomUUID()}@example.test`
  emails.push(email)
  await page.getByLabel('Photography service').selectOption(serviceId)
  await page.getByLabel('Your name', { exact: true }).fill('Synthetic Browser Visitor')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page
    .getByLabel('What do you have in mind?')
    .fill('Synthetic browser enquiry. No customer information.')
  return email
}
async function lead(email: string) {
  const result = await editor.get(
    `/api/enquiries?where[email][equals]=${encodeURIComponent(email)}`,
  )
  const docs = (await result.json()).docs
  expect(docs).toHaveLength(1)
  return docs[0]
}

test('desktop/mobile accessible form validates, retains details after failure and saves exactly once without tracking', async ({
  page,
}) => {
  const browserErrors: string[] = []
  const optionalRequests: string[] = []
  page.on('pageerror', (e) => browserErrors.push(e.message))
  page.on('request', (r) => {
    if (/posthog|api\/(measurement|campaign)/.test(r.url())) optionalRequests.push(r.url())
  })
  await page.goto('/inquire?utm_source=google&gclid=synthetic_click')
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).toBeVisible()
  await expect(page.getByRole('checkbox').first()).not.toBeChecked()
  await expect(page.getByRole('checkbox').last()).not.toBeChecked()
  expect((await page.context().cookies()).filter((c) => c.name.startsWith('lunia_'))).toHaveLength(
    0,
  )
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(page.locator('.form-error[role=alert]')).toBeFocused()
  await expect(page.getByLabel('Your name', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.screenshot({ path: 'test-results/inquiry-desktop-errors.png', fullPage: true })
  await page.getByRole('button', { name: 'Decline optional' }).click()
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
  const email = await fill(page)
  let first = true
  await page.route('**/api/inquiry', async (route) => {
    if (first) {
      first = false
      await route.abort('failed')
    } else await route.continue()
  })
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(page.locator('.form-error[role=alert]')).toContainText('could not confirm')
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(email)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/inquiry-mobile-retry.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Thank you. Your enquiry is saved.' }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/inquiry-mobile-confirmation.png', fullPage: true })
  const saved = await lead(email)
  expect(saved.attribution.status).toBe('withheld')
  expect(saved.attribution.consent).toBe('denied')
  expect(saved.attribution.snapshot).toBeUndefined()
  await expect.poll(async () => (await lead(email)).notificationStatus).toBe('disabled')
  expect(optionalRequests).toEqual([])
  expect(browserErrors).toEqual([])
})

test('campaign opt-in keeps supported first/last identifiers across navigation; withdrawal removes cookies and withholds enquiry tags', async ({
  page,
}) => {
  await page.goto(
    '/inquire?utm_source=google&utm_medium=cpc&utm_campaign=autumn&gclid=synthetic_click&email=private@example.test&utm_term=private+search',
  )
  await page.getByRole('checkbox', { name: /Remember campaign/ }).check()
  await page.getByRole('button', { name: 'Save choices' }).click()
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
  await expect
    .poll(async () => (await page.context().cookies()).some((c) => c.name === 'lunia_campaign'))
    .toBe(true)
  const optional = (await page.context().cookies()).find((c) => c.name === 'lunia_campaign')!
  expect(optional.httpOnly).toBe(true)
  expect(optional.sameSite).toBe('Lax')
  expect((await page.context().cookies()).some((c) => c.name === 'lunia_measurement')).toBe(false)
  await page.goto(
    '/inquire?utm_source=newsletter&utm_medium=email&utm_id=campaign-2&utm_content=card-2',
  )
  const email = await fill(page)
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Thank you. Your enquiry is saved.' }),
  ).toBeVisible()
  const saved = await lead(email)
  expect(saved.attribution.snapshot.first.tags.utm_source).toBe('google')
  expect(saved.attribution.snapshot.last.tags.utm_source).toBe('newsletter')
  expect(JSON.stringify(saved.attribution)).not.toContain('private')
  await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
  await page.getByRole('button', { name: 'Withdraw optional consent' }).click()
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((c) =>
        ['lunia_campaign', 'lunia_measurement'].includes(c.name),
      ),
    )
    .toBe(false)
  await page.goto('/inquire?utm_source=google&gclid=should_be_withheld')
  const afterWithdrawal = await fill(page)
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Thank you. Your enquiry is saved.' }),
  ).toBeVisible()
  expect((await lead(afterWithdrawal)).attribution.status).toBe('withheld')
})

test('blocked browser storage does not prevent a no-consent enquiry', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked for synthetic test')
    }
    Storage.prototype.getItem = () => {
      throw new Error('Storage blocked for synthetic test')
    }
  })
  await page.goto('/inquire')
  const email = await fill(page)
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Thank you. Your enquiry is saved.' }),
  ).toBeVisible()
  expect((await lead(email)).attribution.consent).toBe('unknown')
})

test('measurement consent alone emits only fixed view/start events once and stops on withdrawal', async ({
  page,
}) => {
  // Simulate the non-secret configured flag only. The server provider stays disabled.
  await page.route('**/api/privacy', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, json: { ...(await response.json()), configured: true } })
  })
  const events: Record<string, string>[] = []
  await page.route('**/api/measurement', async (route) => {
    events.push(route.request().postDataJSON())
    await route.fulfill({ status: 204 })
  })
  await page.goto('/inquire')
  await page.getByRole('checkbox', { name: /Measure service/ }).check()
  await page.getByRole('button', { name: 'Save choices' }).click()
  // A click starts an asynchronous consent save. Actions before it completes are
  // correctly withheld, so the consented journey must await its visible confirmation.
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
  await fill(page)
  await page
    .getByLabel('What do you have in mind?')
    .fill('Another synthetic form message, excluded from analytics.')
  await expect.poll(() => events.length).toBe(2)
  expect(events.map((e) => e.event).sort()).toEqual(['inquiry_started', 'service_viewed'])
  for (const event of events) expect(Object.keys(event).sort()).toEqual(['event', 'service'])
  expect(JSON.stringify(events)).not.toContain('example.test')
  expect((await page.context().cookies()).some((c) => c.name === 'lunia_campaign')).toBe(false)
  await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
  await page.getByRole('button', { name: 'Withdraw optional consent' }).click()
  await page.getByLabel('Photography service').selectOption('')
  await page.getByLabel('Photography service').selectOption(serviceId)
  expect(events).toHaveLength(2)
  expect((await page.context().cookies()).some((c) => c.name === 'lunia_measurement')).toBe(false)
})

test('HTTP enquiry boundary rejects spoofed origins/spam/size and deduplicates actual concurrent POSTs', async ({
  request,
}) => {
  const email = `boundary-${randomUUID()}@example.test`
  emails.push(email)
  const data = {
    service: serviceId,
    name: 'Synthetic API Visitor',
    email,
    message: 'Synthetic HTTP boundary enquiry.',
    website: '',
    submissionId: randomUUID(),
  }
  expect(
    (
      await request.post('/api/inquiry', { headers: { origin: 'https://evil.example' }, data })
    ).status(),
  ).toBe(403)
  expect(
    (
      await request.post('/api/inquiry', { headers: { origin }, data: { ...data, website: 'bot' } })
    ).status(),
  ).toBe(422)
  expect(
    (
      await request.post('/api/inquiry', {
        headers: { origin },
        data: { ...data, message: 'x'.repeat(17_000) },
      })
    ).status(),
  ).toBe(413)
  const results = await Promise.all([
    request.post('/api/inquiry', { headers: { origin }, data }),
    request.post('/api/inquiry', { headers: { origin }, data }),
  ])
  expect(results.map((r) => r.status())).toEqual([200, 200])
  expect((await results[0].json()).receipt).toBe((await results[1].json()).receipt)
  expect(
    (
      await request.post('/api/inquiry', {
        headers: { origin },
        data: { ...data, message: 'A different synthetic enquiry.' },
      })
    ).status(),
  ).toBe(409)
  const doc = await lead(email)
  expect([401, 403]).toContain((await request.get(`/api/enquiries/${doc.id}`)).status())
  expect(
    (await request.post(`/api/inquiry/${doc.id}/retry`, { headers: { origin } })).status(),
  ).toBe(401)
  const edit = await editor.patch(`/api/enquiries/${doc.id}`, {
    data: { followUp: 'contacted', email: 'tampered@example.test', attribution: { invalid: true } },
  })
  expect(edit.ok()).toBe(true)
  const updated = await lead(email)
  expect(updated.followUp).toBe('contacted')
  expect(updated.email).toBe(email)
  expect(updated.attribution.status).toBe('withheld')
  expect(
    (
      await request.post('/api/privacy', {
        headers: { origin },
        data: { analytics: true, campaigns: false },
      })
    ).ok(),
  ).toBe(true)
  expect(
    (
      await request.post('/api/measurement', {
        headers: { origin },
        data: { event: 'inquiry_submitted', service: serviceId },
      })
    ).status(),
  ).toBe(400)
  const throttled = {
    ...data,
    email: `throttle-${randomUUID()}@example.test`,
    service: '999999:missing',
    submissionId: randomUUID(),
  }
  for (let i = 0; i < 5; i++)
    expect(
      (await request.post('/api/inquiry', { headers: { origin }, data: throttled })).status(),
    ).toBe(422)
  expect(
    (await request.post('/api/inquiry', { headers: { origin }, data: throttled })).status(),
  ).toBe(429)
})
