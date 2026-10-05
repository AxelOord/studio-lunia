import type { Block } from 'payload'
import { isInternalPagePath } from '../lib/internal-path'

export const Hero: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  labels: { singular: 'Intro / hero', plural: 'Intro / hero' },
  admin: { disableBlockName: true, components: { Label: './admin/RowLabels#BlockRowLabel' } },
  fields: [
    { name: 'eyebrow', label: 'Small heading (optional)', type: 'text', maxLength: 80 },
    { name: 'heading', type: 'text', required: true, maxLength: 140 },
    { name: 'body', type: 'textarea', maxLength: 600 },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Choose an image. Private images appear only in editor previews.' },
    },
  ],
}
export const Text: Block = {
  slug: 'text',
  interfaceName: 'TextBlock',
  labels: { singular: 'Text section', plural: 'Text section' },
  admin: { disableBlockName: true, components: { Label: './admin/RowLabels#BlockRowLabel' } },
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true, maxLength: 3000 },
  ],
}
export const Gallery: Block = {
  slug: 'gallery',
  interfaceName: 'GalleryBlock',
  labels: { singular: 'Photo gallery', plural: 'Photo gallery' },
  admin: { disableBlockName: true, components: { Label: './admin/RowLabels#BlockRowLabel' } },
  fields: [
    { name: 'heading', type: 'text', required: true },
    {
      name: 'images',
      type: 'array',
      minRows: 1,
      maxRows: 12,
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Choose an image. Private images appear only in editor previews.' },
          required: true,
        },
      ],
    },
  ],
}

export const ImageText: Block = {
  slug: 'imageText',
  interfaceName: 'ImageTextBlock',
  labels: { singular: 'Image and text', plural: 'Image and text' },
  admin: { disableBlockName: true, components: { Label: './admin/RowLabels#BlockRowLabel' } },
  fields: [
    { name: 'heading', type: 'text', required: true, maxLength: 140 },
    { name: 'body', type: 'textarea', required: true, maxLength: 1500 },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Choose an image. Private images appear only in editor previews.' },
      required: true,
    },
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
  admin: { disableBlockName: true, components: { Label: './admin/RowLabels#BlockRowLabel' } },
  fields: [
    { name: 'heading', type: 'text', required: true, maxLength: 140 },
    { name: 'body', type: 'textarea', maxLength: 600 },
    {
      name: 'items',
      label: 'Service cards',
      type: 'array',
      admin: { components: { RowLabel: './admin/RowLabels#ServiceRowLabel' } },
      required: true,
      minRows: 1,
      maxRows: 6,
      fields: [
        { name: 'title', type: 'text', required: true, maxLength: 100 },
        { name: 'body', type: 'textarea', required: true, maxLength: 600 },
        {
          name: 'inclusions',
          label: 'What is included (optional)',
          type: 'textarea',
          maxLength: 1000,
          admin: {
            description: 'Approved service details only. Put each inclusion on a separate line.',
          },
        },
        {
          name: 'priceGuidance',
          label: 'Price guidance (optional)',
          type: 'text',
          maxLength: 180,
          admin: { description: 'Use approved wording. Leave blank until pricing is agreed.' },
        },
        {
          name: 'responseExpectation',
          label: 'Personal response expectation (optional)',
          type: 'text',
          maxLength: 180,
          admin: {
            description:
              'Only an agreed human-response promise; leave blank if no timing is approved.',
          },
        },
      ],
    },
  ],
}

export const CallToAction: Block = {
  slug: 'callToAction',
  interfaceName: 'CallToActionBlock',
  labels: { singular: 'Call to action', plural: 'Calls to action' },
  admin: { disableBlockName: true, components: { Label: './admin/RowLabels#BlockRowLabel' } },
  fields: [
    { name: 'heading', type: 'text', required: true, maxLength: 140 },
    { name: 'body', type: 'textarea', maxLength: 600 },
    { name: 'label', label: 'Button text', type: 'text', required: true, maxLength: 80 },
    {
      name: 'href',
      label: 'Page link',
      type: 'text',
      required: true,
      maxLength: 180,
      admin: { description: 'Use / or an existing page path such as /sessions. No external URLs.' },
      validate: (value: unknown) =>
        isInternalPagePath(value) || 'Use / or a lowercase page path such as /sessions.',
    },
  ],
}
