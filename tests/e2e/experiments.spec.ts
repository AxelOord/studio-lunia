import { createHmac, randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { test, expect, type Page } from '@playwright/test'

const origin = 'http://127.0.0.1:3000'
let pageID: number, experimentID: number, service: string, slug: string
let studioDayID = 0
let revokedVisitorKeys: string[] = []
let inquiryAttempts = 0
const original = 'Enquire about this service',
  alternate = 'Share your session idea'
async function localDB(work: (db: Client) => Promise<void>) {
  const url = new URL(process.env.DATABASE_URL!)
  expect(['127.0.0.1', 'localhost', '[::1]']).toContain(url.hostname)
  expect(url.pathname).toMatch(/^\/lunia_test_[a-f0-9]{32}$/)
  const db = new Client({ connectionString: url.href })
  await db.connect()
  try {
    await work(db)
  } finally {
    await db.end()
  }
}
async function counts() {
  let result = { assigned: 0, exposed: 0, converted: 0 }
  await localDB(async (db) => {
    const row = await db.query(
      'SELECT count(*)::int AS assigned,count(exposed_at)::int AS exposed,count(converted_at)::int AS converted FROM lunia_experiment_enrollments WHERE experiment_id=$1',
      [experimentID],
    )
    result = row.rows[0]
  })
  return result
}
async function consent(page: Page, reopen = false) {
  if (reopen) await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).toBeVisible()
  await page.getByRole('checkbox', { name: /Take part in page improvement tests/ }).check()
  await page.getByRole('button', { name: 'Save choices', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
}
async function simulate(page: Page) {
  await page.goto('/admin/experiments')
  await expect(page.getByRole('heading', { name: 'Live delivery disabled' })).toBeVisible()
  await page.getByRole('button', { name: 'Try simulation on landing' }).click()
  await expect(page).toHaveURL('/' + slug)
}
test.beforeEach(async ({ page }) => {
  pageID = 0
  experimentID = 0
  inquiryAttempts = 0
  studioDayID = 0
  revokedVisitorKeys = []
  expect(
    (
      await page.request.post('/api/users/login', {
        data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
      })
    ).ok(),
  ).toBe(true)
  slug = 'experiment-' + randomUUID()
  const created = await page.request.post('/api/pages', {
    data: {
      title: 'Synthetic experiment journey',
      slug,
      description: 'Synthetic fixture only',
      _status: 'published',
      layout: [
        {
          blockType: 'hero',
          heading: 'A synthetic portrait experience',
          body: 'A local simulation for testing page improvements.',
        },
        {
          blockType: 'services',
          heading: 'Synthetic portrait service',
          items: [
            { title: 'Synthetic portrait offer', body: 'Synthetic photography details only.' },
          ],
        },
      ],
    },
  })
  expect(created.ok(), await created.text()).toBe(true)
  const { doc } = await created.json()
  pageID = doc.id
  service = `${doc.id}:${doc.layout[1].items[0].id}`
  expect(
    (
      await page.request.patch(`/api/pages/${pageID}`, {
        data: { inquiryService: service, _status: 'published' },
      })
    ).ok(),
  ).toBe(true)
  const plan = await page.request.post('/api/experiments', {
    data: {
      name: 'Synthetic CTA rehearsal',
      hypothesis: 'Clear request wording may help a visitor start a personal enquiry.',
      page: pageID,
      mode: 'simulation',
      state: 'ready',
      treatmentLabel: alternate,
      treatmentPercent: 50,
      baseline: 'Synthetic planning baseline. No live visitor evidence yet.',
      trafficPlan:
        'Review a real baseline and power calculation before launch; this is simulation only.',
      minimumPerVariant: 1000,
      durationDays: 14,
    },
  })
  expect(plan.ok(), await plan.text()).toBe(true)
  experimentID = (await plan.json()).doc.id
})
test.afterEach(async () => {
  await localDB(async (db) => {
    // All local browser requests share one IP bucket. Remove only this test's
    // completed requests, preserving earlier fixtures' attempts and the real limit.
    if (inquiryAttempts) {
      const key = createHmac('sha256', process.env.PAYLOAD_SECRET!)
        .update('inquiry-ip:local')
        .digest('hex')
      await db.query(
        'UPDATE lunia_rate_limits SET attempts=attempts-$1 WHERE key=$2 AND attempts >= $1',
        [inquiryAttempts, key],
      )
    }
    if (experimentID) {
      const visitors = await db.query(
        'DELETE FROM lunia_experiment_enrollments WHERE experiment_id=$1 RETURNING visitor_key',
        [experimentID],
      )
      await db.query('DELETE FROM experiments WHERE id=$1', [experimentID])
      await db.query('DELETE FROM lunia_experiment_visitors WHERE key=ANY($1::text[])', [
        [...visitors.rows.map((row) => row.visitor_key), ...revokedVisitorKeys],
      ])
    }
    if (pageID) {
      const enquiries = await db.query('SELECT id,contact_id FROM enquiries WHERE service_id=$1', [
        service,
      ])
      for (const doc of enquiries.rows) {
        await db.query('DELETE FROM customer_activities WHERE enquiry_id=$1', [doc.id])
        await db.query('DELETE FROM email_messages WHERE enquiry_id=$1', [doc.id])
        await db.query('DELETE FROM enquiries WHERE id=$1', [doc.id])
        await db.query('DELETE FROM contacts WHERE id=$1', [doc.contact_id])
      }
      await db.query('DELETE FROM pages WHERE id=$1', [pageID])
    }
    if (studioDayID) {
      await db.query('DELETE FROM studio_slots WHERE day_id=$1', [studioDayID])
      await db.query('DELETE FROM _studio_days_v WHERE parent_id=$1', [studioDayID])
      await db.query('DELETE FROM studio_days WHERE id=$1', [studioDayID])
    }
  })
})

test('desktop simulation uses real consent, stable visits, visible exposure and a durable enquiry with lost-response retry', async ({
  page,
}) => {
  const errors: string[] = [],
    provider: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/posthog|api\/measurement/.test(request.url())) provider.push(request.url())
  })
  await page.goto('/admin/experiments')
  await page.screenshot({ path: 'test-results/experiments-desktop-empty.png', fullPage: true })
  await simulate(page)
  const cta = page.locator('.landing-offer a.button-link')
  await expect(cta).toContainText(original)
  expect(
    (await page.context().cookies()).find((cookie) => cookie.name === 'lunia_experiments'),
  ).toBeUndefined()
  expect(await counts()).toEqual({ assigned: 0, exposed: 0, converted: 0 })
  await consent(page)
  await expect(page.getByText('Staff simulation · Synthetic test results only')).toBeVisible()
  await page.locator('.landing-offer a.button-link').scrollIntoViewIfNeeded()
  await expect.poll(counts).toEqual({ assigned: 1, exposed: 1, converted: 0 })
  const label = await cta.innerText()
  const cookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'lunia_experiments',
  )!
  expect(cookie.httpOnly).toBe(true)
  expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 29 * 86400)
  await page.reload()
  await expect(cta).toHaveText(label)
  expect((await page.context().cookies()).find((c) => c.name === cookie.name)!.value).toBe(
    cookie.value,
  )
  await page.screenshot({ path: 'test-results/experiments-desktop-landing.png', fullPage: true })
  await cta.click()
  await expect(page.getByLabel('Photography service')).toHaveValue(service)
  await page.getByLabel('Your name', { exact: true }).fill('Synthetic Experiment Visitor')
  await page
    .getByLabel('Email address', { exact: true })
    .fill('experiment-' + randomUUID() + '@example.test')
  await page
    .getByLabel('What do you have in mind?')
    .fill('Synthetic experiment enquiry, no customer details.')
  let first = true
  await page.route('**/api/inquiry', async (route) => {
    const response = await route.fetch()
    inquiryAttempts++
    if (first) {
      first = false
      await route.abort('failed')
    } else await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(page.locator('.form-error[role=alert]')).toContainText('could not confirm')
  await expect.poll(counts).toEqual({ assigned: 1, exposed: 1, converted: 1 })
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Thank you. Your enquiry is saved.' }),
  ).toBeVisible()
  expect(await counts()).toEqual({ assigned: 1, exposed: 1, converted: 1 })
  await page.goto('/admin/experiments')
  await expect(page.getByText('Insufficient planned sample or duration')).toBeVisible()
  await expect(page.getByText(/Descriptive 95% interval:/)).toBeVisible()
  await page.screenshot({ path: 'test-results/experiments-desktop-results.png', fullPage: true })
  expect(provider).toEqual([])
  expect(errors).toEqual([])
})

