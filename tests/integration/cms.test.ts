import 'dotenv/config'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import config from '../../src/payload.config'
let payload: Payload
const stamp = Date.now()
const pages: number[] = []
const media: number[] = []
before(async () => {
  payload = await getPayload({ config })
})
after(async () => {
  for (const id of pages) await payload.delete({ collection: 'pages', id, overrideAccess: true })
  for (const id of media) await payload.delete({ collection: 'media', id, overrideAccess: true })
  await payload.destroy()
})
test('anonymous access cannot read users or write pages', async () => {
  await assert.rejects(payload.find({ collection: 'users', overrideAccess: false }))
  await assert.rejects(
    payload.create({
      collection: 'pages',
      overrideAccess: false,
      data: {
        title: 'Denied',
        slug: 'denied',
        description: 'Denied',
        layout: [{ blockType: 'text', heading: 'Denied', body: 'Denied' }],
      },
    }),
  )
})
test('drafts stay private and publishing exposes only published content', async () => {
  const page = await payload.create({
    collection: 'pages',
    overrideAccess: true,
    data: {
      title: 'Synthetic draft',
      slug: `test-${stamp}`,
      description: 'Test only',
      layout: [{ blockType: 'text', heading: 'Draft secret', body: 'Synthetic content' }],
      _status: 'draft',
    },
  })
  pages.push(page.id)
  const hidden = await payload.find({
    collection: 'pages',
    where: { id: { equals: page.id } },
    overrideAccess: false,
    draft: true,
  })
  assert.equal(hidden.totalDocs, 0)
  await payload.update({
    collection: 'pages',
    id: page.id,
    overrideAccess: true,
    data: { _status: 'published' },
  })
  const visible = await payload.find({
    collection: 'pages',
    where: { id: { equals: page.id } },
    overrideAccess: false,
  })
  assert.equal(visible.totalDocs, 1)
})
test('raster upload generates derivatives and stays private until explicitly public', async () => {
  const data = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: '#65745a' },
  })
    .png()
    .toBuffer()
  const image = await payload.create({
    collection: 'media',
    overrideAccess: true,
    data: { alt: 'Synthetic green image', visibility: 'private' },
    file: { data, mimetype: 'image/png', name: `synthetic-${stamp}.png`, size: data.length },
  })
  media.push(image.id)
  assert.equal(image.sizes?.card?.width, 720)
  assert.equal(image.sizes?.hero?.width, 1600)
  assert.equal(
    (
      await payload.find({
        collection: 'media',
        where: { id: { equals: image.id } },
        overrideAccess: false,
      })
    ).totalDocs,
    0,
  )
  await payload.update({
    collection: 'media',
    id: image.id,
    data: { visibility: 'public' },
    overrideAccess: true,
  })
  assert.equal(
    (
      await payload.find({
        collection: 'media',
        where: { id: { equals: image.id } },
        overrideAccess: false,
      })
    ).totalDocs,
    1,
  )
})
test('first-user path cannot bypass the bootstrap guard', async () => {
  await assert.rejects(
    payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email: `blocked-${stamp}@example.test`, password: 'synthetic-password-123456' },
    }),
    /bootstrap/,
  )
})
