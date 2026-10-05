import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'
import {
  buildStoragePathData,
  getFilePrefix,
  resolveSignedURLKey,
} from '@payloadcms/plugin-cloud-storage/utilities'
import * as blob from '@vercel/blob'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { APIError, Forbidden, type PayloadRequest, type StorageAdapter } from 'payload'
import { assertClientUploadAllowed } from 'payload/internal'
import { MAX_UPLOAD_BYTES } from './environment'
import { assertMediaNamespace, previewNamespace } from './preview-identity'
import { limitOperation } from './rate-limit'
import type { Media } from '../payload-types'
import { createReadStream } from 'node:fs'

type BlobIO = Pick<typeof blob, 'put' | 'get' | 'del'>
const PREFIX = process.env.LUNIA_CMS_PREVIEW === 'true' ? previewNamespace() : 'preview-media'
// Canary delete hooks receive a response document after hidden _objectKey is removed.
// Retain only the authorized deletion's storage identity in server memory, never its response.
const deletionFolders = new WeakMap<PayloadRequest, Map<string, string>>()
const uploadFolders = new WeakMap<object, Promise<string>>()

// The pinned official Blob adapter only supports public storage. This deliberately small
// private adapter uses Payload's own access, signed receipts, key isolation and validation.
// Provider authorization must additionally be verified against an actual PRIVATE store.
export function privateBlobAdapter(token: string, io: BlobIO = blob): Adapter {
  return ({ collection, prefix = PREFIX }) => ({
    name: 'lunia-private-blob',
    uploadInstructions: {
      enabled: true,
      useInAdmin: true,
      requiresUploadReceipt: true,
      generate: async ({ collectionSlug, filename, filesize, mimeType, req }) => {
        if (!req.user) throw new Forbidden(req.t)
        if (!Number.isSafeInteger(filesize) || filesize <= 0 || filesize > MAX_UPLOAD_BYTES)
          throw new APIError('Upload exceeds the permitted size.', 400)
        assertClientUploadAllowed({ collection, filename, mimeType })
        if (process.env.LUNIA_CMS_PREVIEW === 'true')
          await limitOperation('upload', String(req.user.id), 30, 3600)
        // Ignore caller-supplied prefixes. Each upload gets a server-owned random object key.
        const resolved = await resolveSignedURLKey({
          collectionPrefix: prefix,
          collectionSlug,
          filename,
          req,
        })
        return {
          name: 'luniaPrivateBlob',
          type: 'dispatch',
          data: {
            pathname: assertMediaNamespace(resolved.storageFilePath, prefix),
            token: await generateClientTokenFromReadWriteToken({
              token,
              pathname: assertMediaNamespace(resolved.storageFilePath, prefix),
              addRandomSuffix: false,
              allowOverwrite: false,
              allowedContentTypes: [mimeType],
              maximumSizeInBytes: filesize,
              validUntil: Date.now() + 10 * 60 * 1000,
            }),
          },
          file: {
            filename: resolved.sanitizedFilename,
            mimeType,
            size: filesize,
            uploadReference: resolved.uploadReference,
          },
        }
      },
    },
    handleUpload: async ({ file, req, data }) => {
      // In this canary, afterRead removes hidden _objectKey before afterChange.
      // The operation already authorized/persisted this document. Resolve its raw
      // storage identity inside the same transaction; never return it to the client.
      // Variants share this upload-data object; one lookup avoids concurrent queries
      // on the request's transaction connection. Later uploads receive a new object.
      let folder = uploadFolders.get(data)
      if (!folder) {
        folder = req.payload.db
          .findOne({ collection: 'media', req, where: { id: { equals: data.id } } })
          .then((doc) => {
            if (!doc) throw new Error('Media upload storage identity unavailable.')
            return getFilePrefix({
              collection,
              collectionPrefix: prefix,
              doc,
              filename: file.filename,
              req,
            })
          })
        uploadFolders.set(data, folder)
      }
      const { storageFilePath } = buildStoragePathData({
        collectionPrefix: prefix,
        docPrefix: await folder,
        filename: file.filename,
      })
      // Client uploads retain processed original bytes in a temporary file; their
      // buffer is empty. Variants are buffers. Stream the actual original bytes.
      const stream = file.tempFilePath ? createReadStream(file.tempFilePath) : undefined
      try {
        await io.put(assertMediaNamespace(storageFilePath, prefix), stream ?? file.buffer, {
          token,
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: file.mimeType,
          cacheControlMaxAge: 60,
        })
      } finally {
        stream?.destroy()
      }
      // No provider metadata is added. Echoing data triggers Payload's nested metadata
      // update, which clears req.file before its client-upload tempfile cleanup.
    },
    handleDelete: async ({ storageFilePath, req, doc, filename }) => {
      const folder = deletionFolders.get(req)?.get(`${collection.slug}:${doc.id}`)
      const key =
        folder === undefined
          ? storageFilePath
          : buildStoragePathData({
              collectionPrefix: prefix,
              docPrefix: folder,
              filename,
            }).storageFilePath
      await io.del(assertMediaNamespace(key, prefix), { token })
    },
    staticHandler: async (req, { doc, params: { filename, uploadReference } }) => {
      try {
        // Normal reads are authorized by cloudStoragePlugin before reaching this handler.
        // Upload receipts are verified by Payload before its internal validation fetch.
        const docPrefix = await getFilePrefix({
          collection,
          collectionPrefix: prefix,
          doc,
          filename,
          req,
          uploadReference,
        })
        const { storageFilePath } = buildStoragePathData({
          collectionPrefix: prefix,
          docPrefix,
          filename,
        })
        const file = await io.get(assertMediaNamespace(storageFilePath, prefix), {
          token,
          access: 'private',
          useCache: false,
          abortSignal: req.signal,
        })
        if (!file || file.statusCode !== 200) return new Response(null, { status: 404 })
        return new Response(file.stream, {
          headers: {
            'Content-Type': file.blob.contentType,
            'Content-Length': String(file.blob.size),
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        })
      } catch {
        // Provider exceptions can contain private URLs. Keep them out of logs/responses.
        return new Response('Media unavailable.', {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    },
  })
}

export function privateBlobStorage(
  enabled: boolean,
  token: string | undefined,
  io: BlobIO = blob,
): StorageAdapter {
  if (enabled && !token)
    throw new Error('Private Blob token missing; local fallback is prohibited.')
  return {
    name: 'lunia-private-blob',
    collections: ['media'],
    init: (config) => {
      if (enabled) {
        config = {
          ...config,
          collections: config.collections?.map((collection) =>
            collection.slug !== 'media'
              ? collection
              : {
                  ...collection,
                  hooks: {
                    ...collection.hooks,
                    beforeChange: [
                      ...(collection.hooks?.beforeChange ?? []),
                      ({ originalDoc }) => {
                        if (originalDoc?.prefix)
                          assertMediaNamespace(`${originalDoc.prefix}/record`, PREFIX)
                      },
                    ],
                    beforeDelete: [
                      ...(collection.hooks?.beforeDelete ?? []),
                      async ({ id, req }) => {
                        // Payload has already authorized this exact deletion. Read raw hidden
                        // storage metadata before the record is removed; no access is granted here.
                        const doc = await req.payload.db.findOne({
                          collection: 'media',
                          req,
                          where: { id: { equals: id } },
                        })
                        if (!doc) throw new Error('Media deletion target unavailable.')
                        let folders = deletionFolders.get(req)
                        if (!folders) {
                          folders = new Map()
                          deletionFolders.set(req, folders)
                        }
                        const folder = [(doc as Media).prefix || PREFIX, (doc as Media)._objectKey]
                          .filter(Boolean)
                          .join('/')
                        assertMediaNamespace(`${folder}/record`, PREFIX)
                        folders.set(`media:${id}`, folder)
                      },
                    ],
                  },
                },
          ),
        }
      }
      return cloudStoragePlugin({
        enabled,
        collections: {
          media: {
            adapter: enabled ? privateBlobAdapter(token!, io) : null,
            prefix: PREFIX,
            disableLocalStorage: enabled,
          },
        },
      })(config)
    },
  }
}
