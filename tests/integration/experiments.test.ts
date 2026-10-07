import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createEditor, createTestCMS } from '../helpers/payload'
import {
  assignExperiment,
  exposeExperiment,
  convertExperiment,
  experimentReport,
  revokeExperimentVisitor,
  retainExperimentVariant,
  visitorHash,
  type ExperimentContext,
} from '../../src/experiments/server'
import { submitInquiry } from '../../src/inquiries/submit'
import { denied } from '../../src/inquiries/privacy'
import { originalLabel } from '../../src/experiments/domain'

let fixture: Awaited<ReturnType<typeof createTestCMS>>
let user: Awaited<ReturnType<typeof createEditor>>
let pageID: number, service: string
beforeAll(async () => {
  fixture = await createTestCMS()
})
beforeEach(async () => {
  await fixture.reset()
  user = await createEditor(fixture.payload)
  const page = await fixture.payload.create({
    collection: 'pages',
    user,
    overrideAccess: false,
    data: {
      title: 'Synthetic experiment landing',
      slug: 'experiment-fixture',
      description: 'Synthetic only',
      _status: 'published',
      layout: [
        {
          blockType: 'services',
          heading: 'Synthetic offers',
          items: [{ title: 'Synthetic portrait', body: 'Synthetic service' }],
        },
      ],
    },
  })
  const block = page.layout[0]
  if (block.blockType !== 'services') throw new Error('Fixture is missing service')
  pageID = page.id
  service = `${page.id}:${block.items[0].id}`
  await fixture.payload.update({
    collection: 'pages',
    id: page.id,
    user,
    overrideAccess: false,
    data: { inquiryService: service, _status: 'published' },
  })
})
afterAll(async () => {
  await fixture?.close()
})
async function experiment(
  mode: 'simulation' | 'live' = 'simulation',
  state: 'draft' | 'ready' = 'ready',
) {
  return fixture.payload.create({
    collection: 'experiments',
    user,
    overrideAccess: false,
    data: {
      name: 'Synthetic CTA comparison',
      hypothesis: 'An explicit request CTA may increase saved enquiries.',
      page: pageID,
      mode,
      state,
      treatmentLabel: 'Share your session idea',
      treatmentPercent: 50,
      baseline: 'Synthetic 10% baseline only.',
      trafficPlan: 'Synthetic 1000 exposures per variant and 14 days; never a launch decision.',
      minimumPerVariant: 1000,
      durationDays: 14,
    },
  })
}
function browser(id: number): ExperimentContext {
  return { simulation: id, user, visitor: { id: randomUUID(), expiresAt: Date.now() + 86400000 } }
}
async function report() {
  return (await experimentReport(fixture.payload, user)).experiments[0]
}

test('authoring stays private and disabled, requires published eligibility, and freezes plans under concurrent changes', async () => {
  const { payload } = fixture
  await expect(
    payload.create({
      collection: 'experiments',
      overrideAccess: false,
      data: { name: 'Denied' } as never,
    }),
  ).rejects.toThrow()
  await expect(
    payload.find({ collection: 'experiments', overrideAccess: false }),
  ).rejects.toMatchObject({ status: 403 })
  const live = await experiment('live')
  expect(await assignExperiment(payload, { visitor: browser(live.id).visitor }, pageID)).toBeNull()
  await expect(experiment('live')).rejects.toThrow()
  const draft = await experiment('simulation', 'draft')
  await expect(
    payload.update({
      collection: 'experiments',
      id: draft.id,
      user,
      overrideAccess: false,
      data: { treatmentLabel: '   ' },
    }),
  ).rejects.toThrow()
  await payload.update({
    collection: 'experiments',
    id: draft.id,
    user,
    overrideAccess: false,
    data: { baseline: '' },
  })
  await expect(
    payload.update({
      collection: 'experiments',
      id: draft.id,
      user,
      overrideAccess: false,
      data: { state: 'ready' },
    }),
  ).rejects.toThrow('baseline')
  await payload.update({
    collection: 'experiments',
    id: draft.id,
    user,
    overrideAccess: false,
    data: { baseline: 'Synthetic baseline' },
  })
  const edits = await Promise.allSettled([
    payload.update({
      collection: 'experiments',
      id: draft.id,
      user,
      overrideAccess: false,
      data: { state: 'ready' },
    }),
    payload.update({
      collection: 'experiments',
      id: draft.id,
      user,
      overrideAccess: false,
      data: { treatmentLabel: 'Another proposed CTA' },
    }),
  ])
  expect(edits.some((result) => result.status === 'fulfilled')).toBe(true)
  const prepared = await payload.findByID({
    collection: 'experiments',
    id: draft.id,
    user,
    overrideAccess: false,
  })
  expect(prepared.state).toBe('ready')
  await expect(
    payload.update({
      collection: 'experiments',
      id: draft.id,
      user,
      overrideAccess: false,
      data: { treatmentPercent: 60 },
    }),
  ).rejects.toThrow('frozen')
  await expect(
    payload.delete({ collection: 'experiments', id: draft.id, user, overrideAccess: false }),
  ).rejects.toThrow()
})
test('stable assignment, visibility acknowledgement and durable outcomes deduplicate across concurrent retries', async () => {
  const { payload } = fixture,
    plan = await experiment(),
    context = browser(plan.id)
  const assignments = await Promise.all(
    Array.from({ length: 8 }, () => assignExperiment(payload, context, pageID)),
  )
  expect(assignments.every((a) => JSON.stringify(a) === JSON.stringify(assignments[0]))).toBe(true)
  expect(assignments[0]?.label).toBeTruthy()
  await convertExperiment(payload, context, service, true)
  expect((await report()).variants.reduce((n, v) => n + v.converted, 0)).toBe(0)
  await Promise.all(
    Array.from({ length: 8 }, () => exposeExperiment(payload, context, plan.id, pageID)),
  )
  const input = {
    service,
    name: 'PrivateExperimentMarker',
    email: 'experiment@example.test',
    message: 'PrivateMessageMarker synthetic enquiry.',
    website: '',
    submissionId: randomUUID(),
  }
  const submissions = await Promise.all(
    Array.from({ length: 3 }, () => submitInquiry(payload, input, denied)),
  )
  expect(submissions.filter((r) => r.created)).toHaveLength(1)
  await Promise.all(
    submissions.map((r) => convertExperiment(payload, context, service, r.created === true)),
  )
  const row = (await report()).variants.find((v) => v.variant === assignments[0]!.variant)!
  expect(row).toMatchObject({ assigned: 1, exposed: 1, converted: 1 })
  expect(row.interval?.lower).toBeLessThan(0.21)
  expect((await report()).thresholdsMet).toBe(false)
  expect(JSON.stringify(await report())).not.toMatch(
    /PrivateExperimentMarker|PrivateMessageMarker|example.test|visitor_key/,
  )
})

