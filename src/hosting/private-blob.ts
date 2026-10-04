import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'
import {
  buildStoragePathData,
  getFilePrefix,
  resolveSignedURLKey,
} from '@payloadcms/plugin-cloud-storage/utilities'
import * as blob from '@vercel/blob'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client'
import { APIError, Forbidden, type StorageAdapter } from 'payload'
import { assertClientUploadAllowed } from 'payload/internal'
import { MAX_UPLOAD_BYTES } from './environment'
import { limitOperation } from './rate-limit'

type BlobIO = Pick<typeof blob, 'put' | 'get' | 'del'>
const PREFIX = 'preview-media'

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
            pathname: resolved.storageFilePath,
            token: await generateClientTokenFromReadWriteToken({
              token,
              pathname: resolved.storageFilePath,
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
    handleUpload: async ({ data, file, storageFilePath }) => {
      await io.put(storageFilePath, file.buffer, {
        token,
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: file.mimeType,
        cacheControlMaxAge: 60,
      })
      return data
    },
    handleDelete: async ({ storageFilePath }) => {
      await io.del(storageFilePath, { token })
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
        const file = await io.get(storageFilePath, {
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

export function privateBlobStorage(enabled: boolean, token: string | undefined): StorageAdapter {
  if (enabled && !token)
    throw new Error('Private Blob token missing; local fallback is prohibited.')
  return {
    name: 'lunia-private-blob',
    collections: ['media'],
    init: (config) =>
      cloudStoragePlugin({
        enabled,
        collections: {
          media: {
            adapter: enabled ? privateBlobAdapter(token!) : null,
            prefix: PREFIX,
            disableLocalStorage: enabled,
          },
        },
      })(config),
  }
}
