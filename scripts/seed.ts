import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { samplePage } from '../src/lib/sample'
import { seedStudioDemo } from './seed-studio-demo'
import { seedLandingDemo } from './seed-landing-demo'

if (process.env.VERCEL || process.env.LUNIA_SHOWCASE === 'true')
  throw new Error('Seed is local-only.')
const email = process.env.SEED_EMAIL
const password = process.env.SEED_PASSWORD
if (!email || !password || password.length < 16)
  throw new Error('Set SEED_EMAIL and a SEED_PASSWORD of at least 16 characters.')
const payload = await getPayload({ config })
try {
  const existing = await payload.find({ collection: 'users', limit: 1, overrideAccess: true })
  if (!existing.totalDocs)
    await payload.create({
      collection: 'users',
      data: { email, password },
      context: { bootstrap: true },
      overrideAccess: true,
    })
  const pages = await payload.find({
    collection: 'pages',
    where: { slug: { equals: 'home' } },
    limit: 1,
    overrideAccess: true,
  })
  if (!pages.totalDocs)
    await payload.create({
      collection: 'pages',
      data: { ...samplePage, _status: 'published' },
      overrideAccess: true,
    })
  await seedLandingDemo(payload)
  await seedStudioDemo(payload)
  console.log('Local seed complete; existing editors and content were preserved.')
} finally {
  const pool = payload.db.pool
  try {
    await payload.destroy()
  } finally {
    await pool.end()
  }
}