test('mobile withdrawal clears persistent assignment, stops other tabs and rejects a delayed assignment response', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await simulate(page)
  await consent(page)
  await page.locator('.landing-offer a.button-link').scrollIntoViewIfNeeded()
  await expect.poll(counts).toEqual({ assigned: 1, exposed: 1, converted: 0 })
  const other = await context.newPage()
  await other.goto('/' + slug)
  await expect(other.getByText('Staff simulation · Synthetic test results only')).toBeVisible()
  await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
  const firstWithdrawal = page.waitForResponse(
    (response) => response.url().endsWith('/api/privacy') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Withdraw optional consent' }).click()
  await expect(page.locator('.landing-offer a.button-link')).toContainText(original)
  await expect(other.getByText('Staff simulation · Synthetic test results only')).not.toBeVisible()
  expect((await firstWithdrawal).ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
  expect(
    (await context.cookies()).find((cookie) => cookie.name === 'lunia_experiments'),
  ).toBeUndefined()
  await other.close()
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let received!: () => void
  const ready = new Promise<void>((resolve) => {
    received = resolve
  })
  await page.route('**/api/experiments/assignment', async (route) => {
    const response = await route.fetch()
    received()
    await held
    await route.fulfill({ response }).catch(() => {})
  })
  await consent(page, true)
  await ready
  await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
  const secondWithdrawal = page.waitForResponse(
    (response) => response.url().endsWith('/api/privacy') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Withdraw optional consent' }).click()
  expect((await secondWithdrawal).ok()).toBe(true)
  await expect(page.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
  release()
  await expect.poll(counts).toEqual({ assigned: 2, exposed: 1, converted: 0 })
  await expect(page.locator('.landing-offer a.button-link')).toContainText(original)
  await expect(page.getByText('Staff simulation · Synthetic test results only')).not.toBeVisible()
  await page.screenshot({ path: 'test-results/experiments-mobile-withdrawn.png', fullPage: true })
  await page.goto('/admin/experiments')
  await expect(page.getByRole('heading', { name: 'Page experiments', exact: true })).toBeVisible()
  await page.getByText('Baseline, sample plan and limitations').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Traffic and stopping plan' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/experiments-mobile-results.png', fullPage: true })
})

test('studio and experiment consent stay independent across tabs, withdrawal and a stale privacy read', async ({
  page,
  context,
}) => {
  const studioSlug = 'combined-privacy-' + randomUUID()
  const created = await page.request.post('/api/studio-days', {
    data: {
      title: 'Synthetic combined privacy day',
      slug: studioSlug,
      location: 'Synthetic test location',
      localDate: '2027-03-27',
      timeZone: 'Europe/Amsterdam',
      offerTitle: 'Synthetic privacy session',
      inclusions: 'Synthetic testing only',
      durationMinutes: 30,
      bufferMinutes: 0,
      capacity: 1,
      priceMinor: 12300,
      currency: 'EUR',
      opensLocal: '09:00',
      closesLocal: '12:00',
      bookingDeadlineLocal: '2027-03-27T08:00',
      changePolicy: 'Synthetic test conditions only',
      confirmationMode: 'immediate',
      bookingsOpen: true,
      dayState: 'scheduled',
      _status: 'published',
    },
  })
  expect(created.ok(), await created.text()).toBe(true)
  studioDayID = (await created.json()).doc.id
  // Exercise both client contracts without activating the provider. Experiment
  // consent, assignment, exposure and revocation still use the real local server.
  await context.route('**/api/privacy', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, json: { ...(await response.json()), configured: true } })
  })
  const events: Record<string, unknown>[] = []
  await context.route('**/api/measurement', async (route) => {
    events.push(route.request().postDataJSON())
    await route.fulfill({ status: 204 })
  })
  const studioEvents = () => events.filter((event) => String(event.event).startsWith('studio_'))
  const studio = await context.newPage()
  const late = await context.newPage()
  let release!: () => void
  let loaded!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const captured = new Promise<void>((resolve) => {
    loaded = resolve
  })
  try {
    await simulate(page)
    await studio.goto('/studio-days/' + studioSlug)
    await expect(studio.getByRole('heading', { name: 'Your privacy choices' })).toBeVisible()
    await studio.getByLabel('Session time ·').selectOption({ index: 1 })
    expect(studioEvents()).toEqual([])
    expect(await counts()).toEqual({ assigned: 0, exposed: 0, converted: 0 })

    await page.getByLabel(/Measure service/).check()
    await consent(page)
    await page.locator('.landing-offer a.button-link').scrollIntoViewIfNeeded()
    await expect.poll(counts).toEqual({ assigned: 1, exposed: 1, converted: 0 })
    // Saving in another tab pauses this tab until it refreshes the saved choice.
    await studio.getByLabel('Session time ·').selectOption({ index: 2 })
    expect(studioEvents()).toEqual([])
    await studio.reload()
    await studio
      .getByRole('heading', { name: 'Synthetic combined privacy day' })
      .scrollIntoViewIfNeeded()
    await expect.poll(studioEvents).toEqual([{ event: 'studio_day_viewed', day: studioDayID }])
    await studio.getByLabel('Session time ·').selectOption({ index: 1 })
    await studio.getByLabel('Session time ·').selectOption({ index: 2 })
    await expect.poll(studioEvents).toEqual([
      { event: 'studio_day_viewed', day: studioDayID },
      { event: 'studio_slot_selected', day: studioDayID },
    ])

    await late.route('**/api/privacy', async (route) => {
      const response = await route.fetch()
      const old = await response.json()
      loaded()
      await held
      await route.fulfill({ response, json: { ...old, configured: true } })
    })
    await late.goto('/studio-days/' + studioSlug)
    await captured
    await studio.getByRole('button', { name: 'Privacy choices', exact: true }).click()
    await studio.getByRole('button', { name: 'Withdraw optional consent' }).click()
    await expect(page.getByText('Staff simulation · Synthetic test results only')).not.toBeVisible()
    await expect(page.locator('.landing-offer a.button-link')).toContainText(original)
    const completed = late.waitForResponse('**/api/privacy')
    release()
    await completed
    await expect(studio.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
    expect((await context.cookies()).some((cookie) => cookie.name === 'lunia_experiments')).toBe(
      false,
    )
    await late
      .getByRole('heading', { name: 'Synthetic combined privacy day' })
      .scrollIntoViewIfNeeded()
    await late.getByLabel('Session time ·').selectOption({ index: 1 })
    await late.getByRole('button', { name: 'Privacy choices', exact: true }).click()
    await expect(late.getByLabel(/Measure service/)).not.toBeChecked()
    await expect(late.getByLabel(/Take part in page improvement tests/)).not.toBeChecked()
    expect(studioEvents()).toHaveLength(2)
    expect(await counts()).toEqual({ assigned: 1, exposed: 1, converted: 0 })

    // Analytics-only regrant cannot restore experiment identity or backfill the
    // pre-consent slot choice. New current exposure is the only added studio step.
    await late.unroute('**/api/privacy')
    await late.getByLabel(/Measure service/).check()
    await late.getByRole('button', { name: 'Save choices', exact: true }).click()
    await expect(late.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
    await late
      .getByRole('heading', { name: 'Synthetic combined privacy day' })
      .scrollIntoViewIfNeeded()
    await expect.poll(studioEvents).toEqual([
      { event: 'studio_day_viewed', day: studioDayID },
      { event: 'studio_slot_selected', day: studioDayID },
      { event: 'studio_day_viewed', day: studioDayID },
    ])
    await page.reload()
    await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
    await expect(page.getByLabel(/Measure service/)).toBeChecked()
    await expect(page.getByLabel(/Take part in page improvement tests/)).not.toBeChecked()
    await expect(page.locator('.landing-offer a.button-link')).toContainText(original)
    expect((await context.cookies()).some((cookie) => cookie.name === 'lunia_experiments')).toBe(
      false,
    )
    expect(await counts()).toEqual({ assigned: 1, exposed: 1, converted: 0 })
    expect(events.some((event) => event.event === 'studio_booking_submitted')).toBe(false)
  } finally {
    release()
    await late.close()
    await studio.close()
  }
})

