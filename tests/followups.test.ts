import { test, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { plannedInstant, timeCandidates } from '../src/followups/domain'
import { verifiedIncomingNotice } from '../src/followups/inbound'

test('timezone resolution rejects clock gaps and requires an explicit repeated-time choice', () => {
  expect(() => plannedInstant('2026-03-29T02:30', 'Europe/Amsterdam')).toThrow('does not exist')
  expect(() => plannedInstant('2026-10-25T02:30', 'Europe/Amsterdam')).toThrow('occurs twice')
  expect(timeCandidates('2026-10-25T02:30', 'Europe/Amsterdam')).toEqual([
    { instant: '2026-10-25T00:30:00.000Z', offset: 120 },
    { instant: '2026-10-25T01:30:00.000Z', offset: 60 },
  ])
  expect(plannedInstant('2026-10-25T02:30', 'Europe/Amsterdam', 60)).toBe(
    '2026-10-25T01:30:00.000Z',
  )
  expect(plannedInstant('2026-10-25T12:30', 'Asia/Kathmandu')).toBe('2026-10-25T06:45:00.000Z')
  expect(() => plannedInstant('2026-02-30T10:00', 'UTC')).toThrow('calendar')
  expect(() => plannedInstant('2026-10-25T12:30', 'Invalid/Zone')).toThrow('timezone')
})
test('signed receiving notification is minimized and remains review-only; forged, expired and oversized events fail', () => {
  const now = Date.now()
  const key = Buffer.alloc(32, 7)
  const secret = `whsec_${key.toString('base64')}`
  const timestamp = String(Math.floor(now / 1000))
  const id = 'msg_synthetic_12345'
  const raw = JSON.stringify({
    type: 'email.received',
    created_at: new Date(now).toISOString(),
    data: {
      email_id: 'synthetic-email-123',
      from: 'private@example.test',
      subject: 'Private message',
      text: 'Must not be retained by the notification parser',
    },
  })
  const headers = new Headers({
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest('base64')}`,
  })
  const notice = verifiedIncomingNotice(raw, headers, secret, now)
  expect(notice?.state).toBe('review')
  expect(JSON.stringify(notice)).not.toMatch(/private@example|Private message|Must not/)
  expect(verifiedIncomingNotice(raw, headers, secret, now)).toEqual(notice)
  expect(() => verifiedIncomingNotice(raw + ' ', headers, secret, now)).toThrow('signature')
  expect(() => verifiedIncomingNotice(raw, headers, secret, now + 301000)).toThrow('signature')
  expect(() => verifiedIncomingNotice('x'.repeat(32001), headers, secret, now)).toThrow('large')
})
