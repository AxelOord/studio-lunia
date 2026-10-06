import type { CollectionConfig, Field } from 'payload'
import { editors, publishedOrEditor } from '../access'
import { CallToAction, Gallery, Hero, ImageText, Services, Text } from '../blocks'
import { internalWrite } from '../customer-records/core'
import { publishStudioDay, prepareStudioDay } from '../studio-days/publication'

const no = () => false
const number = (name: string, label: string, min: number, max: number): Field => ({
  name,
  label,
  type: 'number',
  required: true,
  min,
  max,
})
const localOffset = (name: string, label: string): Field => ({
  name,
  label,
  type: 'number',
  min: -840,
  max: 840,
  admin: {
    description:
      'Only needed when this local time occurs twice at a clock change. Minutes east of UTC, for example 60 or 120.',
  },
})
export const StudioDays: CollectionConfig = {
  slug: 'studio-days',
  versions: { drafts: true, maxPerDoc: 20 },
  access: {
    create: editors,
    read: publishedOrEditor,
    update: editors,
    delete: no,
    readVersions: editors,
  },
  admin: {
    group: 'Studio sessions',
    useAsTitle: 'title',
    defaultColumns: ['title', 'localDate', '_status', 'bookingsOpen', 'confirmationMode'],
    preview: (doc) => `/preview/studio-days/${encodeURIComponent(String(doc.slug))}`,
    description:
      'Publish a rented studio day. Existing bookings keep their agreed details. Preview bookings take no payment and create private email test drafts only.',
  },
  hooks: { beforeChange: [prepareStudioDay], afterChange: [publishStudioDay] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 140 },
    {
      name: 'slug',
      type: 'slug',
      useAsSlug: 'title',
      validate: (value: unknown) =>
        (typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) ||
        'Use lowercase words joined with hyphens.',
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Session offer',
          fields: [
            { name: 'location', type: 'text', required: true, maxLength: 300 },
            { name: 'offerTitle', type: 'text', required: true, maxLength: 140 },
            { name: 'inclusions', type: 'textarea', required: true, maxLength: 2000 },
            number('priceMinor', 'Price in minor currency units', 0, 100_000_000),
            {
              name: 'currency',
              type: 'text',
              required: true,
              maxLength: 3,
              admin: {
                description: 'ISO currency, for example EUR. Price 10000 means EUR 100.00.',
              },
            },
            {
              name: 'changePolicy',
              label: 'Change and cancellation conditions',
              type: 'textarea',
              required: true,
              maxLength: 3000,
            },
          ],
        },
        {
          label: 'Date and availability',
          fields: [
            {
              name: 'localDate',
              label: 'Local date (YYYY-MM-DD)',
              type: 'text',
              required: true,
              maxLength: 10,
            },
            {
              name: 'timeZone',
              label: 'IANA timezone',
              type: 'text',
              required: true,
              maxLength: 80,
            },
            {
              name: 'opensLocal',
              label: 'Opening (HH:mm)',
              type: 'text',
              required: true,
              maxLength: 5,
            },
            localOffset('openOffset', 'Opening UTC offset, if repeated'),
            {
              name: 'closesLocal',
              label: 'Closing (HH:mm)',
              type: 'text',
              required: true,
              maxLength: 5,
            },
            localOffset('closeOffset', 'Closing UTC offset, if repeated'),
            number('durationMinutes', 'Session duration in minutes', 5, 480),
            number('bufferMinutes', 'Buffer after each session in minutes', 0, 240),
            number('capacity', 'Places per slot', 1, 10),
            {
              name: 'bookingDeadlineLocal',
              label: 'Booking deadline (YYYY-MM-DDTHH:mm)',
              type: 'text',
              required: true,
              maxLength: 16,
            },
            localOffset('deadlineOffset', 'Deadline UTC offset, if repeated'),
            {
              name: 'confirmationMode',
              type: 'select',
              required: true,
              defaultValue: 'immediate',
              options: [
                { label: 'Confirm immediately', value: 'immediate' },
                { label: 'Photographer approval required', value: 'manual' },
              ],
              admin: {
                description:
                  'Pending requests use a place until approved or cancelled. Existing bookings keep their status.',
              },
            },
            {
              name: 'bookingsOpen',
              label: 'Accept new bookings',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'dayState',
              type: 'select',
              required: true,
              defaultValue: 'scheduled',
              options: ['scheduled', 'cancelled'],
              admin: {
                description:
                  'Cancelling the day stops new bookings. Review and cancel each existing commitment separately.',
              },
            },
            {
              name: 'acknowledgeBookings',
              label: 'I reviewed existing bookings and will arrange any changes with each customer',
              type: 'checkbox',
              admin: {
                description:
                  'Required afresh when publishing changed settings with active bookings. Existing details are never rewritten.',
              },
            },
          ],
        },
        {
          label: 'Page content',
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              maxRows: 20,
              blocks: [Hero, Text, Gallery, ImageText, Services, CallToAction],
              admin: { initCollapsed: true },
            },
          ],
        },
      ],
    },
    {
      name: 'scheduleRevision',
      type: 'number',
      defaultValue: 0,
      access: { create: no, update: no },
      admin: { hidden: true },
    },
    {
      name: 'configurationHash',
      type: 'text',
      access: { create: no, update: no },
      admin: { hidden: true },
    },
  ],
}
export const StudioSlots: CollectionConfig = {
  slug: 'studio-slots',
  versions: false,
  access: {
    read: ({ req }) => Boolean(req.user) || internalWrite({ req }),
    create: internalWrite,
    update: no,
    delete: no,
  },
  admin: { hidden: true },
  fields: [
    { name: 'day', type: 'relationship', relationTo: 'studio-days', required: true, index: true },
    { name: 'revision', type: 'number', required: true },
    { name: 'slotKey', type: 'text', required: true, unique: true },
    { name: 'startsAt', type: 'date', required: true, index: true },
    { name: 'endsAt', type: 'date', required: true },
    { name: 'occupiedUntil', type: 'date', required: true },
    number('capacity', 'Capacity', 1, 10),
    { name: 'snapshot', type: 'json', required: true },
  ],
}
