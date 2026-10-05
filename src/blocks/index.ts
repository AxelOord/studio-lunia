import type { Block } from 'payload'
import { isInternalPagePath } from '../lib/internal-path'

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

export const ImageText: Block = {
  slug: 'imageText',
  interfaceName: 'ImageTextBlock',
  labels: { singular: 'Image and text', plural: 'Image and text' },
  fields: [
    { name: 'heading', type: 'text', required: true, maxLength: 140 },
    { name: 'body', type: 'textarea', required: true, maxLength: 1500 },
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    {
      name: 'imageSide',
      type: 'select',
      defaultValue: 'left',
      required: true,
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
      ],
    },
  ],
}

export const Services: Block = {
  slug: 'services',
  interfaceName: 'ServicesBlock',
  labels: { singular: 'Service cards', plural: 'Service cards' },
  fields: [
    { name: 'heading', type: 'text', required: true, maxLength: 140 },
    { name: 'body', type: 'textarea', maxLength: 600 },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 6,
      fields: [
        { name: 'title', type: 'text', required: true, maxLength: 100 },
        { name: 'body', type: 'textarea', required: true, maxLength: 600 },
      ],
    },
  ],
}

export const CallToAction: Block = {
  slug: 'callToAction',
  interfaceName: 'CallToActionBlock',
  labels: { singular: 'Call to action', plural: 'Calls to action' },
  fields: [
    { name: 'heading', type: 'text', required: true, maxLength: 140 },
    { name: 'body', type: 'textarea', maxLength: 600 },
    { name: 'label', type: 'text', required: true, maxLength: 80 },
    {
      name: 'href',
      label: 'Page path',
      type: 'text',
      required: true,
      maxLength: 180,
      admin: { description: 'Use / or an existing page path such as /sessions. No external URLs.' },
      validate: (value: unknown) =>
        isInternalPagePath(value) || 'Use / or a lowercase page path such as /sessions.',
    },
  ],
}
