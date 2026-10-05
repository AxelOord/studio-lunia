import 'dotenv/config'
import { Client } from 'pg'
import { spawn } from 'node:child_process'

// Operator-only CLI; never imported into HTTP routes or run by the Vercel build.
const command = process.argv[2]
if (!['migrate', 'bootstrap'].includes(command))
  throw new Error('Use preview-operator migrate|bootstrap.')
let url: URL
try {
  url = new URL(process.env.DATABASE_URL || '')
} catch {
  throw new Error('Invalid database configuration.')
}
if (process.env.LUNIA_OPERATOR_TARGET !== `${url.hostname}${url.pathname}`)
  throw new Error('Confirm the database host/name with LUNIA_OPERATOR_TARGET.')
if (process.env.LUNIA_SHOWCASE === 'true' || process.env.VERCEL_ENV === 'production')
  throw new Error('This is not an operator preview environment.')
const client = new Client({ connectionString: process.env.DATABASE_URL })
let locked = false
try {
  await client.connect()
  const lock = await client.query('SELECT pg_try_advisory_lock(721904002) AS acquired')
  locked = lock.rows[0].acquired === true
  if (!locked) throw new Error('Another preview operator is running.')
  if (command === 'migrate') {
    if (!process.env.LUNIA_BACKUP_REFERENCE)
      throw new Error('Record a verified pre-migration backup reference first.')
    await new Promise<void>((resolve, reject) => {
      const child = spawn('node_modules/.bin/payload', ['migrate'], {
        stdio: 'inherit',
        env: process.env,
      })
      child.on('error', () => reject(new Error('Migration process failed to start.')))
      child.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error('Migration failed; keep hosted CMS disabled.')),
      )
    })
  } else {
    // JSON via stdin from an approved secret manager; never password arguments or logs.
    let input = ''
    for await (const chunk of process.stdin) {
      input += chunk
      if (input.length > 4096) throw new Error('Bootstrap input exceeds limit.')
    }
    const data = JSON.parse(input) as { email?: string; password?: string }
    if (
      !data.email ||
      data.email.toLowerCase() !== process.env.PREVIEW_EDITOR_EMAIL?.toLowerCase() ||
      !data.password ||
      data.password.length < 16
    )
      throw new Error('Provide the approved editor and a 16+ character password through stdin.')
    const { getPayload } = await import('payload')
    const { default: config } = await import('../src/payload.config')
    const payload = await getPayload({ config })
    try {
      const existing = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
      if (existing.totalDocs)
        throw new Error('An editor already exists; bootstrap will not replace or add credentials.')
      await payload.create({
        collection: 'users',
        overrideAccess: true,
        context: { bootstrap: true },
        data: { email: data.email, password: data.password },
      })
      console.log(
        'Approved preview editor created. Remove bootstrap inputs from the operator session.',
      )
    } finally {
      await payload.destroy()
    }
  }
} catch {
  // Never dump database URLs, SMTP errors or bootstrap input to logs.
  console.error(
    'Preview operation failed. Check target, lock, backup, migrations and bootstrap prerequisites. No credentials were logged.',
  )
  process.exitCode = 1
} finally {
  try {
    if (locked) await client.query('SELECT pg_advisory_unlock(721904002)')
  } catch {
    console.error('Operator lock cleanup failed; provider details withheld.')
    process.exitCode = 1
  }
  try {
    await client.end()
  } catch {
    console.error('Operator connection cleanup failed; provider details withheld.')
    process.exitCode = 1
  }
}
