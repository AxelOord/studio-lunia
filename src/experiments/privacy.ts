import { randomUUID } from 'node:crypto'
import { cookies, draftMode } from 'next/headers'
import type { Payload } from 'payload'
import { readPreferences, preferenceCookie, seal, unseal } from '../inquiries/privacy'
import { uuidPattern } from '../lib/inquiry'
import { experimentCookie, simulationCookie, experimentDays } from './domain'
import { revokeExperimentVisitor, type ExperimentVisitor, type ExperimentContext } from './server'

export function readExperimentVisitor(raw?: string): ExperimentVisitor | undefined {
  const value = unseal(experimentCookie, raw) as ExperimentVisitor | undefined
  if (
    value &&
    uuidPattern.test(value.id) &&
    Number.isFinite(value.expiresAt) &&
    value.expiresAt > Date.now() &&
    value.expiresAt <= Date.now() + experimentDays * 86400000
  )
    return value
}
export async function experimentContext(
  payload: Payload,
  request: Request,
): Promise<ExperimentContext> {
  const jar = await cookies()
  if (
    !readPreferences(jar.get(preferenceCookie)?.value).experiments ||
    (await draftMode()).isEnabled
  )
    return {}
  const visitor = readExperimentVisitor(jar.get(experimentCookie)?.value)
  if (!visitor) return {}
  const selected = unseal(simulationCookie, jar.get(simulationCookie)?.value)
  const simulation =
    typeof selected === 'number' && Number.isSafeInteger(selected) && selected > 0
      ? selected
      : undefined
  const { user } = await payload.auth({ headers: request.headers })
  return { visitor, simulation, user }
}
export async function saveExperimentConsent(payload: Payload, allowed: boolean, request: Request) {
  const jar = await cookies()
  const previous = readExperimentVisitor(jar.get(experimentCookie)?.value)
  if (!allowed) {
    if (previous) await revokeExperimentVisitor(payload, previous)
    jar.delete(experimentCookie)
  } else if (!previous) {
    const ttl = experimentDays * 86400
    jar.set(
      experimentCookie,
      seal(experimentCookie, { id: randomUUID(), expiresAt: Date.now() + ttl * 1000 }, ttl),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: new URL(request.url).protocol === 'https:',
        path: '/',
        maxAge: ttl,
      },
    )
  }
}
