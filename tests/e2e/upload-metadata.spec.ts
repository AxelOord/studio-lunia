import { test, expect } from '@playwright/test'
import sharp from 'sharp'

test('private upload file picker preserves exact bytes and rejects empty files without contacting the provider', async ({
  page,
  request,
  baseURL,
}) => {
  expect(
    (
      await request.post('/api/users/login', {
        data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
      })
    ).status(),
  ).toBe(200)
  await page.context().addCookies((await request.storageState()).cookies)
  // Real file picker and instruction API; synthetic provider credentials never leave the browser.
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort(),
  )
  const bytes = await sharp({
    create: { width: 240, height: 160, channels: 3, background: '#65745a' },
  })
    .png()
    .toBuffer()
  expect(bytes.length).toBeGreaterThan(0)
  expect(bytes.length).toBeLessThan(2048)
  await page.goto('/admin/collections/media/create')
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'synthetic-metadata.png', mimeType: 'image/png', buffer: bytes })
  await page.locator('#field-alt').fill('Synthetic upload metadata test')
  const requested = page.waitForRequest((r) => r.url().endsWith('/api/upload-instructions'))
  const responded = page.waitForResponse((r) => r.url().endsWith('/api/upload-instructions'))
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const metadata = (await requested).postDataJSON()
  expect(metadata.filesize).toBe(bytes.length)
  expect(metadata.mimeType).toBe('image/png')
  const response = await responded
  expect(response.status()).toBe(200)
  const grant = await response.json()
  expect(grant.file.size).toBe(bytes.length)
  // Never print grants or tokens, including synthetic grants.
  const empty = await request.post('/api/upload-instructions', {
    data: { collectionSlug: 'media', filename: 'empty.png', filesize: 0, mimeType: 'image/png' },
  })
  expect(empty.status()).toBe(400)
  expect((await empty.json()).errors[0].message).toMatch(/selected file is empty/)
})
