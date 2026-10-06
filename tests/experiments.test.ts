import { expect, test } from 'vitest'
import { chooseVariant, experimentsEnabled } from '../src/experiments/server'
import { conversionInterval } from '../src/experiments/domain'
import { readPreferences, seal, preferenceCookie } from '../src/inquiries/privacy'

test('stable bucketing spans both configured variants without using contact data', () => {
  const variants = new Set(Array.from({ length: 100 }, (_, i) => chooseVariant(14, String(i), 50)))
  expect([...variants].sort()).toEqual(['control', 'treatment'])
  expect(chooseVariant(14, 'synthetic-browser', 25)).toBe(
    chooseVariant(14, 'synthetic-browser', 25),
  )
  expect(experimentsEnabled()).toBe(false)
})
test('zero and tiny samples keep descriptive uncertainty and never claim a winner', () => {
  expect(conversionInterval(0, 0)).toBeNull()
  expect(conversionInterval(0, 1)).toMatchObject({ rate: 0, lower: 0 })
  expect(conversionInterval(1, 1)?.lower).toBeCloseTo(0.20655, 4)
  expect(conversionInterval(50, 100)?.upper).toBeCloseTo(0.59617, 4)
  expect(conversionInterval(0, 1)?.upper).toBeGreaterThan(0.79)
})
test('older analytics consent never grants experiment consent', () => {
  process.env.PAYLOAD_SECRET = 'synthetic-unit-test-experiment-signing-only'
  expect(
    readPreferences(
      seal(preferenceCookie, { analytics: true, campaigns: true, decided: true }, 100),
    ).experiments,
  ).toBe(false)
})
