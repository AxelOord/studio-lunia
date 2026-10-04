import 'dotenv/config'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { getPayload, type Payload } from 'payload'
import { Client } from 'pg'
import config from '../../src/payload.config'
import { limitOperation } from '../../src/hosting/rate-limit'
let payload: Payload
const sent: { html: string }[] = []
let userID: number
const email = `recovery-${Date.now()}@example.test`
before(async () => {
  const resolved = await config
  resolved.email = () => ({
    name: 'in-memory-test',
    defaultFromAddress: 'test@example.test',
    defaultFromName: 'Test',
    sendEmail: async (message) => {
      sent.push({ html: String(message.html) })
      return {}
    },
  })
  payload = await getPayload({ config: Promise.resolve(resolved) })
  const user = await payload.create({
    collection: 'users',
    overrideAccess: true,
    context: { bootstrap: true },
    data: { email, password: 'synthetic-initial-password-only' },
  })
  userID = user.id
})
after(async () => {
  if (userID) await payload.delete({ collection: 'users', id: userID, overrideAccess: true })
  await payload.destroy()
})
test('recovery sends a fixed-origin link, throttles email and rejects reused/expired tokens', async () => {
  await payload.forgotPassword({ collection: 'users', data: { email } })
  assert.equal(sent.length, 1)
  const token = sent[0].html.match(/\/admin\/reset\/([a-z0-9]+)/)?.[1]
  assert.ok(token)
  assert.ok(sent[0].html.includes('http://localhost:3000/admin/reset/'))
  await payload.forgotPassword({ collection: 'users', data: { email } })
  assert.equal(sent.length, 1)
  await payload.forgotPassword({ collection: 'users', data: { email: 'missing@example.test' } })
  assert.equal(sent.length, 1)
  await assert.rejects(
    payload.resetPassword({
      collection: 'users',
      overrideAccess: false,
      data: { token, password: 'short' },
    }),
  )
  const password = 'synthetic-replacement-password-only'
  await payload.resetPassword({
    collection: 'users',
    overrideAccess: false,
    data: { token, password },
  })
  await assert.rejects(
    payload.resetPassword({
      collection: 'users',
      overrideAccess: false,
      data: { token, password },
    }),
  )
  assert.ok((await payload.login({ collection: 'users', data: { email, password } })).user)
  const expiredToken = 'synthetic-expired-token'
  await payload.update({
    collection: 'users',
    id: userID,
    overrideAccess: true,
    data: { resetPasswordToken: expiredToken, resetPasswordExpiration: new Date(0).toISOString() },
  })
  await assert.rejects(
    payload.resetPassword({
      collection: 'users',
      overrideAccess: false,
      data: { token: expiredToken, password },
    }),
  )
})
test('database throttling is atomic across concurrent requests and expires', async () => {
  const identity = `synthetic-${Date.now()}`
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => limitOperation('test', identity, 3)),
  )
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 3)
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query("UPDATE lunia_rate_limits SET expires_at = now() - interval '1 minute'")
    await limitOperation('test', identity, 3)
  } finally {
    await client.end()
  }
})
