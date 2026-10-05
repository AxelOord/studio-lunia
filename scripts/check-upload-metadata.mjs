import 'dotenv/config'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

assert.ok(!process.env.VERCEL, 'This check is local/CI only.')
assert.ok(['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname))
const origin = 'http://127.0.0.1:3002'
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-p', '3002', '--hostname', '127.0.0.1'],
  {
    env: {
      ...process.env,
      LUNIA_SHOWCASE: 'false',
      LUNIA_CMS_PREVIEW: 'false',
      LUNIA_STORAGE: 'private-blob',
      BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_syntheticstore_syntheticlocaltestonly',
    },
    stdio: 'ignore',
  },
)
let browser
try {
  let ready = false
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Upload test server exited.')
    try {
      if ((await fetch(`${origin}/admin/login`, { signal: AbortSignal.timeout(2000) })).ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.ok(ready, 'Upload test server did not become ready.')
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  })
  const context = await browser.newContext({ baseURL: origin })
  assert.equal(
    (
      await context.request.post('/api/users/login', {
        data: { email: process.env.SEED_EMAIL, password: process.env.SEED_PASSWORD },
      })
    ).status(),
    200,
  )
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  // Exercise the real file picker and instruction API, but never contact Blob with
  // synthetic credentials. Provider delivery is a separate hosted acceptance check.
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  )
  const bytes = await sharp({
    create: { width: 240, height: 160, channels: 3, background: '#65745a' },
  })
    .png()
    .toBuffer()
  assert.ok(bytes.length > 0 && bytes.length < 2048)
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
  assert.equal(metadata.filesize, bytes.length)
  assert.equal(metadata.mimeType, 'image/png')
  const response = await responded
  assert.equal(response.status(), 200)
  const grant = await response.json()
  assert.equal(grant.file.size, bytes.length)
  // Do not log grants: their provider tokens are credentials, even in tests.
  const empty = await context.request.post('/api/upload-instructions', {
    data: { collectionSlug: 'media', filename: 'empty.png', filesize: 0, mimeType: 'image/png' },
  })
  assert.equal(empty.status(), 400)
  assert.match((await empty.json()).errors[0].message, /selected file is empty/)
  console.log(
    'Private-upload browser metadata: tiny PNG keeps exact positive byte count; instructions succeed; empty file gets actionable rejection. Provider boundary blocked.',
  )
} finally {
  await browser?.close()
  if (server.exitCode === null) {
    const exited = once(server, 'exit')
    server.kill('SIGTERM')
    const forceStop = setTimeout(() => server.kill('SIGKILL'), 2000)
    await exited
    clearTimeout(forceStop)
  }
}
