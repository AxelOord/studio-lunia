import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { previewEmail } from '../src/hosting/email'

test('Resend adapter sends only to the approved editor and hides provider error details', async () => {
  const previous = { ...process.env }
  const originalFetch = globalThis.fetch
  process.env.RESEND_API_KEY = 'synthetic-resend-key'
  process.env.MAIL_FROM = 'preview@example.test'
  process.env.PREVIEW_EDITOR_EMAIL = 'editor@example.test'
  let calls = 0
  try {
    globalThis.fetch = async (url, init) => {
      calls++
      assert.equal(url, 'https://api.resend.com/emails')
      const data = JSON.parse(String(init?.body))
      assert.equal(data.to, 'editor@example.test')
      return Response.json({ id: 'synthetic-message-id' })
    }
    const adapter = previewEmail()({ payload: {} as Payload })
    await adapter.sendEmail({ to: 'editor@example.test', subject: 'Test', html: 'Synthetic' })
    await assert.rejects(adapter.sendEmail({ to: 'other@example.test', subject: 'Test' }))
    await assert.rejects(
      adapter.sendEmail({ to: 'editor@example.test', bcc: 'other@example.test', subject: 'Test' }),
    )
    assert.equal(calls, 1)
    globalThis.fetch = async () => new Response('synthetic-provider-secret', { status: 500 })
    await assert.rejects(
      adapter.sendEmail({ to: 'editor@example.test', subject: 'Test' }),
      (error) => error instanceof Error && error.message === 'Preview email delivery failed.',
    )
  } finally {
    globalThis.fetch = originalFetch
    for (const name of ['RESEND_API_KEY', 'MAIL_FROM', 'PREVIEW_EDITOR_EMAIL']) {
      if (previous[name] === undefined) delete process.env[name]
      else process.env[name] = previous[name]
    }
  }
})
