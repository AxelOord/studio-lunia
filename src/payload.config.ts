import 'dotenv/config'
import { postgresAdapter } from '@payloadcms/db-postgres'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { privateBlobStorage } from './hosting/private-blob'
import {
  deploymentMode,
  cmsOrigin,
  cmsAllowedOrigins,
  MAX_UPLOAD_BYTES,
} from './hosting/environment'
import { previewEmail } from './hosting/email'
import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Enquiries } from './collections/Enquiries'
import {
  Contacts,
  Bookings,
  RevenueEntries,
  CustomerActivities,
} from './collections/CustomerRecords'
import { EmailTemplates, EmailMessages } from './collections/EmailRecords'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const mode = deploymentMode(process.env)
const showcase = mode === 'showcase'
const storageEnabled = !showcase && process.env.LUNIA_STORAGE === 'private-blob'
if (!showcase && (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.length < 32))
  throw new Error('Set PAYLOAD_SECRET to a random value of at least 32 characters.')
if (!showcase && !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL for CMS mode.')
const origin = !showcase && (mode === 'preview' || process.env.CMS_ORIGIN) ? cmsOrigin() : undefined

export default buildConfig({
  // Same-origin API/media URLs work on both branch and immutable deployment URLs.
  // Recovery mail uses the canonical branch origin explicitly in Users.
  serverURL: mode === 'preview' ? undefined : origin,
  csrf: origin ? cmsAllowedOrigins() : [],
  cors: origin ? cmsAllowedOrigins() : [],
  email: mode === 'preview' ? previewEmail() : undefined,
  logger:
    mode === 'preview'
      ? {
          options: {
            // Hosted errors deliberately exclude arbitrary exception fields/URLs/credentials.
            serializers: {
              err: () => ({ message: 'CMS operation failed' }),
              req: () => undefined,
              res: () => undefined,
            },
            redact: {
              paths: [
                'password',
                'token',
                'secret',
                'email',
                '*.password',
                '*.token',
                '*.secret',
                '*.email',
                'headers',
                'data',
              ],
              remove: true,
            },
          },
        }
      : undefined,
  storage: [privateBlobStorage(storageEnabled, process.env.BLOB_READ_WRITE_TOKEN)],
  admin: {
    user: Users.slug,
    avatar: 'default',
    components: {
      providers: [
        {
          path: './hosting/PrivateBlobUpload#PrivateBlobUpload',
          clientProps: { collectionSlug: 'media' },
        },
      ],
    },
    importMap: { baseDir: dirname },
    meta: { titleSuffix: '— Studio Lunia' },
  },
  collections: [
    Users,
    Media,
    Pages,
    Enquiries,
    Contacts,
    Bookings,
    RevenueEntries,
    CustomerActivities,
    EmailTemplates,
    EmailMessages,
  ],
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
  upload: { limits: { fileSize: MAX_UPLOAD_BYTES } },
})
