import sharp from 'sharp'
import { test, expect } from '@playwright/test'

test('public page works at desktop and mobile sizes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A little space.')
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true })
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.getByRole('heading', { level: 1 }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
test('anonymous preview and CMS writes are rejected', async ({ request }) => {
  expect((await request.get('/preview?slug=home')).status()).toBe(401)
  expect((await request.get('/preview?slug=//evil.test')).status()).toBe(400)
  const users = await request.get('/api/users')
  expect([401, 403]).toContain(users.status())
  const create = await request.post('/api/pages', { data: { title: 'Unauthorized' } })
  expect([401, 403]).toContain(create.status())
})
test('editor can log in, view admin and preview a private draft', async ({ page, request }) => {
  const response = await request.post('/api/users/login', {
    data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
  })
  expect(response.ok()).toBe(true)
  const upload = await request.post('/api/media', {
    multipart: {
      _payload: JSON.stringify({ alt: 'Private draft photograph', visibility: 'private' }),
      file: {
        name: `draft-${Date.now()}.png`,
        mimeType: 'image/png',
        buffer: await sharp({
          create: { width: 1800, height: 1200, channels: 3, background: '#65745a' },
        })
          .png()
          .toBuffer(),
      },
    },
  })
  expect(upload.ok()).toBe(true)
  const { doc: media } = await upload.json()
  const slug = `preview-${Date.now()}`
  const created = await request.post('/api/pages', {
    data: {
      title: 'Synthetic draft',
      slug,
      description: 'Preview test',
      layout: [
        { blockType: 'hero', heading: 'Private preview heading', image: media.id },
        { blockType: 'gallery', heading: 'Private gallery', images: [{ image: media.id }] },
      ],
      _status: 'draft',
    },
  })
  expect(created.ok()).toBe(true)
  const { doc } = await created.json()
  try {
    await page.context().addCookies((await request.storageState()).cookies)
    await page.goto('/admin')
    await expect(page.getByText('Pages', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: 'test-results/admin.png', fullPage: true })
    const anonymous = await page.request.get(`/${slug}`)
    expect(anonymous.status()).toBe(404)
    const preview = await page.goto(`/preview?slug=${slug}`)
    expect(preview!.headers()['cache-control']).toContain('no-store')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private preview heading')
    const photographs = page.getByRole('img', { name: 'Private draft photograph' })
    await expect(photographs).toHaveCount(2)
    for (const photograph of await photographs.all()) {
      await expect(photograph).toBeVisible()
      await expect
        .poll(() => photograph.evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0)
      const imageResponse = await page.request.get((await photograph.getAttribute('src'))!)
      expect(imageResponse.ok()).toBe(true)
      expect(imageResponse.headers()['cache-control']).toContain('no-store')
    }
    await page.screenshot({ path: 'test-results/draft-preview.png', fullPage: true })
    // Preserve the draft cookie but remove editor auth: draft mode alone must grant nothing.
    await page.context().clearCookies({ name: 'payload-token' })
    await page.goto(`/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Private preview heading')
    await expect(photographs).toHaveCount(0)
    for (const url of [media.url, media.sizes.card.url, media.sizes.hero.url]) {
      const path = new URL(url, 'http://127.0.0.1:3000').pathname
      expect([401, 403, 404]).toContain((await page.request.get(path)).status())
      expect(
        (await page.request.get(`/_next/image?url=${encodeURIComponent(path)}&w=640&q=75`)).ok(),
      ).toBe(false)
    }
    await page.context().clearCookies()
    // A published page does not implicitly publish its private media.
    expect(
      (await request.patch(`/api/pages/${doc.id}`, { data: { _status: 'published' } })).ok(),
    ).toBe(true)
    await page.goto(`/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Private preview heading')
    await expect(photographs).toHaveCount(0)
    expect(await page.content()).not.toContain(media.filename)
  } finally {
    await request.delete(`/api/pages/${doc.id}`)
    await request.delete(`/api/media/${media.id}`)
  }
})

test('private upload URLs are protected and public derivatives render', async ({ request }) => {
  const login = await request.post('/api/users/login', {
    data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
  })
  expect(login.ok()).toBe(true)
  const image = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: '#65745a' },
  })
    .png()
    .toBuffer()
  const result = await request.post('/api/media', {
    multipart: {
      _payload: JSON.stringify({ alt: 'Synthetic access test', visibility: 'private' }),
      file: { name: `browser-${Date.now()}.png`, mimeType: 'image/png', buffer: image },
    },
  })
  expect(result.ok()).toBe(true)
  const { doc } = await result.json()
  const anonymous = await (
    await import('@playwright/test')
  ).request.newContext({ baseURL: 'http://127.0.0.1:3000' })
  try {
    const privateFile = await anonymous.get(new URL(doc.url, 'http://127.0.0.1:3000').pathname)
    expect([401, 403, 404]).toContain(privateFile.status())
    const publish = await request.patch(`/api/media/${doc.id}`, { data: { visibility: 'public' } })
    expect(publish.ok()).toBe(true)
    const publicFile = await anonymous.get(
      new URL(doc.sizes.card.url, 'http://127.0.0.1:3000').pathname,
    )
    expect(publicFile.ok()).toBe(true)
    expect(publicFile.headers()['content-type']).toContain('image/')
    expect(publicFile.headers()['cache-control']).toContain('no-store')
    const path = new URL(doc.sizes.card.url, 'http://127.0.0.1:3000').pathname
    expect(
      (await anonymous.get(`/_next/image?url=${encodeURIComponent(path)}&w=640&q=75`)).ok(),
    ).toBe(false)
    expect(
      (await request.patch(`/api/media/${doc.id}`, { data: { visibility: 'private' } })).ok(),
    ).toBe(true)
    expect([401, 403, 404]).toContain((await anonymous.get(path)).status())
  } finally {
    await request.delete(`/api/media/${doc.id}`)
    await anonymous.dispose()
  }
})
