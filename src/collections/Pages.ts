import type { CollectionConfig } from 'payload'
import { editors, publishedOrEditor } from '../access'
import { CallToAction, Gallery, Hero, ImageText, Services, Text } from '../blocks'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    preview: (doc) => `/preview?slug=${encodeURIComponent(String(doc.slug ?? 'home'))}`,
  },
  access: {
    create: editors,
    read: publishedOrEditor,
    update: editors,
    delete: editors,
    readVersions: editors,
  },
  versions: { drafts: true, maxPerDoc: 20 },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 120 },
    {
      name: 'slug',
      type: 'slug',
      useAsSlug: 'title',
      validate: (value: unknown) =>
        typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Use lowercase letters, numbers and single hyphens.',
    },
    { name: 'description', type: 'textarea', required: true, maxLength: 180 },
    {
      name: 'layout',
      type: 'blocks',
      blocks: [Hero, Text, Gallery, ImageText, Services, CallToAction],
      required: true,
      minRows: 1,
      maxRows: 20,
    },
  ],
}