test('withdrawal serializes with exposure and rejects stale-cookie retries; regrant is a separate browser identity', async () => {
  const { payload } = fixture,
    plan = await experiment(),
    context = browser(plan.id)
  await assignExperiment(payload, context, pageID)
  await Promise.all([
    exposeExperiment(payload, context, plan.id, pageID),
    revokeExperimentVisitor(payload, context.visitor!),
  ])
  expect(await assignExperiment(payload, context, pageID)).toBeNull()
  await exposeExperiment(payload, context, plan.id, pageID)
  await convertExperiment(payload, context, service, true)
  expect((await report()).variants.reduce((n, v) => n + v.converted, 0)).toBe(0)
  expect(await assignExperiment(payload, browser(plan.id), pageID)).not.toBeNull()
  const first = browser(plan.id)
  await Promise.all([
    assignExperiment(payload, first, pageID),
    revokeExperimentVisitor(payload, first.visitor!),
  ])
  expect(await assignExperiment(payload, first, pageID)).toBeNull()
})
test('no consent, expired identity, missing staff, mismatched service and unpublished or changed landings fail closed', async () => {
  const { payload } = fixture,
    plan = await experiment(),
    context = browser(plan.id)
  expect(await assignExperiment(payload, { simulation: plan.id, user }, pageID)).toBeNull()
  expect(await assignExperiment(payload, { ...context, user: null }, pageID)).toBeNull()
  expect(
    await assignExperiment(
      payload,
      { ...context, visitor: { ...context.visitor!, expiresAt: Date.now() - 1 } },
      pageID,
    ),
  ).toBeNull()
  await assignExperiment(payload, context, pageID)
  await exposeExperiment(payload, context, plan.id, pageID)
  await convertExperiment(payload, context, service + 'wrong', true)
  await convertExperiment(payload, context, service, false)
  expect((await report()).variants.reduce((n, v) => n + v.converted, 0)).toBe(0)
  await payload.update({
    collection: 'pages',
    id: pageID,
    user,
    overrideAccess: false,
    draft: true,
    data: { inquiryButtonLabel: 'Private draft marker' },
  })
  expect((await assignExperiment(payload, context, pageID))?.label).not.toBe('Private draft marker')
  await payload.update({
    collection: 'pages',
    id: pageID,
    user,
    overrideAccess: false,
    data: { inquiryButtonLabel: 'Changed public control', _status: 'published' },
  })
  expect(await assignExperiment(payload, context, pageID)).toBeNull()
  await payload.update({
    collection: 'pages',
    id: pageID,
    user,
    overrideAccess: false,
    data: { inquiryButtonLabel: originalLabel, _status: 'draft' },
  })
  expect(await assignExperiment(payload, context, pageID)).toBeNull()
})
test('30-day outcome window is enforced and stopped tests cannot record or restart', async () => {
  const { payload } = fixture,
    plan = await experiment(),
    context = browser(plan.id)
  await assignExperiment(payload, context, pageID)
  await exposeExperiment(payload, context, plan.id, pageID)
  await payload.db.pool.query(
    "UPDATE lunia_experiment_enrollments SET exposed_at=now()-interval '31 days' WHERE visitor_key=$1",
    [visitorHash(context.visitor!)],
  )
  await convertExperiment(payload, context, service, true)
  expect((await report()).variants.reduce((n, v) => n + v.converted, 0)).toBe(0)
  const fresh = browser(plan.id)
  await assignExperiment(payload, fresh, pageID)
  await exposeExperiment(payload, fresh, plan.id, pageID)
  const stopped = await payload.update({
    collection: 'experiments',
    id: plan.id,
    user,
    overrideAccess: false,
    data: { state: 'stopped' },
  })
  expect(stopped.stoppedAt).toBeTruthy()
  await convertExperiment(payload, fresh, service, true)
  expect((await report()).variants.reduce((n, v) => n + v.converted, 0)).toBe(0)
  const unchanged = await payload.update({
    collection: 'experiments',
    id: plan.id,
    user,
    overrideAccess: false,
    data: { stoppedAt: '2099-01-01T00:00:00Z' },
  })
  expect(unchanged.stoppedAt).toBe(stopped.stoppedAt)
  expect(await assignExperiment(payload, context, pageID)).toBeNull()
  await expect(
    payload.update({
      collection: 'experiments',
      id: plan.id,
      user,
      overrideAccess: false,
      data: { state: 'ready' },
    }),
  ).rejects.toThrow()
})
test('retaining a chosen variant copies only CTA text into the current draft and never publishes', async () => {
  const { payload } = fixture,
    plan = await experiment()
  await expect(retainExperimentVariant(payload, user, plan.id, 'treatment')).rejects.toThrow('Stop')
  await payload.update({
    collection: 'pages',
    id: pageID,
    user,
    overrideAccess: false,
    draft: true,
    data: { title: 'Unrelated private draft title' },
  })
  await payload.update({
    collection: 'experiments',
    id: plan.id,
    user,
    overrideAccess: false,
    data: { state: 'stopped' },
  })
  expect(await retainExperimentVariant(payload, user, plan.id, 'treatment')).toBe(pageID)
  const draft = await payload.findByID({
    collection: 'pages',
    id: pageID,
    user,
    overrideAccess: false,
    draft: true,
  })
  expect(draft).toMatchObject({
    title: 'Unrelated private draft title',
    inquiryButtonLabel: plan.treatmentLabel,
  })
  const published = await payload.findByID({
    collection: 'pages',
    id: pageID,
    overrideAccess: false,
    draft: false,
  })
  expect(published.title).toBe('Synthetic experiment landing')
  expect(published.inquiryButtonLabel).not.toBe(plan.treatmentLabel)
})
test('private reports reject anonymous and conditional access and show an honest empty sample', async () => {
  const { payload } = fixture
  await experiment()
  await expect(experimentReport(payload, null)).rejects.toMatchObject({ status: 401 })
  const read = payload.collections.experiments.config.access.read
  payload.collections.experiments.config.access.read = () => ({ id: { equals: 1 } })
  try {
    await expect(experimentReport(payload, user)).rejects.toMatchObject({ status: 403 })
  } finally {
    payload.collections.experiments.config.access.read = read
  }
  const result = await report()
  expect(result.variants.every((v) => !v.interval && v.assigned === 0)).toBe(true)
  expect(result.thresholdsMet).toBe(false)
})

