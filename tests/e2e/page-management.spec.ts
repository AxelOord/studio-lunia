import sharp from 'sharp'
import { test, expect, type APIRequestContext, type Page as BrowserPage } from '@playwright/test'
import type { Media, Page } from '../../src/payload-types'

const origin = 'http://127.0.0.1:3000'

async function openPreview(page: BrowserPage) {
  // Native preferences can reopen the panel asynchronously after form hydration.
  await expect(async () => {
    if (!(await page.locator('#live-preview-iframe').count()))
      await page.getByRole('button', { name: 'Live Preview', exact: true }).click({ timeout: 1000 })
    await expect(page.locator('#live-preview-iframe')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15000 })
  return page.frameLocator('#live-preview-iframe')
}

async function fixture(request: APIRequestContext) {
  expect(
    (
      await request.post('/api/users/login', {
        data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
      })
    ).ok(),
  ).toBe(true)
  const stamp = Date.now()
  const media: Media[] = []
  for (const [index, color] of ['#728061', '#ba9482'].entries()) {
    const response = await request.post('/api/media', {
      multipart: {
        _payload: JSON.stringify({
          alt: `Synthetic preview image ${index}`,
          visibility: 'private',
        }),
        file: {
          name: `find-photo-${stamp}-${index}.png`,
          mimeType: 'image/png',
          buffer: await sharp({
            create: { width: 800, height: 600, channels: 3, background: color },
          })
            .png()
            .toBuffer(),
        },
      },
    })
    expect(response.ok()).toBe(true)
    media.push((await response.json()).doc)
  }
  const created = await request.post('/api/pages', {
    data: {
      title: 'Synthetic editor review',
      slug: `editor-review-${stamp}`,
      description: 'Synthetic editor test only.',
      _status: 'published',
      layout: [
        { blockType: 'hero', heading: 'Saved hero', image: media[0].id },
        { blockType: 'text', heading: 'Saved text', body: 'Synthetic text' },
        { blockType: 'gallery', heading: 'Saved gallery', images: [{ image: media[0].id }] },
        {
          blockType: 'imageText',
          heading: 'Saved image and text',
          body: 'Synthetic text',
          image: media[0].id,
        },
        {
          blockType: 'services',
          heading: 'Saved services',
          items: [{ title: 'Synthetic card', body: 'Synthetic card text' }],
        },
        { blockType: 'callToAction', heading: 'Saved CTA', label: 'Home', href: '/' },
      ],
    },
  })
  expect(created.ok()).toBe(true)
  const doc: Page = (await created.json()).doc
  return {
    doc,
    media,
    cleanup: async () => {
      await request.delete(`/api/pages/${doc.id}`)
      for (const item of media) await request.delete(`/api/media/${item.id}`)
    },
  }
}

test('native editor previews unsaved changes for all blocks, mobile, slug and explicit saves', async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(120000)
  page.setDefaultTimeout(15000)
  const { doc, media, cleanup } = await fixture(request)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const publicContext = await browser.newContext()
  const publicPage = await publicContext.newPage()
  try {
    const stored = await (await request.get(`/api/pages/${doc.id}?draft=true&depth=0`)).json()
    const versions = await (
      await request.get(`/api/pages/versions?where[parent][equals]=${doc.id}`)
    ).json()
    await page.context().addCookies((await request.storageState()).cookies)
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.goto(`/admin/collections/pages/${doc.id}`)
    await expect(page.getByText('1. Intro / hero — Saved hero', { exact: true })).toBeVisible()
    await expect(page.locator('#field-title')).toBeHidden()
    await page
      .locator('#field-layout')
      .getByRole('button', { name: 'Show All', exact: true })
      .first()
      .click()
    const frame = await openPreview(page)
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Saved hero')
    for (let i = 0; i < 6; i++) {
      await page.locator(`#field-layout__${i}__heading`).fill(`Unsaved section ${i}`)
      await expect(
        frame.getByRole('heading', { name: `Unsaved section ${i}`, exact: true }),
      ).toBeVisible()
    }
    // Payload mounts nested fields when their row enters the viewport.
    await page.locator('#layout-row-4').scrollIntoViewIfNeeded()
    await page.locator('#field-layout__4__items__0__title').fill('Unsaved service card')
    await expect(
      frame.getByRole('heading', { name: 'Unsaved service card', exact: true }),
    ).toBeVisible()
    // The existing upload control exposes filename, thumbnail, remove and replacement.
    for (const field of ['layout__0__image', 'layout__2__images__0__image', 'layout__3__image']) {
      await page.locator(`#layout-row-${field.split('__')[1]}`).scrollIntoViewIfNeeded()
      const upload = page.locator(`#field-${field}`)
      await expect(upload.getByText(media[0].filename!, { exact: true })).toBeVisible()
      await upload.getByRole('button', { name: 'Remove', exact: true }).click()
      await upload.getByRole('button', { name: 'Choose from existing', exact: true }).click()
      const drawer = page.locator('.list-drawer')
      await drawer.getByRole('textbox').first().fill(media[1].filename!)
      await expect(drawer.getByText(media[0].filename!, { exact: true })).toHaveCount(0)
      await drawer.getByText(media[1].filename!, { exact: true }).click()
      await expect(upload.getByText(media[1].filename!, { exact: true })).toBeVisible()
    }
    await expect(frame.getByRole('img', { name: media[1].alt, exact: true })).toHaveCount(3)
    for (const image of await frame.getByRole('img', { name: media[1].alt, exact: true }).all())
      await expect
        .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0)
    await page
      .locator('#layout-row-1')
      .getByRole('button', { name: 'More options', exact: true })
      .first()
      .click()
    await page.getByRole('button', { name: 'Move Up', exact: true }).click()
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Unsaved section 1')
    await page
      .locator('#layout-row-0')
      .getByRole('button', { name: 'More options', exact: true })
      .first()
      .click()
    await page.getByRole('button', { name: 'Move Down', exact: true }).click()
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Unsaved section 0')
    // Wrong origins, documents and senders must not trigger native population.
    await frame.locator('body').evaluate(
      (_, value) => {
        const message = { type: 'payload-live-preview', collectionSlug: 'pages', data: value }
        window.dispatchEvent(
          new MessageEvent('message', {
            data: message,
            origin: 'https://foreign.example',
            source: parent,
          }),
        )
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { ...message, data: { ...value, id: -1 } },
            origin: location.origin,
            source: parent,
          }),
        )
        window.dispatchEvent(
          new MessageEvent('message', { data: message, origin: location.origin, source: window }),
        )
      },
      { ...doc, layout: [{ blockType: 'hero', heading: 'Untrusted message' }] },
    )
    await page.waitForTimeout(200)
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Unsaved section 0')
    // Incomplete values must remain renderable; an invalid unsaved CTA is inert.
    await page.locator('#field-layout__5__href').fill('javascript:alert(1)')
    await expect(frame.locator('.cta-section a')).toHaveCount(0)
    await page.locator('#field-layout__1__body').fill('')
    await expect(frame.locator('.text-section p')).toHaveText('')
    await page.locator('#field-layout__1__body').fill('Unsaved text body')
    await page.locator('#field-layout__5__href').fill('/')
    await page.getByText('Page settings', { exact: true }).click()
    await expect(page.locator('#field-title')).toHaveValue(doc.title)
    await page.getByRole('button', { name: 'Unlock', exact: true }).click()
    await page.locator('#field-slug').fill(`unsaved-${doc.slug}`)
    await expect(page.locator('#live-preview-iframe')).toHaveAttribute(
      'src',
      `${origin}/preview/live/${doc.id}`,
    )
    await page.getByText('Content', { exact: true }).click()
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Unsaved section 0')
    await page.getByRole('button', { name: 'Responsive', exact: true }).click()
    await page.getByRole('button', { name: 'Mobile', exact: true }).click()
    await expect.poll(() => frame.locator('body').evaluate(() => innerWidth)).toBe(390)
    expect(
      await frame
        .locator('body')
        .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true)
    await page.screenshot({ path: 'test-results/page-management-mobile.png' })
    await page.getByRole('button', { name: 'Mobile', exact: true }).click()
    await page.getByRole('button', { name: 'Desktop', exact: true }).click()
    await expect.poll(() => frame.locator('body').evaluate(() => innerWidth)).toBe(1440)
    // Keep the canary's zoom at 100% so CSS viewport width stays 1440.
    await page.setViewportSize({ width: 1680, height: 1200 })
    await page
      .locator('.live-preview-toolbar')
      .getByRole('button', { name: 'Expand', exact: true })
      .click()
    const closeMenu = page.getByRole('button', { name: 'Close Menu', exact: true })
    if (await closeMenu.isVisible()) await closeMenu.click()
    await expect.poll(() => frame.locator('body').evaluate(() => innerWidth)).toBe(1440)
    await page.screenshot({ path: 'test-results/page-management-desktop.png' })
    await page
      .locator('.live-preview-toolbar')
      .getByRole('button', { name: 'Collapse', exact: true })
      .click()
    // Preview reads must not mutate stored pages or create versions.
    expect(await (await request.get(`/api/pages/${doc.id}?draft=true&depth=0`)).json()).toEqual(
      stored,
    )
    expect(
      (await (await request.get(`/api/pages/versions?where[parent][equals]=${doc.id}`)).json())
        .totalDocs,
    ).toBe(versions.totalDocs)
    await publicPage.goto(`${origin}/${doc.slug}`)
    await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText('Saved hero')
    await expect(publicPage.locator('img')).toHaveCount(0)
    await page.getByText('Page settings', { exact: true }).click()
    await page.getByRole('button', { name: 'Unlock', exact: true }).click()
    await page.locator('#field-slug').fill(doc.slug)
    const saved = page.waitForResponse(
      (r) => r.url().includes(`/api/pages/${doc.id}`) && r.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
    expect((await saved).ok()).toBe(true)
    await publicPage.reload()
    await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText('Saved hero')
    await page.reload()
    await page.getByText('Content', { exact: true }).click()
    await page
      .locator('#field-layout')
      .getByRole('button', { name: 'Show All', exact: true })
      .first()
      .click()
    await expect(page.locator('#field-layout__0__heading')).toHaveValue('Unsaved section 0')
    const published = page.waitForResponse(
      (r) => r.url().includes(`/api/pages/${doc.id}`) && r.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: /Publish changes/ }).click()
    expect((await published).ok()).toBe(true)
    await publicPage.reload()
    await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText('Unsaved section 0')
    expect(errors).toEqual([])
  } finally {
    await publicContext.close()
    await cleanup()
  }
})

