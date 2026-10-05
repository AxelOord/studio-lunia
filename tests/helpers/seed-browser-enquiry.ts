import { localTestDatabaseURL } from './database'
import { syntheticEnvironment } from './environment'

// Admin journeys need owned enquiries, not a shared public submission rate bucket.
// The public HTTP validation/rate-limit contract is exercised in inquiry.spec.ts.
const database = localTestDatabaseURL(process.env)
if (!/^\/lunia_test_[a-f0-9]{32}$/.test(database.pathname))
  throw new Error('Browser fixtures require the runner-owned random test database.')
Object.assign(process.env, syntheticEnvironment(process.env, database.href))
const input = JSON.parse(process.argv[2] || '{}') as Record<string, unknown>
if (
  typeof input.email !== 'string' ||
  !input.email.endsWith('@example.test') ||
  typeof input.name !== 'string' ||
  !input.name.startsWith('Synthetic')
)
  throw new Error('Browser fixtures accept synthetic test identities only.')
const { BasePayload } = await import('payload')
const { default: config } = await import('../../src/payload.config')
const { submitInquiry } = await import('../../src/inquiries/submit')
const { relationID } = await import('../../src/customer-records/core')
const resolved = await config
resolved.logger = { options: { level: 'error' } }
resolved.typescript.autoGenerate = false
const payload = new BasePayload()
await payload.init({ config: Promise.resolve(resolved) })
try {
  const result = await submitInquiry(payload, input, {
    analytics: false,
    campaigns: false,
    decided: false,
  })
  if (!result.doc) throw new Error('Synthetic enquiry fixture failed validation.')
  console.log(JSON.stringify({ id: result.doc.id, contact: relationID(result.doc.contact) }))
} finally {
  const pool = payload.db.pool
  try {
    await payload.destroy()
  } finally {
    await pool.end()
  }
}
