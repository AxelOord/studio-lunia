import { APIError, type CollectionConfig } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { editors } from '../access'
import { relationID, transactionDB } from '../customer-records/core'
import { publishedServices } from '../inquiries/services'
import { experimentRead } from '../experiments/server'
import { originalLabel } from '../experiments/domain'

const planFields = [
  'name',
  'hypothesis',
  'page',
  'mode',
  'treatmentLabel',
  'treatmentPercent',
  'baseline',
  'trafficPlan',
  'minimumPerVariant',
  'durationDays',
] as const

export const Experiments: CollectionConfig = {
  slug: 'experiments',
  versions: false, // Operational plan lifecycle; never public CMS content.
  admin: {
    group: 'Measurement',
    useAsTitle: 'name',
    defaultColumns: ['name', 'mode', 'state', 'updatedAt'],
    description:
      'Plan a service landing CTA test. Simulation is the default. Live delivery stays separately disabled. Once prepared, the plan is immutable; duplicate to revise.',
  },
  access: {
    read: ({ req }) => req.context.experimentRead === experimentRead || Boolean(req.user),
    create: editors,
    update: editors,
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req, operation }) => {
        // Re-read under the same transaction lock so concurrent edits cannot mutate a frozen plan.
        let previous = operation === 'update' ? originalDoc : undefined
        if (operation === 'update') {
          const db = await transactionDB(req)
          await db.execute(sql`SELECT id FROM experiments WHERE id = ${originalDoc.id} FOR UPDATE`)
          previous = await req.payload.findByID({
            collection: 'experiments',
            id: originalDoc.id,
            req,
            overrideAccess: false,
            depth: 0,
          })
        }
        if (previous?.state !== 'draft' && previous) {
          for (const field of planFields) {
            const before = field === 'page' ? relationID(previous[field]) : previous[field]
            const after = field === 'page' ? relationID(data[field]) : data[field]
            if (data[field] !== undefined && before !== after)
              throw new APIError(
                'This plan is frozen. Duplicate the experiment to change its design.',
                422,
              )
          }
          if (
            data.state &&
            data.state !== previous.state &&
            !(previous.state === 'ready' && data.state === 'stopped')
          )
            throw new APIError('A prepared experiment can only be stopped; it cannot restart.', 422)
        }
        data.controlLabel = previous?.controlLabel || originalLabel
        data.service = previous?.service || null
        data.preparedAt = previous?.preparedAt || null
        data.stoppedAt =
          previous?.stoppedAt || (data.state === 'stopped' ? new Date().toISOString() : null)
        if (data.state === 'ready' && previous?.state !== 'ready') {
          const input = { ...previous, ...data }
          if (previous && previous.state !== 'draft')
            throw new APIError('Stopped experiments cannot restart.', 422)
          if (!input.baseline?.trim() || !input.trafficPlan?.trim())
            throw new APIError(
              'Record the baseline and traffic/sample rationale before preparing.',
              422,
            )
          const page = await req.payload.findByID({
            collection: 'pages',
            id: relationID(input.page)!,
            req,
            overrideAccess: false,
            draft: false,
            depth: 0,
          })
          if (
            page._status !== 'published' ||
            !page.inquiryService ||
            !(await publishedServices(req.payload, req)).some((s) => s.id === page.inquiryService)
          )
            throw new APIError('Choose a published landing with an available service.', 422)
          data.controlLabel = page.inquiryButtonLabel || originalLabel
          if (input.treatmentLabel.trim() === data.controlLabel)
            throw new APIError('The alternate CTA must differ from the original.', 422)
          data.service = page.inquiryService
          data.preparedAt = new Date().toISOString()
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 100 },
    { name: 'hypothesis', type: 'textarea', required: true, maxLength: 1000 },
    {
      name: 'page',
      type: 'relationship',
      relationTo: 'pages',
      required: true,
      filterOptions: { _status: { equals: 'published' } },
    },
    {
      name: 'mode',
      type: 'select',
      required: true,
      defaultValue: 'simulation',
      options: ['simulation', 'live'],
    },
    {
      name: 'state',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft plan', value: 'draft' },
        { label: 'Prepared (runtime gate still applies)', value: 'ready' },
        { label: 'Stopped permanently', value: 'stopped' },
      ],
    },
    {
      name: 'controlLabel',
      label: 'Control CTA (snapshot of published original)',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'treatmentLabel',
      label: 'Alternate CTA',
      type: 'text',
      required: true,
      maxLength: 70,
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)],
      },
    },
    {
      name: 'treatmentPercent',
      label: 'Alternate allocation (%)',
      type: 'number',
      required: true,
      min: 1,
      max: 99,
      defaultValue: 50,
      validate: (v: unknown) => Number.isInteger(v) || 'Use a whole percentage.',
    },
    {
      name: 'baseline',
      type: 'textarea',
      maxLength: 2000,
      admin: {
        description:
          'Record measured baseline, period and consent coverage. Simulation may use explicitly synthetic assumptions.',
      },
    },
    {
      name: 'trafficPlan',
      type: 'textarea',
      maxLength: 2000,
      admin: {
        description:
          'Audience: consenting browsers on this exact published landing. Outcome: saved enquiry within 30 days of exposure. Record minimum detectable effect, sample rationale and stopping/review plan; thresholds do not prove significance.',
      },
    },
    {
      name: 'minimumPerVariant',
      type: 'number',
      required: true,
      min: 1,
      max: 10000000,
      defaultValue: 1000,
      validate: (v: unknown) => Number.isInteger(v) || 'Use a whole count.',
    },
    {
      name: 'durationDays',
      type: 'number',
      required: true,
      min: 1,
      max: 365,
      defaultValue: 14,
      validate: (v: unknown) => Number.isInteger(v) || 'Use whole days.',
    },
    { name: 'service', type: 'text', admin: { hidden: true } },
    { name: 'preparedAt', type: 'date', admin: { readOnly: true } },
    { name: 'stoppedAt', type: 'date', admin: { readOnly: true } },
  ],
}
