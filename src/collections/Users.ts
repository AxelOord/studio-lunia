import { APIError, type CollectionConfig } from 'payload'
import { editors } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: { maxLoginAttempts: 5, lockTime: 600000, tokenExpiration: 7200 },
  admin: { useAsTitle: 'email' },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: editors,
    read: editors,
    update: editors,
    delete: editors,
  },
  hooks: {
    beforeChange: [
      ({ req, context, operation, data }) => {
        // Payload first-register bypasses collection access; close that path too.
        if (operation === 'create' && !req.user && context.bootstrap !== true) {
          throw new APIError('Use the local bootstrap command to create the first editor.', 403)
        }
        return data
      },
    ],
  },
  fields: [],
}
