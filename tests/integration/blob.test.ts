import 'dotenv/config'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { buildConfig, createLocalReq, getPayload, type Payload, type StorageAdapter } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { GetBlobResult, PutBlobResult } from '@vercel/blob'
import { getPayloadFromClientToken } from '@vercel/blob/client'
import { verifyClientUploadReceipt, getFileFromUploadInstructions } from 'payload/internal'
import sharp from 'sharp'
import { Media } from '../../src/collections/Media'
import { Users } from '../../src/collections/Users'
import { Pages } from '../../src/collections/Pages'
import { privateBlobAdapter } from '../../src/hosting/private-blob'

// In-memory SDK boundary: tests Payload integration, not Vercel's actual store ACL/CORS.
const objects = new Map<string, { bytes: Buffer; type: string }>()
const io = {
  put: async (key: string, body: unknown, options: { access: string; contentType?: string }) => {
    assert.equal(options.access, 'private')
    objects.set(key, { bytes: Buffer.from(body as Buffer), type: options.contentType! })
    return {} as PutBlobResult
  },
  get: async (key: string, options: { access: string; useCache?: boolean }) => {
    assert.equal(options.access, 'private')
    assert.equal(options.useCache, false)
    const object = objects.get(key)
    if (!object) return null
    return {
      statusCode: 200,
      stream: new ReadableStream({
        start(c) {
          c.enqueue(object.bytes)
          c.close()
        },
      }),
      blob: { contentType: object.type, size: object.bytes.length },
    } as GetBlobResult
  },
  del: async (key: string | string[]) => {
    for (const k of Array.isArray(key) ? key : [key]) objects.delete(k)
  },
}
const factory = privateBlobAdapter('vercel_blob_rw_syntheticstore_syntheticlocaltestonly', io)
const storage: StorageAdapter = {
  name: 'test-private-blob',
  collections: ['media'],
  init: (config) =>
    cloudStoragePlugin({
      collections: {
        media: { adapter: factory, prefix: 'preview-media', disableLocalStorage: true },
      },
    })(config),
}
let payload: Payload
let imageID: number
const extraImages: number[] = []
before(async () => {
  payload = await getPayload({
    config: buildConfig({
      secret: process.env.PAYLOAD_SECRET!,
      db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL }, push: false }),
      collections: [Users, Media, Pages],
      storage: [storage],
      sharp,
      upload: { limits: { fileSize: 20 * 1024 * 1024 } },
    }),
  })
})
after(async () => {
  for (const id of extraImages)
    await payload.delete({ collection: 'media', id, overrideAccess: true })
  if (imageID) await payload.delete({ collection: 'media', id: imageID, overrideAccess: true })
  await payload.destroy()
})
test('private Blob integration writes derivatives without local files and serves no-store bytes', async () => {
  const bytes = await sharp({
    create: { width: 1800, height: 1200, channels: 3, background: '#65745a' },
  })
    .png()
    .toBuffer()
  const image = await payload.create({
    collection: 'media',
    overrideAccess: true,
    data: { alt: 'Synthetic Blob integration', visibility: 'private' },
    file: {
      data: bytes,
      mimetype: 'image/png',
      name: `blob-${Date.now()}.png`,
      size: bytes.length,
    },
  })
  imageID = image.id
  assert.equal(objects.size, 3)
  assert.equal(
    (
      await payload.find({
        collection: 'media',
        where: { id: { equals: imageID } },
        overrideAccess: false,
      })
    ).totalDocs,
    0,
  )
  assert.ok(
    payload.collections.media.config.upload &&
      payload.collections.media.config.upload.disableLocalStorage,
  )
  const adapter = factory({ collection: Media, prefix: 'preview-media' })
  const req = await createLocalReq({}, payload)
  for (const filename of [
    image.filename!,
    image.sizes!.card!.filename!,
    image.sizes!.hero!.filename!,
  ]) {
    const response = await adapter.staticHandler(req, {
      doc: image,
      params: { collection: 'media', filename },
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.ok((await response.arrayBuffer()).byteLength > 0)
  }
  await payload.update({
    collection: 'media',
    id: imageID,
    overrideAccess: true,
    data: { visibility: 'public' },
  })
  assert.equal(
    (
      await payload.find({
        collection: 'media',
        where: { id: { equals: imageID } },
        overrideAccess: false,
      })
    ).totalDocs,
    1,
  )
  await payload.update({
    collection: 'media',
    id: imageID,
    overrideAccess: true,
    data: { visibility: 'private' },
  })
  assert.equal(
    (
      await payload.find({
        collection: 'media',
        where: { id: { equals: imageID } },
        overrideAccess: false,
      })
    ).totalDocs,
    0,
  )
})
test('direct upload grants are editor-bound, short-lived, bounded and use opaque paths', async () => {
  const editor = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true }))
    .docs[0]
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const anonymous = await createLocalReq({}, payload)
  const generate = factory({ collection: Media, prefix: 'preview-media' }).uploadInstructions!
    .generate
  const args = {
    collectionSlug: 'media' as const,
    filename: 'synthetic.png',
    filesize: 200,
    mimeType: 'image/png',
    req,
    overrideAccess: false,
  }
  await assert.rejects(async () => generate({ ...args, req: anonymous }))
  await assert.rejects(async () => generate({ ...args, filesize: 21 * 1024 * 1024 }))
  await assert.rejects(async () =>
    generate({ ...args, filename: 'bad.svg', mimeType: 'image/svg+xml' }),
  )
  const granted = await generate(args)
  assert.equal(granted.type, 'dispatch')
  if (granted.type !== 'dispatch') throw new Error('Expected dispatch')
  const data = granted.data as { token: string; pathname: string }
  const grant = getPayloadFromClientToken(data.token)
  assert.equal(grant.maximumSizeInBytes, 200)
  assert.equal(grant.allowOverwrite, false)
  assert.ok(grant.validUntil! <= Date.now() + 10 * 60 * 1000)
  assert.match(data.pathname, /^preview-media\/[a-f0-9-]+\/synthetic\.png$/)
  const signedReceipt = (granted.file.uploadReference as { signedReceipt: string }).signedReceipt
  verifyClientUploadReceipt({
    collectionSlug: 'media',
    filename: granted.file.filename,
    req,
    signedReceipt,
  })
  assert.throws(() =>
    verifyClientUploadReceipt({
      collectionSlug: 'media',
      filename: granted.file.filename,
      req: anonymous,
      signedReceipt,
    }),
  )
  assert.throws(() =>
    verifyClientUploadReceipt({
      collectionSlug: 'media',
      filename: 'forged.png',
      req,
      signedReceipt,
    }),
  )
})

