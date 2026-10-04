import { resendAdapter } from '@payloadcms/email-resend'
import type { EmailAdapter } from 'payload'

export function previewEmail(): EmailAdapter {
  const resend = resendAdapter({
    defaultFromAddress: process.env.MAIL_FROM!,
    defaultFromName: 'Studio Lunia preview',
    apiKey: process.env.RESEND_API_KEY!,
  })
  return (args) => {
    const adapter = resend(args)
    return {
      ...adapter,
      async sendEmail(message) {
        // Never redirect another user's reset token to the approved mailbox.
        if (
          typeof message.to !== 'string' ||
          message.to.toLowerCase() !== process.env.PREVIEW_EDITOR_EMAIL!.toLowerCase() ||
          message.cc ||
          message.bcc
        )
          throw new Error('Preview email recipient is not approved.')
        try {
          return await adapter.sendEmail(message)
        } catch {
          throw new Error('Preview email delivery failed.')
        }
      },
    }
  }
}