test('a withdrawal in another tab wins over an in-flight grant in UI, cookies and server revocation; fresh reconsent works', async ({
  page,
  context,
}) => {
  await context.route('**/api/privacy', async (route) => {
    const response = await route.fetch()
    await route.fulfill({ response, json: { ...(await response.json()), configured: true } })
  })
  const optionalRequests: string[] = []
  await context.route('**/api/measurement', async (route) => {
    optionalRequests.push(route.request().url())
    await route.fulfill({ status: 204 })
  })
  context.on('request', (request) => {
    if (request.url().endsWith('/api/campaign')) optionalRequests.push(request.url())
  })
  await simulate(page)
  const other = await context.newPage()
  await other.goto('/' + slug)
  await expect(other.getByRole('heading', { name: 'Your privacy choices' })).toBeVisible()
  const before = await context.cookies()
  let release!: () => void, received!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const ready = new Promise<void>((resolve) => {
    received = resolve
  })
  let grantCookies: { name: string; value: string }[] = []
  let grantReleased = false
  const withdrawalRequests: { afterGrant: boolean; cookie: string }[] = []
  await other.route('**/api/privacy', async (route) => {
    if (route.request().method() === 'POST')
      withdrawalRequests.push({
        afterGrant: grantReleased,
        cookie: route.request().headers().cookie || '',
      })
    await route.fallback()
  })
  await page.route('**/api/privacy', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const response = await route.fetch()
    grantCookies = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => {
        const pair = header.value.split(';')[0]
        const index = pair.indexOf('=')
        return { name: pair.slice(0, index), value: pair.slice(index + 1) }
      })
    received()
    await held
    grantReleased = true
    await route.fulfill({ response, json: { ...(await response.json()), configured: true } })
  })
  try {
    await page.getByLabel(/Measure service/).check()
    await page.getByLabel(/Remember campaign tags/).check()
    await page.getByLabel(/Take part in page improvement tests/).check()
    await page.getByRole('button', { name: 'Save choices', exact: true }).click()
    await ready
    expect(grantCookies.map((cookie) => cookie.name)).toEqual(
      expect.arrayContaining(['lunia_preferences', 'lunia_experiments', 'lunia_measurement']),
    )
    const issued = grantCookies.find((cookie) => cookie.name === 'lunia_experiments')!.value
    const visitor = JSON.parse(Buffer.from(issued.split('.')[0], 'base64url').toString()).value
    const visitorKey = createHmac('sha256', process.env.PAYLOAD_SECRET!)
      .update('experiment:' + visitor.id)
      .digest('hex')
    revokedVisitorKeys.push(visitorKey)
    await other.getByRole('button', { name: 'Decline optional', exact: true }).click()
    // Keep the first real response in flight until the second tab is waiting.
    // No withdrawal request may leave with the pre-grant cookie jar.
    await expect
      .poll(() => other.evaluate(async () => (await navigator.locks.query()).pending?.length || 0))
      .toBeGreaterThan(0)
    expect(withdrawalRequests).toEqual([])
    await expect(page.getByLabel(/Measure service/)).not.toBeChecked()
    await expect(page.getByLabel(/Take part in page improvement tests/)).not.toBeChecked()
    const withdrawn = other.waitForResponse(
      (response) =>
        response.url().endsWith('/api/privacy') && response.request().method() === 'POST',
    )
    release()
    expect((await withdrawn).ok()).toBe(true)
    await expect(other.getByRole('heading', { name: 'Your privacy choices' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Save choices', exact: true })).toBeEnabled()
    expect(withdrawalRequests).toHaveLength(1)
    expect(withdrawalRequests[0].afterGrant).toBe(true)
    expect(withdrawalRequests[0].cookie).toContain('lunia_experiments=' + issued)
    expect(optionalRequests).toEqual([])
    expect(await counts()).toEqual({ assigned: 0, exposed: 0, converted: 0 })
    expect(
      (await context.cookies()).filter((cookie) =>
        ['lunia_experiments', 'lunia_measurement', 'lunia_campaign'].includes(cookie.name),
      ),
    ).toEqual([])
    expect(await (await page.request.get('/api/privacy')).json()).toMatchObject({
      analytics: false,
      campaigns: false,
      experiments: false,
      decided: true,
    })
    await localDB(async (db) => {
      expect(
        (await db.query('SELECT revoked FROM lunia_experiment_visitors WHERE key=$1', [visitorKey]))
          .rows,
      ).toEqual([{ revoked: true }])
    })
    // Even replaying the entire older grant's signed cookie set cannot assign.
    const oldJar = [
      ...before.filter((cookie) => !grantCookies.some((grant) => grant.name === cookie.name)),
      ...grantCookies,
    ]
    const retry = await page.request.post('/api/experiments/assignment', {
      headers: {
        origin,
        cookie: oldJar.map((cookie) => cookie.name + '=' + cookie.value).join('; '),
      },
      data: { page: pageID },
    })
    expect(await retry.json()).toBeNull()
    await page.unroute('**/api/privacy')
    await page.reload()
    await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
    await expect(page.getByLabel(/Measure service/)).not.toBeChecked()
    await expect(page.getByLabel(/Take part in page improvement tests/)).not.toBeChecked()
    await expect(page.locator('.landing-offer a.button-link')).toContainText(original)
    await page.getByLabel(/Measure service/).check()
    await consent(page)
    await page.locator('.landing-offer a.button-link').scrollIntoViewIfNeeded()
    await expect.poll(counts).toEqual({ assigned: 1, exposed: 1, converted: 0 })
    const fresh = (await context.cookies()).find(
      (cookie) => cookie.name === 'lunia_experiments',
    )!.value
    expect(fresh).not.toBe(issued)
    await page.reload()
    await expect(page.getByText('Staff simulation · Synthetic test results only')).toBeVisible()
    expect(
      (await context.cookies()).find((cookie) => cookie.name === 'lunia_experiments')!.value,
    ).toBe(fresh)
    expect(await counts()).toEqual({ assigned: 1, exposed: 1, converted: 0 })
  } finally {
    release()
    await other.close()
  }
})

test('missing cross-tab coordination fails closed without creating optional consent or preventing an enquiry', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined })
  })
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/privacy') && request.method() === 'POST')
      writes.push(request.url())
  })
  await simulate(page)
  await page.getByRole('button', { name: 'Privacy choices', exact: true }).click()
  await page.getByLabel(/Measure service/).check()
  await page.getByLabel(/Take part in page improvement tests/).check()
  await page.getByRole('button', { name: 'Save choices', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Privacy choices' }).getByRole('alert'),
  ).toContainText('Collection is paused on this page')
  expect(writes).toEqual([])
  expect((await context.cookies()).some((cookie) => cookie.name === 'lunia_experiments')).toBe(
    false,
  )
  expect(await counts()).toEqual({ assigned: 0, exposed: 0, converted: 0 })
  await page.locator('.landing-offer a.button-link').click()
  await expect(page.getByLabel('Your name', { exact: true })).toBeVisible()
})

