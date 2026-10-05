import { beforeAll, beforeEach, afterAll, test, expect, vi } from 'vitest'
import { createTestCMS, createEditor } from '../helpers/payload'
import { publishedServices, resolveLandingPage } from '../../src/inquiries/services'
import { seedLandingDemo } from '../../scripts/seed-landing-demo'

let fixture: Awaited<ReturnType<typeof createTestCMS>>
beforeAll(async () => {
  fixture = await createTestCMS()
})
beforeEach(async () => {
  await fixture.reset()
})
afterAll(async () => {
  await fixture?.close()
})

async function source() {
  const user = await createEditor(fixture.payload)
  const page = await fixture.payload.create({
    collection: 'pages',
    user,
    overrideAccess: false,
    data: {
      title: 'Synthetic offer source',
      slug: 'synthetic-offer',
      description: 'Synthetic test only',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Synthetic services',
          items: [
            {
              id: 'synthetic-service',
              title: 'Synthetic portrait',
              body: 'Approved synthetic description',
              inclusions: 'Synthetic inclusion one\nSynthetic inclusion two',
              priceGuidance: 'Synthetic price guidance only',
              responseExpectation: 'Synthetic response wording only',
            },
          ],
        },
      ],
    },
  })
  return { user, page, id: `${page.id}:synthetic-service` }
}

test('a landing resolves only the published canonical offer; drafts cannot replace it', async () => {
  const { payload } = fixture
  const { user, page, id } = await source()
  const landing = await payload.create({
    collection: 'pages',
    user,
    overrideAccess: false,
    data: {
      title: 'Synthetic landing',
      slug: 'synthetic-landing',
      description: 'Synthetic',
      _status: 'published',
      inquiryService: id,
      layout: [{ blockType: 'hero', heading: 'Synthetic campaign headline' }],
    },
  })
  await expect(
    payload.update({
      collection: 'pages',
      id: landing.id,
      user,
      overrideAccess: false,
      data: { inquiryService: '999999:missing' },
    }),
  ).rejects.toThrow(/service/i)
  const original = (await resolveLandingPage(payload, landing)).inquiryOffer
  expect(original).toMatchObject({
    id,
    title: 'Synthetic portrait',
    description: 'Approved synthetic description',
    inclusions: 'Synthetic inclusion one\nSynthetic inclusion two',
    priceGuidance: 'Synthetic price guidance only',
  })
  await payload.update({
    collection: 'pages',
    id: page.id,
    user,
    overrideAccess: false,
    draft: true,
    data: {
      layout: [
        {
          blockType: 'services',
          heading: 'Private draft',
          items: [
            {
              id: 'synthetic-service',
              title: 'Private unapproved title',
              body: 'Private unapproved details',
            },
          ],
        },
      ],
    },
  })
  expect((await resolveLandingPage(payload, landing)).inquiryOffer).toEqual(original)
  expect(await publishedServices(payload)).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ title: 'Private unapproved title' })]),
  )
  await expect(
    payload.create({
      collection: 'pages',
      overrideAccess: false,
      data: {
        title: 'Anonymous',
        slug: 'anonymous',
        description: 'Denied',
        inquiryService: id,
        layout: [{ blockType: 'hero', heading: 'Denied' }],
      },
    }),
  ).rejects.toThrow()
})