test('explicit local live gate exercises the runtime while simulation identifiers cannot enter live totals', async () => {
  const { payload } = fixture
  const live = await experiment('live'),
    simulation = await experiment()
  const context = { visitor: browser(live.id).visitor }
  const previous = process.env.LUNIA_EXPERIMENTS_ENABLED
  process.env.LUNIA_EXPERIMENTS_ENABLED = 'true'
  try {
    expect(await assignExperiment(payload, context, pageID)).toMatchObject({
      experiment: live.id,
      simulation: false,
    })
    await exposeExperiment(payload, context, live.id, pageID)
    await convertExperiment(payload, context, service, true)
    const simulated = browser(simulation.id)
    expect(await assignExperiment(payload, simulated, pageID)).toMatchObject({
      experiment: simulation.id,
      simulation: true,
    })
    await exposeExperiment(payload, simulated, live.id, pageID)
    const result = await experimentReport(payload, user)
    expect(
      result.experiments
        .find((e) => e.id === live.id)!
        .variants.reduce((n, v) => n + v.converted, 0),
    ).toBe(1)
    expect(
      result.experiments
        .find((e) => e.id === simulation.id)!
        .variants.reduce((n, v) => n + v.exposed, 0),
    ).toBe(0)
  } finally {
    if (previous === undefined) delete process.env.LUNIA_EXPERIMENTS_ENABLED
    else process.env.LUNIA_EXPERIMENTS_ENABLED = previous
  }
})
