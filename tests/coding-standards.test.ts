import { test } from 'vitest'
import assert from 'node:assert/strict'
import { ESLint } from 'eslint'

test('lint rejects database imports in UI code but permits shared types and rendering', async () => {
  const eslint = new ESLint()
  for (const source of [
    'payload',
    'pg',
    '@payload-config',
    '@/customer-records/mail',
    '../inquiries/privacy',
  ]) {
    const [result] = await eslint.lintText(
      `'use client'\nimport value from '${source}'\nexport { value }\n`,
      { filePath: 'src/admin/BookingActions.tsx' },
    )
    assert.ok(
      result.messages.some((message) => message.ruleId === 'no-restricted-imports'),
      source,
    )
  }
  const [allowed] = await eslint.lintText(
    "import type { Payload } from 'payload'\nexport type ClientTypes = Pick<Payload, 'config'>\n",
    { filePath: 'src/admin/BookingActions.tsx' },
  )
  assert.equal(
    allowed.messages.some((message) => message.ruleId === 'no-restricted-imports'),
    false,
  )
})

test('lint rejects an unobserved promise in application code and accepts an awaited operation', async () => {
  const eslint = new ESLint()
  const [unsafe] = await eslint.lintText('export function save() { Promise.resolve(1) }', {
    filePath: 'src/customer-records/operations.ts',
  })
  assert.ok(
    unsafe.messages.some((message) => message.ruleId === '@typescript-eslint/no-floating-promises'),
  )
  const [safe] = await eslint.lintText(
    'export async function save() { return await Promise.resolve(1) }',
    { filePath: 'src/customer-records/operations.ts' },
  )
  assert.equal(
    safe.messages.some((message) => message.ruleId === '@typescript-eslint/no-floating-promises'),
    false,
  )
})
