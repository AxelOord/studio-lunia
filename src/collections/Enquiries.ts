import type { CollectionConfig, Field } from 'payload'
import { editors } from '../access'
import { inquiryCapability } from '../inquiries/access'

const immutable = { update: () => false }
const readonly = { readOnly: true }
const input = (name: string, type: 'text' | 'textarea' | 'email', maxLength: number): Field =>
  type === 'email'
    ? { name, type, required: true, access: immutable, admin: readonly }
    : type === 'textarea'
      ? { name, type, required: true, maxLength, access: immutable, admin: readonly }
      : { name, type: 'text', required: true, maxLength, access: immutable, admin: readonly }
export const Enquiries: CollectionConfig = {
  slug: 'enquiries',
  versions: false,
  admin: {
    useAsTitle: 'serviceTitle',
    defaultColumns: ['serviceTitle', 'followUp', 'notificationStatus', 'createdAt'],
    description:
      'Private enquiry queue. Review each new enquiry and follow up manually. Preview visitor emails are never sent.',
  },
  access: {
    create: ({ req }) => req.context.inquiryCapability === inquiryCapability,
    read: ({ req }) =>
      req.user
        ? true
        : req.context.inquiryCapability === inquiryCapability
          ? { submissionHash: { equals: String(req.context.inquiryKey) } }
          : false,
    update: editors,
    delete: editors,
  },
  fields: [
    input('serviceId', 'text', 100),
    input('serviceTitle', 'text', 100),
    input('name', 'text', 100),
    input('email', 'email', 254),
    input('message', 'textarea', 3000),
    {
      name: 'followUp',
      type: 'select',
      required: true,
      defaultValue: 'new',
      options: ['new', 'contacted', 'closed'],
      admin: { description: 'Manual follow-up only. No booking or availability is created.' },
    },
    {
      name: 'submissionHash',
      type: 'text',
      required: true,
      unique: true,
      access: immutable,
      admin: { hidden: true },
    },
    {
      name: 'contentHash',
      type: 'text',
      required: true,
      access: immutable,
      admin: { hidden: true },
    },
    {
      name: 'attribution',
      type: 'json',
      required: true,
      access: immutable,
      admin: {
        ...readonly,
        description:
          'Immutable submission snapshot for future booking/revenue linkage. Optional identifiers are absent without campaign consent.',
      },
    },
    {
      name: 'notificationStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'sending', 'accepted', 'failed', 'disabled', 'manual'],
      access: immutable,
      admin: readonly,
    },
    {
      name: 'notificationAttempts',
      type: 'number',
      required: true,
      defaultValue: 0,
      access: immutable,
      admin: readonly,
    },
    { name: 'notificationAttemptedAt', type: 'date', access: immutable, admin: readonly },
    {
      name: 'notificationHelp',
      type: 'ui',
      admin: { components: { Field: './admin/RetryNotification#RetryNotification' } },
    },
  ],
}
