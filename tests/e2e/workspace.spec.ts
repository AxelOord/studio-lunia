import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Client } from 'pg'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
const origin = 'http://127.0.0.1:3000'
const execFixture = promisify(execFile)
async function seedEnquiry(input: Record<string, unknown>) {
  const fixture = execFixture(
    process.execPath,
    ['--import', 'tsx', 'tests/helpers/seed-browser-enquiry.ts', JSON.stringify(input)],
    { timeout: 15000 },
  )
  // This fixture reads arguments only; close its unused input pipe.
  fixture.child.stdin?.end()
  const { stdout } = await fixture
  return JSON.parse(stdout) as { id: number; contact: number }
}

let editor: APIRequestContext
let contact = 0,
  enquiry = 0,
  pageID = 0,
  template = 0
let keys: string[] = []
let service = ''
let ownedEnquiries: number[] = [],
  ownedContacts: number[] = []
test.beforeEach(async ({ playwright, page }) => {
  keys = []
  ownedEnquiries = []
  ownedContacts = []
  page.on('request', (request) => {
    if (/api\/customer-(workspace|records)$/.test(request.url()) && request.method() === 'POST') {
      const body = request.postDataJSON()
      if (body.key) keys.push(body.key)
    }
  })
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
  service = `${pageID}:${doc.layout[0].items[0].id}`
  const email = `guided-${randomUUID()}@example.test`
  const lead = await seedEnquiry({
    service,
    name: 'Synthetic Guided Customer',
    email,
    message: 'I would like to discuss this synthetic portrait enquiry.',
    website: '',
    submissionId: randomUUID(),
  })
  enquiry = lead.id
  contact = lead.contact
  ownedEnquiries.push(enquiry)
  ownedContacts.push(contact)
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
      "DELETE FROM payload_jobs WHERE id IN (SELECT job_i_d FROM follow_ups WHERE contact_id = ANY($1)) OR input->>'plan' IN (SELECT id::text FROM follow_ups WHERE contact_id = ANY($1))",
      [ownedContacts],
    )
    await db.query('DELETE FROM follow_ups WHERE contact_id = ANY($1)', [ownedContacts])
    await db.query('DELETE FROM incoming_replies WHERE contact_id = ANY($1)', [ownedContacts])
    await db.query('DELETE FROM customer_activities WHERE contact_id = ANY($1)', [ownedContacts])
    await db.query('DELETE FROM email_messages WHERE contact_id = ANY($1)', [ownedContacts])
    await db.query('DELETE FROM bookings WHERE contact_id = ANY($1)', [ownedContacts])
    await db.query('DELETE FROM enquiries WHERE id = ANY($1)', [ownedEnquiries])
    await db.query('DELETE FROM contacts WHERE id = ANY($1)', [ownedContacts])
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
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No customers in this view' })).toBeVisible()
  await page.getByLabel('Search customers').fill('Synthetic Guided')
  await page.getByLabel('Search customers').press('Tab')
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeFocused()
  await page.getByRole('button', { name: /^New enquiries/ }).click()
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
  await page
    .getByRole('navigation', { name: 'Customer tasks' })
    .getByRole('button', { name: /^Booking/ })
    .click()
  await page.getByRole('button', { name: 'New booking proposal' }).click()
  await page.getByLabel('Expected value', { exact: true }).fill('245.50')
  await page.getByRole('button', { name: 'Enquiry & reply', exact: true }).click()
  await expect(page.getByLabel('Reply template')).toHaveValue(String(template))
  await expect(page.getByLabel('Expected value', { exact: true })).not.toBeVisible()
  await page
    .getByRole('navigation', { name: 'Customer tasks' })
    .getByRole('button', { name: /^Booking/ })
    .click()
  await expect(page.getByLabel('Expected value', { exact: true })).toHaveValue('245.50')
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
  await page
    .getByRole('navigation', { name: 'Customer tasks' })
    .getByRole('button', { name: /^Follow-ups/ })
    .click()
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
  await page.getByText('Simulation tools and planning rules', { exact: true }).click()
  await page.getByRole('button', { name: 'Run due simulations' }).click()
  await expect(page.locator('.state-simulated')).toBeVisible()
  await expect(
    page.getByText('Simulation batch checked. No email sent.', { exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/workspace-queue-mobile.png', fullPage: true })
  await page.getByRole('link', { name: 'Review and manage plan' }).click()
  await page.getByRole('button', { name: 'Conversation & history', exact: true }).click()
  await page.getByText('Record a simulated reply', { exact: true }).click()
  await page
    .getByLabel('Simulated incoming reply')
    .fill('Synthetic customer reply to stop remaining follow-ups.')
  await page.getByRole('button', { name: 'Record simulated reply' }).click()
  await expect(
    page.getByText('Simulated incoming reply; no real mailbox connected', { exact: true }),
  ).toBeVisible()
  await page.getByText('Customer follow-up preferences', { exact: true }).click()
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
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Synthetic temporary search failure' }),
  ).toBeVisible()
  await page.unroute('**/api/customer-workspace')
  await page.getByLabel('Search customers').fill('Synthetic Guided')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Synthetic Guided Customer', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('Synthetic temporary search failure. Try again.')).toHaveCount(0)
})

async function command(
  path: 'customer-records' | 'customer-workspace',
  data: Record<string, unknown>,
) {
  const key = randomUUID()
  keys.push(key)
  const response = await editor.post(`/api/${path}`, {
    headers: { origin },
    data: { ...data, key },
  })
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}
async function createTestPlan(subject: string) {
  const values = {
    enquiry,
    template,
    purpose: 'enquiry_followup',
    timeZone: 'UTC',
    plannedAt: new Date(Date.now() + 86400000).toISOString(),
    subject,
  }
  const preview = await editor.post('/api/customer-workspace', {
    headers: { origin },
    data: { ...values, action: 'previewFollowUp' },
  })
  expect(preview.ok()).toBe(true)
  return command('customer-workspace', {
    ...values,
    action: 'createFollowUp',
    previewToken: (await preview.json()).previewToken,
  })
}
async function openWorkspace(page: Page, plan?: number) {
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto(`/admin/customers/${contact}${plan ? `?plan=${plan}` : ''}`)
  await expect(
    page.getByRole('heading', { name: 'Synthetic Guided Customer', exact: true }),
  ).toBeVisible()
}

test('queue deep link selects an older request and its exact plan for a customer with multiple enquiries', async ({
  page,
}) => {
  const plan = await createTestPlan('Older request follow-up')
  const email = `second-${randomUUID()}@example.test`
  const newer = await seedEnquiry({
    service,
    name: 'Synthetic second request',
    email,
    message: 'A newer synthetic request with a separate original identity.',
    website: '',
    submissionId: randomUUID(),
  })
  ownedEnquiries.push(newer.id)
  ownedContacts.push(newer.contact)
  expect((await editor.patch(`/api/enquiries/${newer.id}`, { data: { contact } })).ok()).toBe(true)
  await openWorkspace(page)
  await expect(page.getByLabel('Customer request')).toHaveValue(String(newer.id))
  await page.goto('/admin/follow-ups')
  await page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'Older request follow-up', exact: true }) })
    .getByRole('link', { name: 'Review and manage plan' })
    .click()
  await expect(page.getByLabel('Customer request')).toHaveValue(String(enquiry))
  await expect(page.locator(`#follow-up-${plan.id}`)).toBeVisible()
  await expect(
    page.locator(`#follow-up-${plan.id}`).getByRole('button', { name: 'Edit or reschedule' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Refresh workspace' }).click()
  await expect(page.getByLabel('Customer request')).toHaveValue(String(enquiry))
})

test('delayed saved email previews cannot reopen after close or replace a newer selection', async ({
  page,
}) => {
  async function draft(subject: string) {
    expect(
      (
        await editor.patch(`/api/email-templates/${template}`, {
          data: { subject, approved: true },
        })
      ).ok(),
    ).toBe(true)
    // Editing wording clears approval, so explicitly approve the saved version.
    expect(
      (await editor.patch(`/api/email-templates/${template}`, { data: { approved: true } })).ok(),
    ).toBe(true)
    return command('customer-records', { action: 'prepareEmail', enquiry, template })
  }
  const b = await draft('Delayed synthetic email B')
  await draft('Latest synthetic email C')
  await openWorkspace(page)
  await page.getByRole('button', { name: 'Conversation & history', exact: true }).click()
  async function delayedRequest() {
    let ready!: () => void, release!: () => void
    const readyPromise = new Promise<void>((resolve) => {
      ready = resolve
    })
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(
      `**/api/customer-records?message=${b.id}`,
      async (route) => {
        const response = await route.fetch()
        ready()
        await releasePromise
        await route.fulfill({ response })
      },
      { times: 1 },
    )
    await page.getByRole('button', { name: 'Delayed synthetic email B', exact: true }).click()
    await readyPromise
    return async () => {
      const response = page.waitForResponse((response) =>
        response.url().endsWith(`/api/customer-records?message=${b.id}`),
      )
      release()
      await (await response).finished()
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      )
    }
  }
  const preview = page.getByRole('region', { name: 'Saved email preview' })
  await page.getByRole('button', { name: 'Latest synthetic email C', exact: true }).click()
  await expect(preview.getByRole('heading', { name: 'Latest synthetic email C' })).toBeVisible()
  const releaseFirst = await delayedRequest()
  await page.getByRole('button', { name: 'Close email preview' }).click()
  await releaseFirst()
  await expect(preview).toHaveCount(0)
  const releaseSecond = await delayedRequest()
  await page.getByRole('button', { name: 'Latest synthetic email C', exact: true }).click()
  await expect(preview.getByRole('heading', { name: 'Latest synthetic email C' })).toBeVisible()
  await releaseSecond()
  await expect(preview.getByRole('heading', { name: 'Latest synthetic email C' })).toBeVisible()
  await expect(preview.getByRole('heading', { name: 'Delayed synthetic email B' })).toHaveCount(0)
})

