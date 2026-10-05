import path from 'node:path'
import { MAX_IMAGE_PIXELS } from '../hosting/environment'
import type { CollectionConfig } from 'payload'
import { editors, publicMediaOrEditor } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'visibility', 'updatedAt'],
    listSearchableFields: ['filename', 'alt'],
    description:
      'Search by filename or alt text; filter by visibility. JPEG, PNG, WebP or AVIF, up to 20 MiB. Open an image for dimensions and details.',
  },
  access: { create: editors, read: publicMediaOrEditor, update: editors, delete: editors },
  fields: [
    {
      name: 'alt',
      label: 'Alt text',
      type: 'text',
      required: true,
      maxLength: 240,
      admin: { description: 'Describe the image for people who cannot see it.' },
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'private',
      options: ['private', 'public'],
      admin: { description: 'Only explicitly public images can appear on the website.' },
    },
  ],
  upload: {
    constructorOptions: { limitInputPixels: MAX_IMAGE_PIXELS },
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'private, no-store')
      headers.set('X-Content-Type-Options', 'nosniff')
      headers.set('X-Robots-Tag', 'noindex, nofollow')
      return headers
    },
    staticDir: path.resolve(process.cwd(), 'media'),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    imageSizes: [
      { name: 'card', width: 720 },
      { name: 'hero', width: 1600 },
    ],
    adminThumbnail: 'card',
    focalPoint: true,
    formatOptions: { format: 'webp', options: { quality: 82 } },
  },
}
