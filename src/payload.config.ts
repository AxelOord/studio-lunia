import 'dotenv/config'
import { postgresAdapter } from '@payloadcms/db-postgres'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const showcase = process.env.LUNIA_SHOWCASE === 'true'
if (!showcase && (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.length < 32)) {
  throw new Error('Set PAYLOAD_SECRET to a random value of at least 32 characters.')
}
if (!showcase && !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for CMS mode.')
if (process.env.VERCEL_ENV === 'production')
  throw new Error('Production deployment is not configured or authorized.')
if (process.env.VERCEL && !showcase)
  throw new Error('Hosted CMS requires a reviewed durable media adapter before enabling it.')

export default buildConfig({
  admin: {
    user: Users.slug,
    avatar: 'default',
    importMap: { baseDir: dirname },
    meta: { titleSuffix: '— Studio Lunia' },
  },
  collections: [Users, Media, Pages],
  secret: process.env.PAYLOAD_SECRET || 'showcase-only-cms-routes-are-disabled-0000',
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || 'postgresql://unused:unused@127.0.0.1:1/unused',
    },
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  sharp,
  graphQL: { disable: true },
  upload: { limits: { fileSize: 12 * 1024 * 1024 } },
})
