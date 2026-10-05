import 'dotenv/config'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { access } from 'node:fs/promises'
import { buildConfig, createLocalReq, getPayload, type Payload } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import type { GetBlobResult, PutBlobResult } from '@vercel/blob'
import { getPayloadFromClientToken } from '@vercel/blob/client'
import {
  verifyClientUploadReceipt,
  getFileFromUploadInstructions,
  getUploadInstructions,
} from 'payload/internal'
import sharp from 'sharp'
// Exercise the exact pinned canary's real file endpoint, including its access lookup.
import { getFileHandler } from '../../node_modules/payload/dist/uploads/endpoints/getFile.js'
import { Media } from '../../src/collections/Media'
import { Users } from '../../src/collections/Users'
import { Pages } from '../../src/collections/Pages'
import { privateBlobAdapter, privateBlobStorage } from '../../src/hosting/private-blob'
import type { Media as MediaDocument } from '../../src/payload-types'

// In-memory SDK boundary: tests Payload integration, not Vercel's actual store ACL/CORS.
const objects = new Map<string, { bytes: Buffer; type: string }>()
const io = {
  put: async (key: string, body: unknown, options: { access: string; contentType?: string }) => {
    assert.equal(options.access, 'private')
    const chunks: Buffer[] = []
    if (body instanceof Readable) {
      for await (const chunk of body) chunks.push(Buffer.from(chunk))
    } else chunks.push(Buffer.from(body as Buffer))
    objects.set(key, { bytes: Buffer.concat(chunks), type: options.contentType! })
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
const storage = privateBlobStorage(true, 'vercel_blob_rw_syntheticstore_syntheticlocaltestonly', io)
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
  const pool = payload.db.pool
  await payload.destroy()
  await pool?.end()
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
  assert.ok(file.tempFilePath)
  const temporaryPath = file.tempFilePath
  await access(temporaryPath)
  const image = await payload.create({
    collection: 'media',
    user,
    overrideAccess: false,
    data: { alt: 'Direct synthetic upload', visibility: 'private' },
    file,
    req,
  })
  extraImages.push(image.id)
  await assert.rejects(access(temporaryPath), { code: 'ENOENT' })
  // Match REST/admin: hidden storage fields must not be exposed to the client.
  assert.equal(image._objectKey, undefined)
  const storedImage = (await payload.db.findOne({
    collection: 'media',
    where: { id: { equals: image.id } },
  })) as MediaDocument | null
  const objectKey = storedImage?._objectKey
  assert.ok(objectKey)
  const reloaded = await payload.findByID({
    collection: 'media',
    id: image.id,
    user,
    overrideAccess: false,
  })
  assert.equal(reloaded._objectKey, undefined)
  const filenames = [
    reloaded.filename,
    reloaded.sizes?.card?.filename,
    reloaded.sizes?.hero?.filename,
  ].filter(Boolean)
  for (const filename of filenames) {
    const readReq = await createLocalReq(
      {
        user,
        req: {
          routeParams: { collection: 'media', filename },
          searchParams: new URLSearchParams({ prefix: reloaded.prefix! }),
        },
      },
      payload,
    )
    const response = await getFileHandler(readReq)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, 'webp')
    const anonymous = await createLocalReq(
      {
        req: {
          routeParams: readReq.routeParams,
          searchParams: readReq.searchParams,
        },
      },
      payload,
    )
    await assert.rejects(async () => getFileHandler(anonymous), { status: 403 })
  }
  const anonymous = await createLocalReq(
    {
      req: {
        routeParams: { collection: 'media', filename: reloaded.filename! },
        searchParams: new URLSearchParams({ prefix: reloaded.prefix! }),
      },
    },
    payload,
  )
  await payload.update({
    collection: 'media',
    id: image.id,
    user,
    overrideAccess: false,
    data: { visibility: 'public' },
  })
  const publicResponse = await getFileHandler(anonymous)
  assert.equal(publicResponse.status, 200)
  assert.equal(publicResponse.headers.get('cache-control'), 'private, no-store')
  assert.ok((await publicResponse.arrayBuffer()).byteLength > 0)
  await payload.update({
    collection: 'media',
    id: image.id,
    user,
    overrideAccess: false,
    data: { visibility: 'private' },
  })
  await assert.rejects(async () => getFileHandler(anonymous), { status: 403 })
  const forged = {
    ...grant.file,
    uploadReference: { ...grant.file.uploadReference, signedReceipt: 'forged' },
  }
  await assert.rejects(
    getFileFromUploadInstructions({ collectionSlug: 'media', file: forged, req }),
  )
  // Document deletion must remove every finalized variant, but never unrelated uploads.
  const finalKeys = [...objects.keys()].filter(
    (candidate) => candidate.includes(objectKey) && candidate !== key,
  )
  const unrelatedKeys = [...objects.keys()].filter((candidate) => !candidate.includes(objectKey))
  assert.ok(finalKeys.length >= 2)
  await assert.rejects(payload.delete({ collection: 'media', id: image.id, overrideAccess: false }))
  for (const finalKey of finalKeys) assert.equal(objects.has(finalKey), true)
  await payload.delete({ collection: 'media', id: image.id, overrideAccess: false, user })
  extraImages.splice(extraImages.indexOf(image.id), 1)
  for (const finalKey of finalKeys) assert.equal(objects.has(finalKey), false)
  for (const unrelatedKey of unrelatedKeys) assert.equal(objects.has(unrelatedKey), true)
  // Format conversion leaves the original provider upload unreferenced. The inventory
  // must retain this as a cleanup candidate; automatic provider cleanup is not implemented.
  assert.equal(objects.has(key), true)
  objects.delete(key)
})

