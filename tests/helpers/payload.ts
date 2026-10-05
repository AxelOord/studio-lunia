import path from 'node:path'
import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { BasePayload, type Payload, type SanitizedConfig } from 'payload'
import { postgresAdapter, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'
import { migrations as committedMigrations } from '../../src/migrations'
import { createTestDatabase } from './database'

// Import the committed migration index through Vitest's TypeScript loader. The
// Payload CLI and hosted build still exercise filesystem migration discovery.
export const testMigrations = committedMigrations.map((migration) => ({
  ...migration,
  up: (args: unknown) => migration.up(args as MigrateUpArgs),
  down: (args: unknown) => migration.down(args as MigrateDownArgs),
}))

type ConfigFactory = (url: string, mediaDirectory: string) => Promise<SanitizedConfig>

export async function applicationConfig(url: string, mediaDirectory: string) {
  const { default: config } = await import('../../src/payload.config')
  const base = await config
  return {
    ...base,
    db: postgresAdapter({
      pool: { connectionString: url, max: 5 },
      push: false,
      migrationDir: path.resolve('src/migrations'),
    }),
    collections: base.collections.map((collection) =>
      collection.slug === 'media'
        ? { ...collection, upload: { ...collection.upload, staticDir: mediaDirectory } }
        : collection,
    ),
  }
}

export async function createTestCMS(
  configFactory: ConfigFactory = applicationConfig,
  { migrate = true }: { migrate?: boolean } = {},
) {
  const database = await createTestDatabase()
  const previousURL = process.env.DATABASE_URL
  process.env.DATABASE_URL = database.url
  let directory: string | undefined
  let payload: Payload | undefined
  let closed = false
  async function close() {
    if (closed) return
    closed = true
    try {
      if (payload) {
        const pool = payload.db?.pool
        try {
          await payload.destroy()
        } finally {
          await pool?.end()
        }
      }
    } finally {
      try {
        await database.close()
      } finally {
        try {
          if (directory) await rm(directory, { recursive: true, force: true })
        } finally {
          if (previousURL === undefined) delete process.env.DATABASE_URL
          else process.env.DATABASE_URL = previousURL
        }
      }
    }
  }
  try {
    directory = await mkdtemp(path.join(tmpdir(), 'lunia-test-media-'))
    const config = await configFactory(database.url, directory)
    config.logger = { options: { level: 'error' } }
    // Own the uncached instance before init: a failed hook can already have opened a pool.
    payload = new BasePayload()
    await payload.init({ config: Promise.resolve(config) })
    if (migrate) await payload.db.migrate({ shouldPrompt: false, migrations: testMigrations })
    const ownedPayload = payload
    const mediaDirectory = directory
    return {
      payload: ownedPayload,
      database,
      mediaDirectory,
      close,
      async reset() {
        // This connection belongs to this suite's randomly created database only.
        const tables = await ownedPayload.db.pool.query<{ tablename: string }>(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'payload_migrations'",
        )
        const names = tables.rows.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
        if (names.length)
          await ownedPayload.db.pool.query(`TRUNCATE ${names.join(', ')} RESTART IDENTITY CASCADE`)
        await rm(mediaDirectory, { recursive: true, force: true })
        await mkdir(mediaDirectory)
      },
    }
  } catch (error) {
    await close()
    throw error
  }
}

export async function createEditor(payload: Payload) {
  const editor = await payload.create({
    collection: 'users',
    overrideAccess: true,
    context: { bootstrap: true },
    data: { email: 'editor@example.test', password: 'synthetic-test-editor-password' },
  })
  return { ...editor, collection: 'users' as const }
}
