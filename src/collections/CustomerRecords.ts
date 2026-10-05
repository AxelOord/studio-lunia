import type { CollectionConfig, Field } from 'payload'
import { editors } from '../access'
import { internalWrite } from '../customer-records/core'
import { updateFollowUps } from '../followups/hooks'
import { contactActivity } from '../customer-records/hooks'

const no = () => false
const privateRead = {
  read: ({ req }: Parameters<typeof internalWrite>[0]) =>
    Boolean(req.user) || internalWrite({ req }),
  create: internalWrite,
  update: no,
  delete: no,
}
const relation = (
  name: string,
  relationTo: 'contacts' | 'enquiries' | 'bookings' | 'email-messages' | 'users',
  required = false,
): Field => ({ name, type: 'relationship', relationTo, required, index: true })
const ui = (name: string, component: string): Field => ({
  name,
  type: 'ui',
  admin: { components: { Field: component } },
})
export const Contacts: CollectionConfig = {
  slug: 'contacts',
  versions: false,
  access: {
    read: privateRead.read,
    create: ({ req }) => Boolean(req.user) || internalWrite({ req }),
    update: editors,
    delete: no,
  },
  hooks: { afterChange: [contactActivity] },
  admin: {
    group: 'Customers',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'updatedAt'],
    listSearchableFields: ['name', 'email'],
    description: 'Private contact records. Matching email addresses are not automatically merged.',
    components: { beforeList: ['./admin/CustomerFilters#CustomerFilters'] },
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 100 },
    { name: 'email', type: 'email', required: true, index: true },
    { name: 'phone', type: 'text', maxLength: 60 },
    {
      name: 'notes',
      type: 'textarea',
      maxLength: 3000,
      admin: {
        description: 'Private operational notes. Do not record sensitive personal information.',
      },
    },
    {
      name: 'sourceKey',
      type: 'text',
      unique: true,
      access: { create: internalWrite, update: no },
      admin: { hidden: true },
    },
    {
      name: 'followUpsStopped',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Stops every planned follow-up for this customer, including test simulations.',
      },
    },
    ui('activityView', './admin/CustomerTimeline#CustomerTimeline'),
  ],
}
export const Bookings: CollectionConfig = {
  slug: 'bookings',
  versions: false,
  access: { ...privateRead, update: internalWrite },
  admin: {
    group: 'Customers',
    useAsTitle: 'title',
    defaultColumns: ['title', 'contact', 'status', 'sessionAt', 'expectedMinor', 'currency'],
    description:
      'Staff-led proposals and confirmed records. No calendar capacity or online payment is created.',
  },
  fields: (
    [
      { name: 'title', type: 'text', required: true, maxLength: 160 },
      relation('contact', 'contacts', true),
      relation('enquiry', 'enquiries', true),
      {
        name: 'source',
        type: 'select',
        required: true,
        options: ['staff_enquiry'],
        defaultValue: 'staff_enquiry',
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        options: ['proposed', 'confirmed', 'completed', 'cancelled'],
        defaultValue: 'proposed',
        index: true,
      },
      { name: 'sessionAt', type: 'date', index: true },
      {
        name: 'expectedMinor',
        type: 'number',
        required: true,
        min: 0,
        admin: {
          description:
            'Expected value in minor currency units. Separate from money actually recorded.',
        },
      },
      { name: 'currency', type: 'text', required: true, maxLength: 3 },
      {
        name: 'attribution',
        type: 'json',
        required: true,
        admin: { components: { Field: './admin/PrivateJSON#PrivateJSON' } },
      },
      ui('bookingActions', './admin/BookingActions#BookingActions'),
    ] as Field[]
  ).map((field) =>
    'name' in field &&
    ['status', 'sessionAt', 'expectedMinor', 'currency'].includes(String(field.name))
      ? ({ ...field, admin: { ...field.admin, hidden: true } } as Field)
      : field,
  ),
}
export const RevenueEntries: CollectionConfig = {
  slug: 'revenue-entries',
  versions: false,
  access: privateRead,
  admin: {
    group: 'Customers',
    useAsTitle: 'label',
    defaultColumns: ['label', 'booking', 'kind', 'amountMinor', 'currency', 'occurredAt'],
    description:
      'Manual records only. Corrections append a reversal and replacement; no payment provider is called.',
  },
  fields: [
    { name: 'label', type: 'text', required: true },
    relation('booking', 'bookings', true),
    relation('contact', 'contacts', true),
    { name: 'kind', type: 'select', required: true, options: ['payment', 'refund', 'reversal'] },
    { name: 'amountMinor', type: 'number', required: true },
    { name: 'currency', type: 'text', required: true },
    { name: 'reverses', type: 'relationship', relationTo: 'revenue-entries', unique: true },
    { name: 'occurredAt', type: 'date', required: true },
    { name: 'reason', type: 'textarea', required: true, maxLength: 2000 },
    relation('actor', 'users'),
  ],
}
export const CustomerActivities: CollectionConfig = {
  slug: 'customer-activities',
  hooks: { afterChange: [updateFollowUps] },
  versions: false,
  access: privateRead,
  admin: {
    group: 'Customers',
    useAsTitle: 'summary',
    defaultColumns: ['summary', 'contact', 'source', 'occurredAt'],
    description: 'Dated private facts. Staff-reported replies are not an imported mailbox.',
  },
  fields: [
    relation('contact', 'contacts', true),
    relation('enquiry', 'enquiries'),
    relation('booking', 'bookings'),
    relation('emailMessage', 'email-messages'),
    relation('actor', 'users'),
    { name: 'kind', type: 'text', required: true, index: true },
    { name: 'summary', type: 'text', required: true, maxLength: 300 },
    {
      name: 'source',
      type: 'select',
      required: true,
      options: ['website', 'staff', 'provider', 'migration', 'system'],
    },
    { name: 'occurredAt', type: 'date', required: true, index: true },
    {
      name: 'details',
      type: 'json',
      admin: { components: { Field: './admin/PrivateJSON#PrivateJSON' } },
    },
  ],
}
