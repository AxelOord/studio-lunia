import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { policy } from './preview-cleanup-approval.mjs'
import { cleanupAPI } from './preview-cleanup-api.mjs'
import {
  scope,
  requireCleanup,
  reasonFor,
  sameRepository,
  githubContext,
  deploymentIdentity,
} from './preview-cleanup-identity.mjs'
import { requireRegistrationApproval, registerOwnership } from './preview-register.mjs'
import { receiptsAPI, receiptPrefix } from './preview-receipts-api.mjs'
import { loadReceipts, makeReceipt, approvedProducerShas } from './preview-receipts.mjs'
import manifest from './preview-ownership-manifest.json' with { type: 'json' }
import adoptions from './preview-ownership-adoptions.json' with { type: 'json' }
import { withCleanupLock, cleanupLockPath } from './preview-cleanup.mjs'
import { assertProspectiveAliases } from './preview-ownership.mjs'

export function intakeEvent(env, event, config = policy) {
  requireRegistrationApproval(env, config)
  requireCleanup(config.ownershipReceiptsEnabled === true, 'ownership-receipts-disabled')
  requireCleanup(approvedProducerShas(env).has(env.GITHUB_SHA), 'receipt-producer-approval-missing')
  requireCleanup(
    sameRepository(event.repository) && event.repository.default_branch === scope.defaultBranch,
    'wrong-event-repository',
  )
  if (['schedule', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) return null
  requireCleanup(
    env.GITHUB_EVENT_NAME === 'repository_dispatch' &&
      event.action === 'vercel.deployment.success' &&
      Number.isSafeInteger(config.vercelDispatchSenderId) &&
      config.vercelDispatchSenderId > 0 &&
      event.sender?.id === config.vercelDispatchSenderId &&
      event.sender.type === 'Bot' &&
      String(event.sender.id) === env.GITHUB_ACTOR_ID,
    'untrusted-vercel-completion',
  )
  const data = event.client_payload
  requireCleanup(
    data?.project?.id === scope.projectId &&
      data.environment === 'preview' &&
      /^dpl_[A-Za-z0-9]+$/.test(data.id) &&
      typeof data.git?.ref === 'string' &&
      /^[a-f0-9]{40}$/.test(data.git?.sha),
    'invalid-vercel-completion',
  )
  return { id: data.id, branch: data.git.ref, commit: data.git.sha }
}

export async function collectOwnership(
  api,
  stored,
  env,
  config,
  reviewed = adoptions,
  completion = null,
) {
  requireRegistrationApproval(env, config)
  const prospective =
    config.trustedProvisioningClaimsEnabled === true &&
    config.prospectiveNativeAliasesExclusive === true
  requireCleanup(Array.isArray(reviewed.intents), 'invalid-reviewed-adoptions')
  let updated = structuredClone(stored)
  const results = []
  // A success event is a wake-up. Its URL, ownership claim and PR number are not trusted.
  const inventory = await api.pullRequests()
  requireCleanup(Array.isArray(inventory), 'invalid-pr-inventory')
  const candidates = inventory.filter(
    (pr) =>
      sameRepository(pr.head?.repo) &&
      sameRepository(pr.base?.repo) &&
      pr.base.ref === 'develop' &&
      (!completion || pr.head.ref === completion.branch),
  )
  if (completion) requireCleanup(candidates.length === 1, 'completion-pr-unverified')
  for (const pr of candidates) {
    try {
      const { context, commits } = await githubContext(api, pr.number, true)
      const rows = completion ? [{ uid: completion.id }] : await api.deployments(context.branch)
      const seen = new Set()
      for (const row of rows) {
        requireCleanup(
          /^dpl_[A-Za-z0-9]+$/.test(row.uid) && !seen.has(row.uid),
          'invalid-deployment-inventory',
        )
        seen.add(row.uid)
        const detail = await api.deployment(row.uid)
        if (completion)
          requireCleanup(
            detail?.id === completion.id &&
              detail.meta?.githubCommitRef === completion.branch &&
              detail.meta?.githubCommitSha === completion.commit &&
              detail.readyState === 'READY',
            'completion-provenance-changed',
          )
        if (!detail) continue // Inventory raced disappearance; no new authority.
        deploymentIdentity(detail, context, commits)
        if (updated.records.some((record) => record.deployment.id === row.uid)) continue
        const adoption = reviewed.intents.find((intent) => intent.deploymentId === detail.id)
        let request
        if (adoption) request = { kind: 'reviewed-adoption', deploymentId: detail.id }
        else {
          if (!prospective) continue
          requireCleanup(
            typeof config.ownershipProvisioningAfter === 'string' &&
              Number.isFinite(Date.parse(config.ownershipProvisioningAfter)),
            'provisioning-policy-cutoff-missing',
          )
          // Earlier unadopted resources retain no authority; they must not prevent
          // registration of separately eligible newer deployments on this same PR.
          if (detail.createdAt < Date.parse(config.ownershipProvisioningAfter)) continue
          const aliases = await api.aliases(detail.id)
          requireCleanup(Array.isArray(aliases), 'invalid-alias-inventory')
          if (aliases.length) {
            const project = await api.project()
            assertProspectiveAliases(project, detail, context, aliases, await api.pullRequests())
          }
          request = {
            kind: 'trusted-provisioning',
            intent: {
              scope: { ...scope },
              disposable: 'exclusive-pr-preview',
              prNumber: pr.number,
              branch: context.branch,
              prHead: context.head,
              deploymentId: detail.id,
              commit: detail.meta.githubCommitSha,
              aliases: aliases.map((alias) => ({ id: alias.uid, hostname: alias.alias })),
            },
          }
        }
        updated = await registerOwnership(api, updated, request, env, config, reviewed)
      }
      // Do not publish newly captured records if closure/reopen/head/ref changes during the batch.
      const latest = await githubContext(api, pr.number, true)
      requireCleanup(isDeepStrictEqual(latest.context, context), 'registration-pr-changed')
      results.push({ number: pr.number, status: 'observed' })
    } catch (error) {
      // A failed PR must not partially gain new authority. Other independently owned PRs may proceed.
      updated.records = updated.records.filter(
        (record) =>
          record.pr.number !== pr.number ||
          stored.records.some((old) => isDeepStrictEqual(old, record)),
      )
      results.push({ number: pr.number, status: 'blocked', reason: reasonFor(error) })
    }
  }
  if (completion)
    requireCleanup(
      candidates.length === 1 && results[0]?.status === 'observed',
      'completion-registration-blocked',
    )
  return { manifest: updated, results }
}

export async function intakeMain(
  env = process.env,
  fetcher = fetch,
  config = policy,
  reviewed = adoptions,
) {
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))
  const completion = intakeEvent(env, event, config)
  requireCleanup(env.RUNNER_TEMP && env.GITHUB_OUTPUT, 'trusted-runner-paths-missing')
  return withCleanupLock(cleanupLockPath, async () => {
    const stored = await loadReceipts(receiptsAPI(env, fetcher), manifest, env, config)
    const api = cleanupAPI(
      { ...env, LUNIA_VERCEL_CLEANUP_TOKEN: env.LUNIA_VERCEL_REGISTRATION_READ_TOKEN },
      fetcher,
      { policy: config },
    )
    const collected = await collectOwnership(api, stored, env, config, reviewed, completion)
    const receipt = makeReceipt(collected.manifest, env)
    const directory = join(env.RUNNER_TEMP, 'preview-ownership-receipt')
    mkdirSync(directory, { mode: 0o700 })
    const path = join(directory, 'ownership.json')
    writeFileSync(path, `${JSON.stringify(receipt)}\n`, { flag: 'wx', mode: 0o600 })
    // Only runner-owned paths and numeric IDs enter action outputs; no provider data.
    requireCleanup(!/[\r\n]/.test(path), 'invalid-runner-path')
    appendFileSync(
      env.GITHUB_OUTPUT,
      `path=${path}\nname=${receiptPrefix}${receipt.producer.runId}-${receipt.producer.attempt}\n`,
    )
    return {
      status: 'receipt-prepared',
      published: false,
      records: collected.manifest.records.length,
      results: collected.results,
    }
  })
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  intakeMain()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({ status: 'blocked', reason: reasonFor(error) }))
      process.exitCode = 1
    })
}
