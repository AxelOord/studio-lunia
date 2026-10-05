import 'dotenv/config'
import { test, beforeAll, beforeEach, afterAll } from 'vitest'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import sharp from 'sharp'
import { createTestCMS } from '../helpers/payload'
let payload: Payload
const stamp = Date.now()
let fixture: Awaited<ReturnType<typeof createTestCMS>>
beforeAll(async () => {
  fixture = await createTestCMS()
  payload = fixture.payload
})
beforeEach(async () => {
  await fixture.reset()
})
afterAll(async () => {
  await fixture?.close()
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

test('editorial blocks retain order, draft versions and validate published content', async () => {
  // Own this relationship fixture: other suites may delete their media concurrently,
  // and selecting this test alone must not depend on the earlier upload test.
  const data = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: '#65745a' },
  })
    .png()
    .toBuffer()
  const image = await payload.create({
    collection: 'media',
    overrideAccess: true,
    data: { alt: 'Synthetic editorial block fixture', visibility: 'public' },
    file: { data, mimetype: 'image/png', name: `blocks-${stamp}.png`, size: data.length },
  })
  const created = await payload.create({
    collection: 'pages',
    overrideAccess: true,
    data: {
      title: 'Synthetic block configuration',
      slug: `blocks-${stamp}`,
      description: 'Synthetic test only',
      layout: [
        { blockType: 'hero', heading: 'Existing hero' },
        {
          blockType: 'imageText',
          heading: 'Synthetic split',
          imageSide: 'left',
          body: 'Placeholder body',
          image: image.id,
        },
        {
          blockType: 'gallery',
          heading: 'Synthetic pair',
          images: [{ image: image.id }, { image: image.id }],
        },
        {
          blockType: 'services',
          heading: 'Sample services',
          items: [{ title: 'Placeholder option', body: 'Details awaiting approval.' }],
        },
        { blockType: 'callToAction', heading: 'Sample next step', label: 'View home', href: '/' },
      ],
      _status: 'published',
    },
  })
  const first = created.layout[1]
  assert.equal(first.blockType, 'imageText')
  if (first.blockType === 'imageText') assert.equal(first.imageSide, 'left')
  const reversed = [...created.layout].reverse()
  await payload.update({
    collection: 'pages',
    id: created.id,
    overrideAccess: true,
    draft: true,
    data: { layout: reversed },
  })
  const draft = await payload.findByID({
    collection: 'pages',
    id: created.id,
    overrideAccess: true,
    draft: true,
  })
  assert.deepEqual(
    draft.layout.map((b) => b.blockType),
    reversed.map((b) => b.blockType),
  )
  const published = await payload.findByID({
    collection: 'pages',
    id: created.id,
    overrideAccess: false,
  })
  assert.deepEqual(
    published.layout.map((b) => b.blockType),
    created.layout.map((b) => b.blockType),
  )
  for (const href of [
    'javascript:alert(1)',
    '//example.test',
    '/admin/login',
    '/%2fexample.test',
    '/home?email=private',
    '/home\\other',
  ]) {
    await assert.rejects(
      payload.update({
        collection: 'pages',
        id: created.id,
        overrideAccess: true,
        data: {
          _status: 'published',
          layout: [{ blockType: 'callToAction', heading: 'Test', label: 'Test link', href }],
        },
      }),
      /Page link/,
    )
  }
  for (const items of [
    [],
    Array.from({ length: 7 }, () => ({ title: 'Synthetic', body: 'Placeholder' })),
  ]) {
    await assert.rejects(
      payload.update({
        collection: 'pages',
        id: created.id,
        overrideAccess: true,
        data: { _status: 'published', layout: [{ blockType: 'services', heading: 'Test', items }] },
      }),
    )
  }
})