test('concurrent plan changes preserve edits and require explicit reapply and a fresh exact review', async ({
  page,
}) => {
  const plan = await createTestPlan('Original synthetic plan')
  await openWorkspace(page, plan.id)
  await page.getByRole('button', { name: 'Edit or reschedule' }).click()
  const form = page.getByRole('region', { name: 'Follow-up editor' })
  await form.getByLabel('Message subject').fill('My preserved draft subject')
  await page.getByRole('button', { name: 'Enquiry & reply', exact: true }).click()
  await expect(form).not.toBeVisible()
  await page
    .getByRole('navigation', { name: 'Customer tasks' })
    .getByRole('button', { name: /^Follow-ups/ })
    .click()
  await expect(form.getByLabel('Message subject')).toHaveValue('My preserved draft subject')
  await form
    .getByLabel('Message wording')
    .fill('Hello {{contact_name}}, this wording must survive the conflict.')
  await form.getByRole('button', { name: 'Review exact message' }).click()
  await expect(form.getByRole('region', { name: 'Reviewed follow-up' })).toBeVisible()
  await command('customer-workspace', { action: 'pauseFollowUp', plan: plan.id, revision: 1 })
  const conflict = page.waitForResponse(
    (response) => response.url().endsWith('/api/customer-workspace') && response.status() === 409,
  )
  await form.getByRole('button', { name: 'Save reviewed test plan' }).click()
  await conflict
  await expect(
    form.getByRole('heading', { name: 'This plan changed while you were editing' }),
  ).toBeVisible()
  await expect(form.getByLabel('Message subject')).toHaveValue('My preserved draft subject')
  await expect(form.getByLabel('Message wording')).toHaveValue(
    'Hello {{contact_name}}, this wording must survive the conflict.',
  )
  await expect(form.getByRole('button', { name: 'Save reviewed test plan' })).toBeDisabled()
  await page.screenshot({ path: 'test-results/workspace-conflict-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/workspace-conflict-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Refresh workspace' }).click()
  await expect(form.getByLabel('Message subject')).toHaveValue('My preserved draft subject')
  await form.getByRole('button', { name: 'Use latest revision and keep my edits' }).click()
  await expect(form.getByRole('region', { name: 'Reviewed follow-up' })).toHaveCount(0)
  await expect(form.getByRole('button', { name: 'Save reviewed test plan' })).toBeDisabled()
  await form.getByRole('button', { name: 'Review exact message' }).click()
  await expect(form.getByRole('region', { name: 'Reviewed follow-up' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await form.locator('iframe').scrollIntoViewIfNeeded()
  await expect(
    form
      .frameLocator('iframe')
      .getByText('Hello Synthetic Guided Customer, this wording must survive the conflict.'),
  ).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: 'test-results/workspace-conflict-recovery-mobile.png',
    fullPage: true,
  })
  await form.getByRole('button', { name: 'Save reviewed test plan' }).click()
  await expect(form).toHaveCount(0)
  const saved = await (await editor.get(`/api/follow-ups/${plan.id}?depth=0`)).json()
  expect(saved.revision).toBe(3)
  expect(saved.subject).toBe('My preserved draft subject')
  expect(saved.text).toContain('this wording must survive the conflict')
  await page.getByRole('button', { name: 'Edit or reschedule' }).click()
  await form.getByLabel('Message subject').fill('Keep this copy after cancellation')
  await command('customer-workspace', { action: 'cancelFollowUp', plan: plan.id, revision: 3 })
  await page.getByRole('button', { name: 'Refresh workspace' }).click()
  await expect(form.getByText('This plan can no longer be edited.', { exact: false })).toBeVisible()
  await expect(form.getByLabel('Message subject')).toHaveValue('Keep this copy after cancellation')
  await expect(form.getByRole('button', { name: 'Save reviewed test plan' })).toBeDisabled()
  await expect(
    form.getByRole('button', { name: 'Use latest revision and keep my edits' }),
  ).toHaveCount(0)
})

test('inbox keeps the latest filter response and queue filters survive reload with honest empty and error states', async ({
  page,
}) => {
  const plan = await createTestPlan('Synthetic attention case')
  await page.context().addCookies((await editor.storageState()).cookies)
  await page.goto('/admin')
  await page.getByLabel('Search customers').fill('Synthetic Guided')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  let ready!: () => void, release!: () => void
  const started = new Promise<void>((resolve) => {
    ready = resolve
  })
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/customer-workspace', async (route) => {
    if (route.request().postDataJSON()?.filter !== 'new') return route.continue()
    const response = await route.fetch()
    ready()
    await held
    await route.fulfill({ response })
  })
  await page.getByRole('button', { name: /^New enquiries/ }).click()
  await started
  await page.getByRole('button', { name: /^Needs attention/ }).click()
  await expect(page.getByRole('button', { name: /^Needs attention/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const late = page.waitForResponse(
    (response) => response.request().postDataJSON()?.filter === 'new',
  )
  release()
  await (await late).finished()
  await expect(page.getByRole('button', { name: /^Needs attention/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page).toHaveURL(/filter=attention/)
  expect(page.url()).not.toContain('Synthetic')
  await page.unroute('**/api/customer-workspace')
  await page.goto('/admin/follow-ups')
  await page.getByRole('button', { name: 'Needs attention', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Synthetic attention case', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Needs attention', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Finished', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No follow-ups in this view' })).toBeVisible()
  await page.route('**/api/customer-workspace?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Synthetic outage' }),
    }),
  )
  await page.getByRole('button', { name: 'Needs attention', exact: true }).click()
  await expect(page.locator('.workspace').getByRole('alert')).toContainText(
    'Your previous results are still shown',
  )
  await expect(page.getByRole('button', { name: 'Finished', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.unroute('**/api/customer-workspace?*')
  await page.getByRole('button', { name: 'Needs attention', exact: true }).click()
  await page.getByRole('link', { name: 'Review and manage plan' }).click()
  await expect(page.locator(`#follow-up-${plan.id}`)).toBeVisible()
  await page.getByRole('button', { name: 'Edit or reschedule' }).click()
  await expect(page.getByRole('heading', { name: 'Edit planned message' })).toBeFocused()
  await page.getByRole('button', { name: 'Cancel editing', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit or reschedule' })).toBeFocused()
})
