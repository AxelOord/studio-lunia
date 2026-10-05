import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

export function localTestDatabaseURL(env: Record<string, string | undefined>) {
  if (env.VERCEL || env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production')
    throw new Error('Database tests are local/CI only.')
  let url: URL
  try {
    url = new URL(env.TEST_DATABASE_URL || env.DATABASE_URL || '')
  } catch {
    throw new Error('Set TEST_DATABASE_URL to the local PostgreSQL test server.')
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
    throw new Error(
      'Database tests require a loopback PostgreSQL server; hosted targets are refused.',
    )
  // Parameters such as host/hostaddr could otherwise override the parsed hostname.
  if ([...url.searchParams.keys()].some((key) => !['sslmode'].includes(key)))
    throw new Error('Unexpected connection parameter in the local test database URL.')
  return url
}

export async function createTestDatabase() {
  const source = localTestDatabaseURL(process.env)
  const name = `lunia_test_${randomUUID().replaceAll('-', '')}`
  const adminURL = new URL(source)
  adminURL.pathname = '/postgres'
  const admin = new Client({ connectionString: adminURL.href, connectionTimeoutMillis: 5000 })
  let created = false
  try {
    await admin.connect()
    await admin.query(`CREATE DATABASE "${name}"`)
    created = true
  } finally {
    await admin.end()
  }
  source.pathname = `/${name}`
  return {
    name,
    url: source.href,
    async close() {
      if (!created) return
      const cleanup = new Client({ connectionString: adminURL.href, connectionTimeoutMillis: 5000 })
      try {
        await cleanup.connect()
        // Only the random database created by this closure can ever be removed.
        await cleanup.query(`DROP DATABASE "${name}"`)
        created = false
      } finally {
        await cleanup.end()
      }
    },
  }
}
