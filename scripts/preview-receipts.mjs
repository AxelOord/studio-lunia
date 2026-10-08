import { isDeepStrictEqual } from 'node:util'
import { scope, requireCleanup, sameRepository } from './preview-cleanup-identity.mjs'
import { mergeOwnership, validateOwnership } from './preview-ownership.mjs'
import { receiptWorkflow, receiptPrefix } from './preview-receipts-api.mjs'

export const receiptLifetime = 7 * 24 * 3600000
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
const keys = (value, names) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  isDeepStrictEqual(Object.keys(value).sort(), names.split(' ').sort())

export function approvedProducerShas(env) {
  const shas = (env.LUNIA_PREVIEW_RECEIPT_APPROVED_SHAS ?? '').split(',')
  requireCleanup(
    shas.length <= 20 && shas.every(sha) && new Set(shas).size === shas.length,
    'receipt-producer-approval-missing',
  )
  return new Set(shas)
}

export function makeReceipt(manifest, env, now = Date.now()) {
  validateOwnership(manifest)
  const runId = Number(env.GITHUB_RUN_ID)
  const attempt = Number(env.GITHUB_RUN_ATTEMPT)
  requireCleanup(
    Number.isSafeInteger(runId) &&
      runId > 0 &&
      Number.isSafeInteger(attempt) &&
      attempt > 0 &&
      sha(env.GITHUB_SHA),
    'invalid-receipt-producer',
  )
  const receipt = {
    schemaVersion: 1,
    scope: { ...scope },
    producer: { runId, attempt, workflowSha: env.GITHUB_SHA, event: env.GITHUB_EVENT_NAME },
    issuedAt: now,
    expiresAt: now + receiptLifetime,
    manifest,
  }
  // Leave room for the fixed single-file ZIP headers; never upload a snapshot
  // that the bounded consumer cannot read. No truncation of ownership data.
  requireCleanup(
    Buffer.byteLength(JSON.stringify(receipt)) <= 4 * 1024 * 1024 - 1024,
    'receipt-publication-size-exceeded',
  )
  return receipt
}

export async function loadReceipts(api, base, env, config, now = Date.now()) {
  const manifest = structuredClone(validateOwnership(base))
  if (config.ownershipReceiptsEnabled !== true) return manifest
  const approved = approvedProducerShas(env)
  const workflow = await api.workflow()
  requireCleanup(
    Number.isSafeInteger(workflow.id) &&
      workflow.id > 0 &&
      workflow.path === receiptWorkflow &&
      workflow.state === 'active',
    'receipt-workflow-unverified',
  )
  const runs = new Map()
  const artifacts = await api.artifacts()
  // Every successful producer publishes a complete snapshot, including its prior
  // trusted records. Prefer the newest verified snapshot, not hundreds of copies
  // of the same data. Never fall back after a trusted snapshot fails validation.
  artifacts.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)
  for (const artifact of artifacts) {
    if (!artifact.name.startsWith(receiptPrefix) || artifact.expired === true) continue
    const source = artifact.workflow_run
    const named = /^preview-ownership-([1-9]\d*)-([1-9]\d*)$/.exec(artifact.name)
    if (!named || Number(named[1]) !== source?.id || !Number.isSafeInteger(Number(named[2])))
      continue
    // Names alone grant nothing. Ignore foreign/unapproved producers without downloading.
    if (
      source?.repository_id !== scope.repositoryId ||
      source.head_repository_id !== scope.repositoryId ||
      source.head_branch !== scope.defaultBranch ||
      !approved.has(source.head_sha)
    )
      continue
    const runKey = `${source.id}:${named[2]}`
    if (!runs.has(runKey)) runs.set(runKey, await api.run(source.id, Number(named[2])))
    const run = runs.get(runKey)
    if (
      run.id !== source.id ||
      run.workflow_id !== workflow.id ||
      run.path !== receiptWorkflow ||
      run.head_branch !== scope.defaultBranch ||
      run.head_sha !== source.head_sha ||
      !sameRepository(run.repository) ||
      !sameRepository(run.head_repository) ||
      run.status !== 'completed' ||
      run.conclusion !== 'success' ||
      !['repository_dispatch', 'schedule', 'workflow_dispatch'].includes(run.event)
    )
      continue
    if (
      run.event === 'repository_dispatch' &&
      (!Number.isSafeInteger(config.vercelDispatchSenderId) ||
        config.vercelDispatchSenderId <= 0 ||
        run.actor?.id !== config.vercelDispatchSenderId ||
        run.actor.type !== 'Bot')
    )
      continue
    requireCleanup(
      Number.isSafeInteger(run.run_attempt) &&
        run.run_attempt > 0 &&
        artifact.expired === false &&
        Number.isFinite(Date.parse(artifact.expires_at)),
      'invalid-receipt-expiry',
    )
    if (Date.parse(artifact.expires_at) <= now) continue
    const receipt = await api.receipt(artifact)
    requireCleanup(
      keys(receipt, 'schemaVersion scope producer issuedAt expiresAt manifest') &&
        receipt.schemaVersion === 1 &&
        isDeepStrictEqual(receipt.scope, scope) &&
        keys(receipt.producer, 'runId attempt workflowSha event') &&
        receipt.producer.runId === run.id &&
        receipt.producer.attempt === run.run_attempt &&
        receipt.producer.workflowSha === run.head_sha &&
        receipt.producer.event === run.event &&
        artifact.name === `${receiptPrefix}${run.id}-${run.run_attempt}` &&
        Number.isSafeInteger(receipt.issuedAt) &&
        receipt.issuedAt > 0 &&
        Number.isSafeInteger(receipt.expiresAt) &&
        receipt.expiresAt === receipt.issuedAt + receiptLifetime &&
        receipt.issuedAt <= now + 300000 &&
        receipt.issuedAt >= Date.parse(run.created_at) - 300000 &&
        receipt.issuedAt <= Date.parse(run.updated_at) + 300000 &&
        Math.abs(Date.parse(artifact.created_at) - receipt.issuedAt) <= 300000,
      'invalid-ownership-receipt',
    )
    if (receipt.expiresAt <= now) continue
    validateOwnership(receipt.manifest)
    for (const record of receipt.manifest.records) {
      requireCleanup(
        approved.has(record.registration.workflowSha) ||
          base.records.some((reviewed) => isDeepStrictEqual(reviewed, record)),
        'receipt-registration-code-unapproved',
      )
    }
    return mergeOwnership(manifest, receipt.manifest)
  }
  return manifest
}
