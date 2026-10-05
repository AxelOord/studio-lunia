import 'dotenv/config'
import { Client } from 'pg'
import { spawn } from 'node:child_process'
import { deploymentMode } from '../src/hosting/environment'
import { initializePreview } from './prepare-preview'

let phase = 'configuration'

async function prepare() {
  if (deploymentMode(process.env) !== 'preview')
    throw new Error('Vercel builds require the approved full CMS preview configuration.')
  const direct = process.env.DATABASE_URL_UNPOOLED
  if (!direct) throw new Error('Native Neon direct migration connection is missing.')
  const runtime = new URL(process.env.DATABASE_URL!)
  const migration = new URL(direct)
  if (
    !['postgres:', 'postgresql:'].includes(migration.protocol) ||
    !['require', 'verify-full'].includes(migration.searchParams.get('sslmode') || '') ||
    migration.hostname !== runtime.hostname.replace('-pooler.', '.') ||
    migration.pathname !== runtime.pathname ||
    migration.username !== runtime.username
  )
    throw new Error(
      'Migration and runtime connections must target the same native preview database.',
    )
  const lock = new Client({ connectionString: direct, connectionTimeoutMillis: 15000 })
  let payload: import('payload').Payload | undefined
  try {
    phase = 'database connection and migration lock'
    await lock.connect()
    await lock.query("SET lock_timeout = '120s'")
    await lock.query('SELECT pg_advisory_lock(721904002)')
    // Config is loaded after replacing the pooled URL, so migration transactions and
    // bootstrap use the direct connection. The later build/runtime retain pooled env.
    const pooled = process.env.DATABASE_URL
    process.env.DATABASE_URL = direct
    try {
      const { getPayload } = await import('payload')
      const { default: config } = await import('../src/payload.config')
      const resolved = await config
      // Database errors may contain query parameters. The build reports only its phase.
      resolved.logger = { options: { level: 'silent' } }
      payload = await getPayload({ config: Promise.resolve(resolved) })
      phase = 'migrations'
      const result = await payload.db.migrate({ shouldPrompt: false })
      if (result?.cancelled) throw new Error('Migration requires manual review.')
      console.log('Preview migrations complete.')
      phase = 'editor/content bootstrap and private storage'
      await initializePreview(payload, process.env.PREVIEW_EDITOR_EMAIL!)
      console.log('Preview content ready; existing editor changes preserved.')
    } finally {
      process.env.DATABASE_URL = pooled
    }
  } finally {
    // Canary drizzle destroy resets metadata but does not close pg.Pool.
    try {
      if (payload) {
        const pool = payload.db.pool
        try {
          await payload.destroy()
        } finally {
          await pool?.end()
        }
      }
    } finally {
      // Closing the session releases the lock even if Payload cleanup fails.
      await lock.end()
    }
  }
}

try {
  await prepare()
  phase = 'application build'
  const child = spawn('node_modules/.bin/payload', ['build'], {
    stdio: 'inherit',
    env: process.env,
  })
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 1))
  })
} catch {
  console.error(
    `Full CMS preview preparation failed (${phase}). Check preview configuration, native database target, migrations and private storage. No showcase fallback was deployed.`,
  )
  process.exitCode = 1
}