test('a provider upload receipt finalizes validated bytes under its isolated key', async () => {
  const editor = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true }))
    .docs[0]
  const user = { ...editor, collection: 'users' as const }
  const req = await createLocalReq({ user }, payload)
  const adapter = factory({ collection: Media, prefix: 'preview-media' })
  const bytes = await sharp({
    create: { width: 900, height: 700, channels: 3, background: '#65745a' },
  })
    .png()
    .toBuffer()
  const grant = await adapter.uploadInstructions!.generate({
    collectionSlug: 'media',
    filename: 'direct.png',
    filesize: bytes.length,
    mimeType: 'image/png',
    overrideAccess: false,
    req,
  })
  if (grant.type !== 'dispatch') throw new Error('Expected dispatch')
  const key = (grant.data as { pathname: string }).pathname
  objects.set(key, { bytes, type: 'image/png' })
  const file = await getFileFromUploadInstructions({
    collectionSlug: 'media',
    file: grant.file,
    req,
  })
  const image = await payload.create({
    collection: 'media',
    user,
    overrideAccess: false,
    showHiddenFields: true,
    data: { alt: 'Direct synthetic upload', visibility: 'private' },
    file,
  })
  extraImages.push(image.id)
  assert.ok(image._objectKey)
  const response = await adapter.staticHandler(req, {
    doc: image,
    params: { collection: 'media', filename: image.sizes!.card!.filename! },
  })
  assert.equal(response.status, 200)
  assert.ok((await response.arrayBuffer()).byteLength > 0)
  const forged = {
    ...grant.file,
    uploadReference: { ...grant.file.uploadReference, signedReceipt: 'forged' },
  }
  await assert.rejects(
    getFileFromUploadInstructions({ collectionSlug: 'media', file: forged, req }),
  )
})
