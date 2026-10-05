'use client'
import { createClientUploadHandler } from '@payloadcms/plugin-cloud-storage/client'
import { put } from '@vercel/blob/client'

export const PrivateBlobUpload = createClientUploadHandler({
  name: 'luniaPrivateBlob',
  handler: async ({ data, file, updateFilename }) => {
    const { pathname, token } = data as { pathname: string; token: string }
    const result = await put(pathname, file, { access: 'private', contentType: file.type, token })
    const filename = decodeURIComponent(result.pathname.split('/').at(-1)!)
    if (filename !== file.name) updateFilename(filename)
  },
})
