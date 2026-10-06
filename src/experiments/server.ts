import { createHash, createHmac } from 'node:crypto'
import { APIError, createLocalReq, type Payload, type PayloadRequest } from 'payload'
import type { PoolClient } from 'pg'
import { sql } from '@payloadcms/db-postgres'
import { publishedServices } from '../inquiries/services'
import { relationID, transactionDB } from '../customer-records/core'
import { conversionInterval, originalLabel, type Assignment, type Variant } from './domain'
import type { Experiment } from '../payload-types'

export const experimentRead = Symbol.for('studio-lunia.experiment-read')
export type ExperimentVisitor = { id: string; expiresAt: number }
export type ExperimentContext = {
  visitor?: ExperimentVisitor
  simulation?: number
  user?: PayloadRequest['user']
}
export function experimentsEnabled() {
  return process.env.LUNIA_EXPERIMENTS_ENABLED === 'true'
}
export function visitorHash(visitor: ExperimentVisitor) {
  return createHmac('sha256', process.env.PAYLOAD_SECRET!)
    .update('experiment:' + visitor.id)
    .digest('hex')
}
export function chooseVariant(
  experiment: number,
  visitor: string,
  treatmentPercent: number,
): Variant {
  const bucket =
    createHash('sha256').update(`${experiment}:${visitor}`).digest().readUInt32BE(0) / 0x100000000
  return bucket < treatmentPercent / 100 ? 'treatment' : 'control'
}
async function visitorTransaction<T>(
  payload: Payload,
  visitor: ExperimentVisitor,
  work: (db: PoolClient, hash: string) => Promise<T>,
) {
  const db = await payload.db.pool.connect()
  const hash = visitorHash(visitor)
  try {
    await db.query('BEGIN')
    await db.query(
      'INSERT INTO lunia_experiment_visitors (key, expires_at) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [hash, new Date(visitor.expiresAt)],
    )
    const row = await db.query<{ revoked: boolean; expired: boolean }>(
      'SELECT revoked, expires_at <= now() AS expired FROM lunia_experiment_visitors WHERE key=$1 FOR UPDATE',
      [hash],
    )
    if (row.rows[0].revoked || row.rows[0].expired || visitor.expiresAt <= Date.now()) {
      await db.query('COMMIT')
      return null
    }
    const result = await work(db, hash)
    await db.query('COMMIT')
    return result
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
}
export async function revokeExperimentVisitor(payload: Payload, visitor: ExperimentVisitor) {
  // Upsert a tombstone even if a concurrent first assignment has not inserted its row yet.
  await payload.db.pool.query(
    `INSERT INTO lunia_experiment_visitors (key, expires_at, revoked) VALUES ($1,$2,true)
    ON CONFLICT (key) DO UPDATE SET revoked=true`,
    [visitorHash(visitor), new Date(visitor.expiresAt)],
  )
}
function contextMode(context: ExperimentContext) {
  if (context.simulation) return context.user?.collection === 'users' ? 'simulation' : null
  return experimentsEnabled() && !context.user ? 'live' : null
}
async function eligible(
  payload: Payload,
  context: ExperimentContext,
  pageID?: number,
  experimentID?: number,
) {
  const mode = contextMode(context)
  if (!mode || !context.visitor || context.visitor.expiresAt <= Date.now()) return null
  const result = await payload.find({
    collection: 'experiments',
    overrideAccess: false,
    depth: 0,
    limit: 1,
    context: { experimentRead },
    where: {
      and: [
        { mode: { equals: mode } },
        { state: { equals: 'ready' } },
        ...(pageID ? [{ page: { equals: pageID } }] : []),
        ...(context.simulation || experimentID
          ? [{ id: { equals: context.simulation || experimentID } }]
          : []),
      ],
    },
  })
  const experiment = result.docs[0]
  if (!experiment || (experimentID && experiment.id !== experimentID)) return null
  const pages = await payload.find({
    collection: 'pages',
    overrideAccess: false,
    draft: false,
    depth: 0,
    limit: 1,
    where: {
      and: [{ id: { equals: relationID(experiment.page) } }, { _status: { equals: 'published' } }],
    },
  })
  const page = pages.docs[0]
  if (
    !page ||
    page.inquiryService !== experiment.service ||
    (page.inquiryButtonLabel || originalLabel) !== experiment.controlLabel
  )
    return null
  if (!(await publishedServices(payload)).some((service) => service.id === experiment.service))
    return null
  return experiment
}
async function lockPrepared(db: PoolClient, experiment: Experiment) {
  const [source, item] = experiment.service!.split(':')
  const result = await db.query(
    `SELECT e.id FROM experiments e
    JOIN pages p ON p.id=e.page_id
    JOIN pages source ON source.id=$2 AND source._status='published'
    JOIN pages_blocks_services b ON b._parent_id=source.id
    JOIN pages_blocks_services_items i ON i._parent_id=b.id AND i.id=$3
    WHERE e.id=$1 AND e.state='ready' AND p._status='published'
      AND p.inquiry_service=e.service AND COALESCE(NULLIF(p.inquiry_button_label,''),$4)=e.control_label
    FOR SHARE OF e,p,source,b,i`,
    [experiment.id, Number(source), item, originalLabel],
  )
  return Boolean(result.rowCount)
}
export async function assignExperiment(
  payload: Payload,
  context: ExperimentContext,
  page: number,
): Promise<Assignment | null> {
  const experiment = await eligible(payload, context, page)
  if (!experiment || !context.visitor) return null
  return visitorTransaction(payload, context.visitor, async (db, hash) => {
    if (!(await lockPrepared(db, experiment))) return null
    const variant = chooseVariant(experiment.id, hash, experiment.treatmentPercent)
    const row = await db.query<{ variant: Variant }>(
      `INSERT INTO lunia_experiment_enrollments (experiment_id, visitor_key, variant)
      VALUES ($1,$2,$3) ON CONFLICT (experiment_id,visitor_key) DO UPDATE SET visitor_key=EXCLUDED.visitor_key RETURNING variant`,
      [experiment.id, hash, variant],
    )
    const assigned = row.rows[0].variant
    return {
      experiment: experiment.id,
      variant: assigned,
      simulation: experiment.mode === 'simulation',
      label: assigned === 'control' ? experiment.controlLabel! : experiment.treatmentLabel,
    }
  })
}
export async function exposeExperiment(
  payload: Payload,
  context: ExperimentContext,
  experimentID: number,
  page: number,
) {
  const experiment = await eligible(payload, context, page, experimentID)
  if (!experiment || !context.visitor) return
  await visitorTransaction(payload, context.visitor, async (db, hash) => {
    if (!(await lockPrepared(db, experiment))) return
    await db.query(
      `UPDATE lunia_experiment_enrollments SET exposed_at=now()
      WHERE experiment_id=$1 AND visitor_key=$2 AND exposed_at IS NULL`,
      [experiment.id, hash],
    )
  })
}
export async function convertExperiment(
  payload: Payload,
  context: ExperimentContext,
  service: string,
  created: boolean,
) {
  // Called only by the durable enquiry route, never by a public event payload.
  if (!created || !context.visitor || !contextMode(context)) return
  const hash = visitorHash(context.visitor)
  const rows = await payload.db.pool.query<{ experiment_id: number }>(
    `SELECT experiment_id FROM lunia_experiment_enrollments
    WHERE visitor_key=$1 AND exposed_at IS NOT NULL AND converted_at IS NULL`,
    [hash],
  )
  for (const row of rows.rows) {
    const experiment = await eligible(payload, context, undefined, row.experiment_id)
    if (!experiment || experiment.service !== service) continue
    await visitorTransaction(payload, context.visitor, async (db, key) => {
      if (!(await lockPrepared(db, experiment))) return
      await db.query(
        `UPDATE lunia_experiment_enrollments SET converted_at=now()
        WHERE experiment_id=$1 AND visitor_key=$2 AND exposed_at IS NOT NULL
        AND exposed_at >= now() - interval '30 days' AND converted_at IS NULL`,
        [experiment.id, key],
      )
    })
  }
}
export async function authorizeExperiments(
  payload: Payload,
  user: PayloadRequest['user'],
  operation: 'read' | 'update' = 'read',
) {
  if (user?.collection !== 'users') throw new APIError('Sign in to manage experiments.', 401)
  const req = await createLocalReq({ user }, payload)
  if (
    (await payload.collections.experiments.config.access[operation]?.({
      req,
      slug: 'experiments',
    })) !== true
  )
    throw new APIError('Full experiment access is required.', 403)
  return req
}
export async function experimentReport(payload: Payload, user: PayloadRequest['user'], page = 1) {
  await authorizeExperiments(payload, user)
  const records = await payload.find({
    collection: 'experiments',
    user,
    overrideAccess: false,
    depth: 0,
    limit: 10,
    page,
    sort: '-id',
  })
  const counts = await payload.db.pool.query<{
    experiment_id: number
    variant: Variant
    assigned: string
    exposed: string
    converted: string
    first_exposure: Date | null
  }>(
    `SELECT experiment_id,variant,count(*) AS assigned,count(exposed_at) AS exposed,count(converted_at) AS converted,min(exposed_at) AS first_exposure
    FROM lunia_experiment_enrollments WHERE experiment_id=ANY($1::int[]) GROUP BY experiment_id,variant`,
    [records.docs.map((doc) => doc.id)],
  )
  return {
    enabled: experimentsEnabled(),
    page,
    totalPages: records.totalPages,
    experiments: records.docs.map((doc) => {
      const variants = (['control', 'treatment'] as const).map((variant) => {
        const row = counts.rows.find(
          (row) => row.experiment_id === doc.id && row.variant === variant,
        )
        const exposed = Number(row?.exposed || 0),
          converted = Number(row?.converted || 0)
        return {
          variant,
          assigned: Number(row?.assigned || 0),
          exposed,
          converted,
          interval: conversionInterval(converted, exposed),
        }
      })
      const exposures = counts.rows
        .filter((row) => row.experiment_id === doc.id && row.first_exposure)
        .map((row) => row.first_exposure!.getTime())
      const elapsedDays = exposures.length
        ? Math.floor(
            ((doc.stoppedAt ? Date.parse(doc.stoppedAt) : Date.now()) - Math.min(...exposures)) /
              86400000,
          )
        : 0
      return {
        ...doc,
        variants,
        elapsedDays,
        thresholdsMet:
          variants.every((v) => v.exposed >= doc.minimumPerVariant) &&
          elapsedDays >= doc.durationDays,
      }
    }),
  }
}
export async function retainExperimentVariant(
  payload: Payload,
  user: PayloadRequest['user'],
  id: number,
  variant: Variant,
) {
  const req = await authorizeExperiments(payload, user, 'update')
  const transaction = await payload.db.beginTransaction()
  if (!transaction) throw new APIError('Transactions are unavailable.', 503)
  req.transactionID = transaction
  try {
    const db = await transactionDB(req)
    await db.execute(sql`SELECT id FROM experiments WHERE id=${id} FOR UPDATE`)
    const experiment = await payload.findByID({
      collection: 'experiments',
      id,
      req,
      overrideAccess: false,
      depth: 0,
    })
    if (experiment.state !== 'stopped')
      throw new APIError('Stop the experiment before retaining a variant.', 422)
    const page = relationID(experiment.page)!
    await db.execute(sql`SELECT id FROM pages WHERE id=${page} FOR UPDATE`)
    // Read the current draft, preserving unrelated unpublished work. Never publish here.
    const draft = await payload.findByID({
      collection: 'pages',
      id: page,
      req,
      overrideAccess: false,
      draft: true,
      depth: 0,
    })
    if (draft.inquiryService !== experiment.service)
      throw new APIError('The landing service changed. Review the page before copying text.', 422)
    await payload.update({
      collection: 'pages',
      id: page,
      req,
      overrideAccess: false,
      draft: true,
      data: {
        inquiryButtonLabel:
          variant === 'control' ? experiment.controlLabel : experiment.treatmentLabel,
      },
    })
    await payload.db.commitTransaction(transaction)
    return page
  } catch (error) {
    await payload.db.rollbackTransaction(transaction)
    throw error
  }
}
