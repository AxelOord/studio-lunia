import type { Block } from 'payload'

export const Hero: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  fields: [
    { name: 'eyebrow', type: 'text', maxLength: 80 },
    { name: 'heading', type: 'text', required: true, maxLength: 140 },
    { name: 'body', type: 'textarea', maxLength: 600 },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
}
export const Text: Block = {
  slug: 'text',
  interfaceName: 'TextBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true, maxLength: 3000 },
  ],
}
export const Gallery: Block = {
  slug: 'gallery',
  interfaceName: 'GalleryBlock',
  fields: [
    { name: 'heading', type: 'text', required: true },
    {
      name: 'images',
      type: 'array',
      minRows: 1,
      maxRows: 12,
      fields: [{ name: 'image', type: 'upload', relationTo: 'media', required: true }],
    },
  ],
}