test('preview population is authenticated, same-origin and read-only, including incomplete blocks', async ({
  request,
  playwright,
}) => {
  const { doc, media, cleanup } = await fixture(request)
  const anonymous = await playwright.request.newContext({ baseURL: origin })
  try {
    const url = `/preview/live/${doc.id}/populate`
    expect((await anonymous.get(`/preview/live/${doc.id}`)).status()).toBe(404)
    expect((await anonymous.post(url, { headers: { origin }, data: { data: doc } })).status()).toBe(
      401,
    )
    expect(
      (
        await request.post(url, {
          headers: { origin: 'https://foreign.example' },
          data: { data: doc },
        })
      ).status(),
    ).toBe(403)
    expect((await request.post(url, { data: { data: doc } })).status()).toBe(403)
    const changed = {
      ...doc,
      title: 'Not saved',
      layout: [
        { blockType: 'hero', heading: 'Unsaved image', image: media[1].id },
        { blockType: 'text' },
        { blockType: 'gallery', images: [] },
        { blockType: 'imageText' },
        { blockType: 'services', items: [] },
        { blockType: 'callToAction' },
      ],
    }
    const response = await request.post(url, {
      headers: { origin },
      data: { data: changed, depth: 99 },
    })
    expect(response.ok()).toBe(true)
    expect(response.headers()['cache-control']).toContain('no-store')
    const preview = await response.json()
    expect(preview.title).toBe('Not saved')
    expect(preview.layout[0].image.id).toBe(media[1].id)
    const saved = await (await request.get(`/api/pages/${doc.id}?draft=true`)).json()
    expect(saved.title).toBe(doc.title)
    expect(saved.layout[0].heading).toBe('Saved hero')
    for (const image of media) {
      expect([401, 403, 404]).toContain((await anonymous.get(image.url!)).status())
    }
  } finally {
    await anonymous.dispose()
    await cleanup()
  }
})