test('missing and unpublished targets stay editable as drafts but cannot be published or resolve a substitute', async () => {
  const { payload } = fixture
  const { user, page, id } = await source()
  const landing = await payload.create({
    collection: 'pages',
    user,
    overrideAccess: false,
    draft: true,
    data: {
      title: 'Incomplete landing',
      slug: 'incomplete',
      description: 'Synthetic',
      inquiryService: '999999:missing',
      layout: [{ blockType: 'hero', heading: 'Synthetic' }],
    },
  })
  expect((await resolveLandingPage(payload, landing)).inquiryOffer).toBeNull()
  await expect(
    payload.update({
      collection: 'pages',
      id: landing.id,
      user,
      overrideAccess: false,
      data: { _status: 'published' },
    }),
  ).rejects.toThrow(/service/i)
  await payload.update({
    collection: 'pages',
    id: landing.id,
    user,
    overrideAccess: false,
    data: { inquiryService: id, _status: 'published' },
  })
  await payload.update({
    collection: 'pages',
    id: page.id,
    user,
    overrideAccess: false,
    data: { _status: 'draft' },
  })
  expect(
    (await resolveLandingPage(payload, { ...landing, inquiryService: id })).inquiryOffer,
  ).toBeNull()
  await expect(
    payload.update({
      collection: 'pages',
      id: landing.id,
      user,
      overrideAccess: false,
      data: { _status: 'published' },
    }),
  ).rejects.toThrow(/service/i)
})

test('service limits and self-page removal are checked on publishing', async () => {
  const { payload } = fixture
  const { user, page, id } = await source()
  await payload.update({
    collection: 'pages',
    id: page.id,
    user,
    overrideAccess: false,
    data: { inquiryService: id, _status: 'published' },
  })
  await expect(
    payload.update({
      collection: 'pages',
      id: page.id,
      user,
      overrideAccess: false,
      data: { _status: 'published', layout: [{ blockType: 'hero', heading: 'Service removed' }] },
    }),
  ).rejects.toThrow(/service/i)
  await expect(
    payload.update({
      collection: 'pages',
      id: page.id,
      user,
      overrideAccess: false,
      data: {
        _status: 'published',
        layout: [
          {
            blockType: 'services',
            heading: 'Synthetic',
            items: [
              {
                id: 'synthetic-service',
                title: 'Synthetic',
                body: 'Synthetic',
                priceGuidance: 'x'.repeat(181),
              },
            ],
          },
        ],
      },
    }),
  ).rejects.toThrow()
})

test('synthetic landing bootstrap is atomic and preserves existing draft edits and service choice', async () => {
  const { payload } = fixture
  await seedLandingDemo(payload)
  const first = await payload.find({ collection: 'pages', overrideAccess: false })
  expect(first.totalDocs).toBe(1)
  expect((await resolveLandingPage(payload, first.docs[0])).inquiryOffer?.title).toBe(
    'Synthetic portrait enquiry',
  )
  await payload.update({
    collection: 'pages',
    id: first.docs[0].id,
    overrideAccess: true,
    draft: true,
    data: {
      title: 'Preserved editor draft',
      inquiryService: '',
      layout: [{ blockType: 'hero', heading: 'Preserved draft heading' }],
    },
  })
  await seedLandingDemo(payload)
  const after = await payload.find({ collection: 'pages', overrideAccess: true, draft: true })
  expect(after.totalDocs).toBe(1)
  expect(after.docs[0].title).toBe('Preserved editor draft')
  expect(after.docs[0].inquiryService).toBe('')
  expect(after.docs[0].layout[0]).toMatchObject({ heading: 'Preserved draft heading' })
})

test('failed synthetic landing initialization rolls back its own page before a clean retry', async () => {
  const { payload } = fixture
  const update = vi
    .spyOn(payload, 'update')
    .mockRejectedValueOnce(new Error('Synthetic initialization interruption'))
  try {
    await expect(seedLandingDemo(payload)).rejects.toThrow('Synthetic initialization interruption')
  } finally {
    update.mockRestore()
  }
  expect((await payload.count({ collection: 'pages', overrideAccess: true })).totalDocs).toBe(0)
  await seedLandingDemo(payload)
  const pages = await payload.find({ collection: 'pages', overrideAccess: false })
  expect(pages.totalDocs).toBe(1)
  expect((await resolveLandingPage(payload, pages.docs[0])).inquiryOffer?.id).toBe(
    pages.docs[0].inquiryService,
  )
})
