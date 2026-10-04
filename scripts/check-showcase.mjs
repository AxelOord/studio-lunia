import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

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
  console.log(
    'Showcase: home 200/noindex; CMS, API and draft preview 503; no database/secrets required.',
  )
} finally {
  server.kill('SIGTERM')
  await once(server, 'exit')
}
