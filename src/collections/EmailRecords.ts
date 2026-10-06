import { APIError, type Field, type CollectionConfig } from 'payload'
import { editors } from '../access'
import { internalWrite } from '../customer-records/core'
import { renderEmail, syntheticEmailVariables } from '../customer-records/email-renderer'

const no = () => false
export const EmailTemplates: CollectionConfig = {
  slug: 'email-templates',
  versions: false,
  access: {
    read: ({ req }) => Boolean(req.user) || internalWrite({ req }),
    create: editors,
    update: editors,
    delete: no,
  },
  admin: {
    group: 'Email',
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'approved', 'updatedAt'],
    description:
      'Preview/edit never sends. Approval is for the wording; real-customer delivery remains disabled.',
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const contentChanged =
          originalDoc &&
          ['subject', 'body', 'kind'].some(
            (key) => data[key] !== undefined && data[key] !== originalDoc[key],
          )
        if (originalDoc?.approved && contentChanged) data.approved = false
        if (data.approved) {
          try {
            renderEmail(
              data.subject ?? originalDoc?.subject ?? '',
              data.body ?? originalDoc?.body ?? '',
              syntheticEmailVariables,
            )
          } catch (error) {
            throw new APIError(
              error instanceof Error ? error.message : 'Check template wording.',
              422,
            )
          }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 100 },
    { name: 'kind', type: 'select', required: true, options: ['enquiry', 'booking', 'follow_up'] },
    { name: 'subject', type: 'text', required: true, maxLength: 200 },
    {
      name: 'body',
      type: 'textarea',
      required: true,
      maxLength: 12000,
      admin: {
        description:
          'Plain text with allowed variables. HTML and external assets are not interpreted.',
      },
    },
    {
      name: 'approved',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'I have reviewed this wording. Changing approved content clears approval. Save the change, review it, then approve again.',
      },
    },
    {
      name: 'templatePreview',
      type: 'ui',
      admin: { components: { Field: './admin/EmailTemplatePreview#EmailTemplatePreview' } },
    },
  ],
}
export const EmailMessages: CollectionConfig = {
  slug: 'email-messages',
  versions: false,
  access: {
    read: ({ req }) => Boolean(req.user) || internalWrite({ req }),
    create: internalWrite,
    update: internalWrite,
    delete: no,
  },
  admin: {
    group: 'Email',
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'kind', 'status', 'contact', 'createdAt'],
    description:
      'Exact frozen content. Drafts are not scheduled; accepted is not delivered, and delivered is not read.',
  },
  fields: (
    [
      {
        name: 'contact',
        type: 'relationship',
        relationTo: 'contacts',
        required: true,
        index: true,
      },
      { name: 'enquiry', type: 'relationship', relationTo: 'enquiries', index: true },
      { name: 'booking', type: 'relationship', relationTo: 'bookings', index: true },
      { name: 'template', type: 'relationship', relationTo: 'email-templates' },
      {
        name: 'kind',
        type: 'select',
        required: true,
        options: ['customer_draft', 'sandbox_test', 'photographer_notification'],
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        defaultValue: 'draft',
        options: [
          'draft',
          'queued',
          'sending',
          'accepted',
          'delayed',
          'delivered',
          'bounced',
          'failed',
          'uncertain',
          'manual',
          'disabled',
        ],
        index: true,
      },
      { name: 'subject', type: 'text', required: true },
      { name: 'text', type: 'textarea', required: true },
      { name: 'html', type: 'textarea', required: true },
      {
        name: 'variables',
        type: 'json',
        required: true,
        admin: { components: { Field: './admin/PrivateJSON#PrivateJSON' } },
      },
      {
        name: 'templateSnapshot',
        type: 'json',
        required: true,
        admin: { components: { Field: './admin/PrivateJSON#PrivateJSON' } },
      },
      { name: 'recipient', type: 'email', required: true },
      { name: 'sender', type: 'text' },
      { name: 'providerPayload', type: 'json', admin: { hidden: true } },
      { name: 'idempotencyKey', type: 'text', unique: true, admin: { hidden: true } },
      { name: 'notificationKey', type: 'text', unique: true, admin: { hidden: true } },
      { name: 'providerId', type: 'text', unique: true, index: true },
      { name: 'attempts', type: 'number', required: true, defaultValue: 0 },
      { name: 'firstAttemptAt', type: 'date' },
      { name: 'lastAttemptAt', type: 'date' },
      { name: 'acceptedAt', type: 'date' },
      { name: 'deliveredAt', type: 'date' },
      {
        name: 'failureCode',
        type: 'text',
        admin: { description: 'Safe category only; arbitrary provider responses are not stored.' },
      },
      {
        name: 'messagePreview',
        type: 'ui',
        admin: { components: { Field: './admin/EmailMessagePreview#EmailMessagePreview' } },
      },
    ] as Field[]
  ).map((field) =>
    field.type === 'ui' || field.type === 'relationship'
      ? field
      : ({ ...field, admin: { ...field.admin, hidden: true } } as Field),
  ),
}
