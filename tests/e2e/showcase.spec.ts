import { test, expect } from '@playwright/test'

test('credential-free showcase renders responsive sample blocks while CMS and draft routes stay disabled', async ({
  page,
  request,
}) => {
  const home = await request.get('/')
  expect(home.ok()).toBe(true)
  expect(home.headers()['x-robots-tag']).toContain('noindex')
  for (const route of ['/admin', '/api/pages', '/api/media', '/preview?slug=home'])
    expect((await request.get(route)).status(), route).toBe(503)
  expect((await request.get('/missing-sample')).status()).toBe(404)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(
    page.getByText('Read-only synthetic preview · CMS editing and booking are unavailable.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(page.locator('main > section')).toHaveCount(6)
  await expect(page.locator('h1')).toHaveCount(1)
  const images = page.locator('main img')
  await expect(images).toHaveCount(4)
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({ path: `test-results/showcase-${width}.png`, fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.getByRole('link', { name: 'View the block sample', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Reusable page blocks.' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to the sample home', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(errors).toEqual([])
})
