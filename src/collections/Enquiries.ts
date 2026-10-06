import type { CollectionConfig, Field } from 'payload'
import { internalWrite } from '../customer-records/core'
import { editors } from '../access'
import { inquiryCapability } from '../inquiries/access'
import { enquiryActivity, linkNewEnquiry } from '../customer-records/hooks'

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
  hooks: { beforeChange: [linkNewEnquiry], afterChange: [enquiryActivity] },
  admin: {
    useAsTitle: 'serviceTitle',
    defaultColumns: ['serviceTitle', 'followUp', 'notificationStatus', 'createdAt'],
    description:
      'Private enquiry queue. Review each new enquiry and follow up manually. Preview visitor emails are never sent.',
  },
  access: {
    create: ({ req }) => req.context.inquiryCapability === inquiryCapability,
    read: ({ req }) =>
      req.user || internalWrite({ req })
        ? true
        : req.context.inquiryCapability === inquiryCapability
          ? { submissionHash: { equals: String(req.context.inquiryKey) } }
          : false,
    update: editors,
    delete: () => false,
  },
  fields: [
    {
      name: 'contact',
      type: 'relationship',
      relationTo: 'contacts',
      index: true,
      admin: {
        description:
          'Link to an existing contact only after checking identity. Matching email alone is not sufficient.',
      },
    },
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
        components: { Field: './admin/PrivateJSON#PrivateJSON' },
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
    {
      name: 'customerActions',
      type: 'ui',
      admin: { components: { Field: './admin/EnquiryActions#EnquiryActions' } },
    },
  ],
}