test('invalid direct image leaves no record and removes its local temporary file', async () => {
  const editor = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true }))
    .docs[0]
  const user = { ...editor, collection: 'users' as const }
  const req = await createLocalReq({ user }, payload)
  const bytes = Buffer.from('not an image')
  const grant = await factory({
    collection: Media,
    prefix: 'preview-media',
  }).uploadInstructions!.generate({
    collectionSlug: 'media',
    filename: `invalid-${Date.now()}.png`,
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
  const temporaryPath = file.tempFilePath!
  await access(temporaryPath)
  await assert.rejects(
    payload.create({
      collection: 'media',
      user,
      req,
      overrideAccess: false,
      data: { alt: 'Invalid upload', visibility: 'private' },
      file,
    }),
  )
  await assert.rejects(access(temporaryPath), { code: 'ENOENT' })
  assert.equal(
    (
      await payload.find({
        collection: 'media',
        user,
        overrideAccess: false,
        where: { filename: { equals: grant.file.filename } },
      })
    ).totalDocs,
    0,
  )
  // Failed provider bytes stay private and require the documented orphan review.
  assert.equal(objects.has(key), true)
  objects.delete(key)
})

test('a different preview namespace cannot read or delete this branch media', async () => {
  const image = await payload.findByID({ collection: 'media', id: imageID, overrideAccess: true })
  const foreign = factory({ collection: Media, prefix: 'preview-media/another-branch' })
  const req = await createLocalReq({}, payload)
  const response = await foreign.staticHandler(req, {
    doc: image,
    params: { collection: 'media', filename: image.filename! },
  })
  assert.equal(response.status, 503)
  const keysBefore = [...objects.keys()]
  await assert.rejects(async () =>
    foreign.handleDelete({
      collection: Media,
      doc: {
        id: image.id,
        filename: image.filename!,
        mimeType: image.mimeType!,
        filesize: image.filesize!,
        height: image.height!,
        width: image.width!,
        sizes: {},
        prefix: image.prefix || 'preview-media',
      },
      filename: image.filename!,
      req,
      storageFilePath: keysBefore[0],
    }),
  )
  assert.deepEqual([...objects.keys()], keysBefore)
})

test('real upload instruction pipeline accepts a tiny PNG and distinguishes empty input', async () => {
  const editor = (await payload.find({ collection: 'users', limit: 1, overrideAccess: true }))
    .docs[0]
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const bytes = await sharp({
    create: { width: 240, height: 160, channels: 3, background: '#65745a' },
  })
    .png()
    .toBuffer()
  const input = {
    collectionSlug: 'media' as const,
    filename: 'tiny.png',
    filesize: bytes.length,
    mimeType: 'image/png',
    req,
    overrideAccess: false,
  }
  const instructions = await getUploadInstructions(input)
  assert.equal(instructions.file.size, bytes.length)
  assert.equal(instructions.type, 'dispatch')
  if (instructions.type !== 'dispatch') throw new Error('Expected direct upload')
  assert.equal(
    getPayloadFromClientToken((instructions.data as { token: string }).token).maximumSizeInBytes,
    bytes.length,
  )
  await assert.rejects(getUploadInstructions({ ...input, filesize: 0 }), /selected file is empty/)
  await assert.rejects(
    getUploadInstructions({ ...input, filesize: 21 * 1024 * 1024 }),
    /file size limit/,
  )
})
