import type { CollectionConfig, Field } from 'payload'
import { editors } from '../access'
import { internalWrite } from '../customer-records/core'
import { followUpStates, purposes, validTimeZone } from '../followups/domain'

const privateRecords = {
  read: ({ req }: Parameters<typeof internalWrite>[0]) =>
    Boolean(req.user) || internalWrite({ req }),
  create: internalWrite,
  update: internalWrite,
  delete: () => false,
}
const relation = (
  name: string,
  relationTo: 'contacts' | 'enquiries' | 'bookings' | 'email-templates' | 'follow-up-rules',
  required = false,
): Field => ({ name, type: 'relationship', relationTo, required, index: true })

export const FollowUps: CollectionConfig = {
  slug: 'follow-ups',
  versions: false,
  access: privateRecords,
  admin: {
    group: 'Customers',
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'contact', 'purpose', 'plannedAt', 'state'],
    description:
      'Private test plans. Use the guided Follow-ups view. No automatic or real-customer delivery is active.',
  },
  fields: [
    relation('contact', 'contacts', true),
    relation('enquiry', 'enquiries'),
    relation('booking', 'bookings'),
    relation('template', 'email-templates', true),
    relation('rule', 'follow-up-rules'),
    { name: 'purpose', type: 'select', options: [...purposes], required: true },
    { name: 'triggerKey', type: 'text', required: true, unique: true, admin: { hidden: true } },
    { name: 'triggeredAt', type: 'date', required: true },
    { name: 'revision', type: 'number', required: true, defaultValue: 1 },
    { name: 'plannedAt', type: 'date', required: true, index: true },
    { name: 'timeZone', type: 'text', required: true },
    { name: 'sessionSnapshot', type: 'date' },
    { name: 'recipient', type: 'email', required: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'text', type: 'textarea', required: true },
    { name: 'html', type: 'textarea', required: true, admin: { hidden: true } },
    { name: 'templateSnapshot', type: 'json', required: true },
    {
      name: 'state',
      type: 'select',
      options: [...followUpStates],
      required: true,
      defaultValue: 'planned',
      index: true,
    },
    { name: 'blockReason', type: 'text' },
    { name: 'jobID', type: 'number', admin: { hidden: true } },
    { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
    { name: 'outcomeKey', type: 'text', unique: true, admin: { hidden: true } },
    { name: 'simulatedAt', type: 'date' },
    { name: 'lastError', type: 'text' },
  ],
}

export const FollowUpRules: CollectionConfig = {
  slug: 'follow-up-rules',
  versions: false,
  access: { read: privateRecords.read, create: editors, update: editors, delete: () => false },
  admin: {
    group: 'Email',
    useAsTitle: 'name',
    description:
      'Test planning only. No example is enabled by default and approval never enables live delivery.',
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (
          operation === 'update' &&
          ['purpose', 'template', 'hours', 'timeZone'].some(
            (key) => data[key] !== undefined && data[key] !== originalDoc[key],
          )
        )
          return { ...data, approvedForTests: false, revision: originalDoc.revision + 1 }
        return { ...data, revision: operation === 'create' ? 1 : originalDoc.revision }
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 120 },
    { name: 'purpose', type: 'select', options: [...purposes], required: true },
    relation('template', 'email-templates', true),
    {
      name: 'hours',
      type: 'number',
      required: true,
      min: 1,
      max: 8760,
      admin: {
        description:
          'Elapsed hours after a proposal, or before the confirmed session. These are not business days.',
      },
    },
    {
      name: 'timeZone',
      type: 'text',
      required: true,
      validate: (value: string | null | undefined) => {
        try {
          validTimeZone(value || '')
          return true
        } catch {
          return 'Enter a valid IANA timezone.'
        }
      },
      admin: { description: 'Explicit IANA timezone for the planned-message display.' },
    },
    {
      name: 'approvedForTests',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'I reviewed the wording and elapsed-hour timing for test planning only.',
      },
    },
    {
      name: 'revision',
      type: 'number',
      defaultValue: 1,
      required: true,
      admin: { readOnly: true },
    },
  ],
}

export const IncomingReplies: CollectionConfig = {
  slug: 'incoming-replies',
  versions: false,
  access: privateRecords,
  admin: {
    group: 'Email',
    useAsTitle: 'summary',
    description:
      'Simulation or explicitly verified provenance. Real receiving remains unconfigured.',
  },
  fields: [
    { name: 'eventKey', type: 'text', required: true, unique: true, admin: { hidden: true } },
    { name: 'summary', type: 'text', required: true },
    relation('contact', 'contacts'),
    relation('enquiry', 'enquiries'),
    {
      name: 'source',
      type: 'select',
      required: true,
      options: ['simulation', 'verified_provider'],
    },
    { name: 'state', type: 'select', required: true, options: ['matched', 'review'] },
    { name: 'occurredAt', type: 'date', required: true },
    { name: 'text', type: 'textarea', maxLength: 3000 },
    { name: 'reviewReason', type: 'text' },
  ],
}