test('new pages explain the first save; media lists expose thumbnails, filename, alt and visibility', async ({
  page,
  request,
}) => {
  const { media, cleanup } = await fixture(request)
  try {
    await page.context().addCookies((await request.storageState()).cookies)
    await page.goto('/admin/collections/pages/create')
    await expect(page.getByText(/Save a first draft to enable Live Preview/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Live Preview', exact: true })).toHaveCount(0)
    await page.getByText('Page settings', { exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#field-title')).toBeVisible()
    await expect(page.locator('#field-slug')).toBeVisible()
    await expect(page.locator('#field-description')).toBeVisible()
    await page.goto('/admin/collections/media')
    await expect(
      page.getByText(/Search by filename or alt text; filter by visibility/),
    ).toBeVisible()
    await page.getByRole('textbox').first().fill(media[1].filename!)
    await expect(page.getByRole('row').filter({ hasText: media[0].filename! })).toHaveCount(0)
    const row = page.getByRole('row').filter({ hasText: media[1].filename! })
    await expect(row).toHaveCount(1)
    await expect(row.getByText(media[1].alt, { exact: true })).toBeVisible()
    await expect(row.getByText('private', { exact: true })).toBeVisible()
    await expect(row.locator('img')).toHaveCount(1)
    await page.screenshot({ path: 'test-results/page-management-media.png', fullPage: true })
  } finally {
    await cleanup()
  }
})

test('an expired editor session cannot populate a published page preview', async ({
  page,
  request,
}) => {
  const { doc, cleanup } = await fixture(request)
  try {
    await page.context().addCookies((await request.storageState()).cookies)
    await page.goto(`/admin/collections/pages/${doc.id}`)
    const frame = await openPreview(page)
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Saved hero')
    await page.context().clearCookies({ name: 'payload-token' })
    const denied = page.waitForResponse((r) => r.url().endsWith(`/preview/live/${doc.id}/populate`))
    await frame.locator('body').evaluate(
      (_, data) => {
        window.dispatchEvent(
          new MessageEvent('message', {
            origin: location.origin,
            source: parent,
            data: { type: 'payload-live-preview', collectionSlug: 'pages', data },
          }),
        )
      },
      { ...doc, layout: [{ blockType: 'hero', heading: 'Expired session change' }] },
    )
    expect((await denied).status()).toBe(401)
    await expect(
      frame.getByRole('alert').filter({ hasText: 'Live preview is unavailable' }),
    ).toBeVisible()
    await expect(frame.getByRole('heading')).toHaveCount(0)
  } finally {
    await cleanup()
  }
})

test('overlapping preview reads retain the latest edit and incomplete blocks stay renderable', async ({
  page,
  request,
}) => {
  const { doc, cleanup } = await fixture(request)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.context().addCookies((await request.storageState()).cookies)
    await page.goto(`/admin/collections/pages/${doc.id}`)
    const frame = await openPreview(page)
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Saved hero')
    const post = (data: unknown) =>
      page.locator('#live-preview-iframe').evaluate((element, value) => {
        ;(element as HTMLIFrameElement).contentWindow!.postMessage(
          {
            type: 'payload-live-preview',
            collectionSlug: 'pages',
            data: value,
          },
          location.origin,
        )
      }, data)
    let signalOlder!: () => void
    const olderStarted = new Promise<void>((resolve) => {
      signalOlder = resolve
    })
    await page.route(`**/preview/live/${doc.id}/populate`, async (route) => {
      if (route.request().postDataJSON().data.layout[0]?.heading === 'Older delayed edit') {
        const response = await route.fetch()
        signalOlder()
        await new Promise((resolve) => setTimeout(resolve, 300))
        await route.fulfill({ response })
      } else await route.continue()
    })
    await post({ ...doc, layout: [{ blockType: 'hero', heading: 'Older delayed edit' }] })
    await olderStarted
    await post({ ...doc, layout: [{ blockType: 'hero', heading: 'Newest edit' }] })
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Newest edit')
    await page.waitForTimeout(400)
    await expect(frame.getByRole('heading', { level: 1 })).toHaveText('Newest edit')
    await page.unroute(`**/preview/live/${doc.id}/populate`)
    await post({
      ...doc,
      layout: ['hero', 'text', 'gallery', 'imageText', 'services', 'callToAction'].map(
        (blockType) => ({ blockType }),
      ),
    })
    await expect(frame.locator('main section')).toHaveCount(6)
    await post({ ...doc, layout: [] })
    await expect(frame.locator('main section')).toHaveCount(0)
    expect(errors).toEqual([])
    // A different document gets its own authenticated frame and initial data.
    await page.goto('/admin/collections/pages/1')
    const next = await openPreview(page)
    await expect(page.locator('#live-preview-iframe')).toHaveAttribute(
      'src',
      `${origin}/preview/live/1`,
    )
    await expect(next.getByRole('heading', { level: 1 })).not.toHaveText('Newest edit')
  } finally {
    await cleanup()
  }
})