test('private authoring, permanent stop and retain-to-draft preserve published content and deny anonymous commands', async ({
  page,
  playwright,
}) => {
  const anonymous = await playwright.request.newContext({ baseURL: origin })
  expect((await anonymous.get('/api/experiments')).status()).toBe(403)
  expect(
    (
      await anonymous.post('/api/experiments/manage', {
        headers: { origin },
        data: { id: experimentID, action: 'simulate' },
      })
    ).status(),
  ).toBe(401)
  await anonymous.dispose()
  await page.goto(`/admin/collections/experiments/${experimentID}`)
  await expect(page.getByLabel(/Alternate CTA/)).toHaveValue(alternate)
  await page.screenshot({ path: 'test-results/experiments-desktop-plan.png', fullPage: true })
  await page.goto('/admin/experiments')
  await page.getByRole('button', { name: 'Stop experiment', exact: true }).click()
  await expect(page.getByText('Stopped permanently.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Copy alternate to page draft', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/collections/pages/${pageID}$`))
  const draft = await (await page.request.get(`/api/pages/${pageID}?draft=true`)).json()
  expect(draft.inquiryButtonLabel).toBe(alternate)
  await page.goto('/' + slug)
  await expect(page.locator('.landing-offer a.button-link')).toContainText(original)
})
