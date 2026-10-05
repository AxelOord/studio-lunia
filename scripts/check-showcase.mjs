import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-p', '3001', '--hostname', '127.0.0.1'],
  {
    env: {
      ...process.env,
      LUNIA_SHOWCASE: 'true',
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      DATABASE_URL: '',
      PAYLOAD_SECRET: '',
      BLOB_READ_WRITE_TOKEN: '',
      RESEND_API_KEY: '',
      LUNIA_CMS_PREVIEW: '',
    },
    stdio: 'ignore',
  },
)
try {
  let ready = false
  for (let i = 0; i < 60; i++) {
    try {
      const result = await fetch('http://127.0.0.1:3001')
      if (result.ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.ok(ready, 'Showcase must start without CMS credentials or database')
  const home = await fetch('http://127.0.0.1:3001')
  assert.match(await home.text(), /A little space/)
  assert.match(home.headers.get('x-robots-tag'), /noindex/)
  for (const route of ['/admin', '/api/pages', '/api/media', '/preview?slug=home']) {
    assert.equal((await fetch(`http://127.0.0.1:3001${route}`)).status, 503, route)
  }
  assert.equal((await fetch('http://127.0.0.1:3001/missing-sample')).status, 404)
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:3001')
    await page
      .getByText('Read-only synthetic preview · CMS editing and booking are unavailable.', {
        exact: true,
      })
      .waitFor()
    assert.equal(await page.locator('main > section').count(), 6)
    assert.equal(await page.locator('h1').count(), 1)
    const images = page.locator('main img')
    assert.equal(await images.count(), 4)
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded()
      await image.evaluate((img) => img.decode())
      assert.ok(await image.evaluate((img) => img.naturalWidth > 0))
    }
    await mkdir('test-results', { recursive: true })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.screenshot({ path: `test-results/showcase-${width}.png`, fullPage: true })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    }
    await page.getByRole('link', { name: 'View the block sample', exact: true }).click()
    await page.getByRole('heading', { level: 1, name: 'Reusable page blocks.' }).waitFor()
    await page.getByRole('link', { name: 'Back to the sample home', exact: true }).click()
    assert.equal(new URL(page.url()).pathname, '/')
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
  console.log(
    'Showcase: six blocks with loaded images, sample navigation and responsive screenshots; CMS/API/drafts 503; no CMS credentials required.',
  )
} finally {
  server.kill('SIGTERM')
  await once(server, 'exit')
}
