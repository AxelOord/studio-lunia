import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { renderEmail, syntheticEmailVariables } from '../src/customer-records/email-renderer'
import { deliveryState, verifyDelivery, type DeliveryKind } from '../src/customer-records/webhook'

test('email renderer escapes content, resolves only allowed variables and shares exact preview/send output', () => {
  const rendered = renderEmail(
    'Hello {{contact_name}}',
    'Service: {{service_title}}\n\n<script>alert(1)</script>',
    { ...syntheticEmailVariables, contact_name: 'Synthetic <Visitor>' },
  )
  assert.equal(rendered.subject, 'Hello Synthetic <Visitor>')
  assert.ok(rendered.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(!rendered.html.includes('<script>'))
  assert.deepEqual(Object.keys(rendered.variables).sort(), ['contact_name', 'service_title'])
  for (const [subject, body, vars] of [
    ['Hello', '{{unknown}}', {}],
    ['Hello', '{{session_time}}', {}],
    ['Hello {{contact_name}}', 'Body', { contact_name: 'bad\r\nheader' }],
    ['Hello', '{{contact_name}}', { contact_name: 'bad\u0000body' }],
    ['Hello', '{{unfinished', {}],
  ] as const)
    assert.throws(() => renderEmail(subject, body, vars))
})
test('verifies the official Svix raw-body fixture without parsing before verification', () => {
  const headers = new Headers({
    'svix-id': 'msg_loFOjxBNrRLzqYUf',
    'svix-timestamp': '1731705121',
    'svix-signature': 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=',
  })
  const raw = '{"event_type":"ping","data":{"success":true}}'
  const secret = 'whsec_plJ3nmyCDGBKInavdOK15jsl'
  assert.equal(verifyDelivery(raw, headers, secret, 1731705121000), undefined)
  assert.throws(() => verifyDelivery(raw + ' ', headers, secret, 1731705121000))
  assert.throws(() => verifyDelivery(raw, headers, secret, 1731705432000))
  assert.throws(() => verifyDelivery(raw, headers, 'whsec_bm90LWEtcmVhbC1zZWNyZXQ=', 1731705121000))
})
test('signed delivery parsing retains minimal facts and ignores provider contact fields', () => {
  const secret = Buffer.alloc(24, 7)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const id = 'msg_synthetic_signed'
  const raw = JSON.stringify({
    type: 'email.delivered',
    created_at: new Date(Number(timestamp) * 1000).toISOString(),
    data: {
      email_id: 'synthetic_provider_id',
      to: ['private@example.test'],
      from: 'sender@example.test',
      subject: 'Private subject',
      tags: { lunia_message: 'lunia-message-00000000-0000-4000-8000-000000000000' },
    },
  })
  const signature = createHmac('sha256', secret)
    .update(`${id}.${timestamp}.${raw}`)
    .digest('base64')
  const headers = new Headers({
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
  })
  const fact = verifyDelivery(raw, headers, `whsec_${secret.toString('base64')}`)!
  assert.deepEqual(Object.keys(fact).sort(), [
    'eventId',
    'kind',
    'messageKey',
    'occurredAt',
    'providerId',
  ])
  assert.ok(!JSON.stringify(fact).includes('example.test'))
  headers.set('svix-signature', 'v2,' + signature)
  assert.throws(() => verifyDelivery(raw, headers, `whsec_${secret.toString('base64')}`))
})
test('delivery state is independent of arrival order and repeated terminal facts', () => {
  const fact = (kind: DeliveryKind, second: number) => ({
    kind,
    occurredAt: new Date(1700000000000 + second * 1000).toISOString(),
  })
  const facts = [
    fact('email.delivered', 2),
    fact('email.sent', 0),
    fact('email.delivery_delayed', 1),
  ]
  assert.equal(deliveryState(facts), 'delivered')
  assert.equal(deliveryState([...facts].reverse()), 'delivered')
  assert.equal(deliveryState([...facts, fact('email.bounced', 3)]), 'bounced')
  assert.equal(deliveryState([...facts, fact('email.failed', 2)]), 'failed')
  assert.equal(
    deliveryState([...facts, fact('email.failed', 1), fact('email.delivered', 2)]),
    'delivered',
  )
  assert.equal(deliveryState([fact('email.suppressed', 0), ...facts]), 'bounced')
})
