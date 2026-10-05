import { APIError, type CollectionConfig } from 'payload'
import { editors } from '../access'
import { cmsOrigin, resetEmail } from '../hosting/environment'
import { limitOperation } from '../hosting/rate-limit'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    maxLoginAttempts: 5,
    lockTime: 600000,
    tokenExpiration: 7200,
    cookies: { secure: Boolean(process.env.VERCEL), sameSite: 'Lax' },
    forgotPassword: {
      expiration: 15 * 60 * 1000,
      minRequestInterval: 60 * 1000,
      generateEmailHTML: ({ token } = {}) => resetEmail(cmsOrigin(), token || ''),
      generateEmailSubject: () => 'Reset your Studio Lunia preview password',
    },
  },
  admin: { useAsTitle: 'email' },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: editors,
    read: editors,
    update: editors,
    delete: editors,
  },
  hooks: {
    beforeOperation: [
      async ({ operation, args }) => {
        if (
          operation === 'resetPassword' &&
          'data' in args &&
          args.data &&
          'password' in args.data &&
          (typeof args.data.password !== 'string' || args.data.password.length < 16)
        )
          throw new APIError('Use a password of at least 16 characters.', 400)
        if (
          process.env.LUNIA_CMS_PREVIEW === 'true' &&
          ['login', 'forgotPassword', 'resetPassword'].includes(operation)
        ) {
          await limitOperation('auth-global', operation, 100)
          const data = 'data' in args ? args.data : undefined
          const email =
            data && 'email' in data && typeof data.email === 'string'
              ? data.email.trim().toLowerCase()
              : 'reset'
          await limitOperation(operation, email, 10)
        }
        return args
      },
    ],
    beforeChange: [
      ({ req, context, operation, data }) => {
        // Payload first-register bypasses collection access; close that path too.
        if (operation === 'create' && !req.user && context.bootstrap !== true) {
          throw new APIError('Use the approved bootstrap process to create the first editor.', 403)
        }
        if (data.password && data.password.length < 16)
          throw new APIError('Use a password of at least 16 characters.', 400)
        if (
          process.env.LUNIA_CMS_PREVIEW === 'true' &&
          data.email &&
          data.email.toLowerCase() !== process.env.PREVIEW_EDITOR_EMAIL?.toLowerCase()
        )
          throw new APIError('This preview allows only the approved editor.', 403)
        return data
      },
    ],
  },
  fields: [],
}
