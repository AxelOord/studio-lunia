import type { CollectionConfig } from 'payload'
import { editors, publishedOrEditor } from '../access'
import { CallToAction, Gallery, Hero, ImageText, Services, Text } from '../blocks'

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    livePreview: {
      url: ({ data }) => (data.id ? `/preview/live/${data.id}` : null),
      openByDefault: false,
      breakpoints: [
        { name: 'desktop', label: 'Desktop', width: 1440, height: 900 },
        { name: 'mobile', label: 'Mobile', width: 390, height: 844 },
      ],
    },
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
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [Hero, Text, Gallery, ImageText, Services, CallToAction],
              required: true,
              minRows: 1,
              maxRows: 20,
              admin: {
                initCollapsed: true,
                description:
                  'Save a first draft to enable Live Preview. Preview changes are unsaved until Save Draft; only Publish makes them public.',
              },
            },
          ],
        },
        {
          label: 'Page settings',
          description:
            'Page title and description appear in document metadata. Edit visible headings in Content.',
          fields: [
            { name: 'title', label: 'Page title', type: 'text', required: true, maxLength: 120 },
            {
              name: 'slug',
              label: 'URL slug',
              type: 'slug',
              useAsSlug: 'title',
              admin: {
                position: 'main',
                description: 'The page address. Use home for the home page.',
              },
              validate: (value: unknown) =>
                typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
                  ? true
                  : 'Use lowercase letters, numbers and single hyphens.',
            },
            { name: 'description', type: 'textarea', required: true, maxLength: 180 },
          ],
        },
      ],
    },
  ],
}
