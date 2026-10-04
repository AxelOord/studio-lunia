import path from 'node:path'
import type { CollectionConfig } from 'payload'
import { editors, publicMediaOrEditor } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: { create: editors, read: publicMediaOrEditor, update: editors, delete: editors },
  fields: [
    { name: 'alt', type: 'text', required: true, maxLength: 240 },
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
