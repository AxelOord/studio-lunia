import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanupAPI } from './preview-cleanup-api.mjs'
import { policy } from './preview-cleanup-approval.mjs'
import adoptions from './preview-ownership-adoptions.json' with { type: 'json' }
import { withCleanupLock } from './preview-cleanup.mjs'
import {
  scope,
  requireCleanup,
  reasonFor,
  prNumber,
  githubContext,
  ownedProject,
  deploymentIdentity,
} from './preview-cleanup-identity.mjs'
import {
  validateOwnership,
  appendOwnership,
  inspectAliases,
  emptyOwnership,
} from './preview-ownership.mjs'

const manifestPath = fileURLToPath(new URL('./preview-ownership-manifest.json', import.meta.url))

export function requireRegistrationApproval(env, config = policy) {
  requireCleanup(config.ownershipRegistrationEnabled === true, 'ownership-registration-disabled')
  requireCleanup(
    env.GITHUB_ACTIONS === 'true' &&
      env.GITHUB_REPOSITORY === scope.repository &&
      env.GITHUB_REF === `refs/heads/${scope.defaultBranch}` &&
      /^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') &&
      env.LUNIA_PREVIEW_REGISTRATION_APPROVED_SHA === env.GITHUB_SHA,
    'registration-approval-missing',
  )
}

// Read-only proposal. The caller's exact binding is an INTENT to review, not API
// proof of exclusive use. It becomes authority only in reviewed default-branch data.
export async function captureOwnership(
  api,
  intent,
  workflowSha,
  kind = 'reviewed-adoption',
  now = Date.now(),
) {
  requireCleanup(
    intent &&
      isDeepStrictEqual(
        Object.keys(intent).sort(),
        'scope disposable prNumber branch prHead deploymentId commit aliases'.split(' ').sort(),
      ) &&
      isDeepStrictEqual(intent?.scope, scope) &&
      intent.disposable === 'exclusive-pr-preview' &&
      /^[a-f0-9]{40}$/.test(workflowSha) &&
      ['reviewed-adoption', 'trusted-provisioning'].includes(kind) &&
      Array.isArray(intent.aliases) &&
      intent.aliases.length > 0 &&
      intent.aliases.length <= 100 &&
      intent.aliases.every(
        (alias) => alias && isDeepStrictEqual(Object.keys(alias).sort(), ['hostname', 'id']),
      ),
    'invalid-registration-intent',
  )
  const number = prNumber(intent.prNumber)
  const { context, commits } = await githubContext(api, number, true)
  requireCleanup(
    intent.branch === context.branch && intent.prHead === context.head,
    'registration-pr-mismatch',
  )
  const project = await api.project()
  ownedProject(project)
  requireCleanup(
    project.targets &&
      typeof project.targets === 'object' &&
      !Array.isArray(project.targets) &&
      Object.values(project.targets).every(
        (target) => target && /^dpl_[A-Za-z0-9]+$/.test(target.id),
      ),
    'project-targets-unverified',
  )
  requireCleanup(/^dpl_[A-Za-z0-9]+$/.test(intent.deploymentId), 'invalid-deployment-id')
  const detail = await api.deployment(intent.deploymentId)
  requireCleanup(detail?.id === intent.deploymentId, 'registration-deployment-missing')
  const identity = deploymentIdentity(detail, context, commits)
  requireCleanup(identity.commit === intent.commit, 'registration-commit-mismatch')
  requireCleanup(
    !Object.values(project.targets).some((target) => target.id === detail.id),
    'deployment-is-project-target',
  )
  const assigned = await api.aliases(detail.id)
  requireCleanup(
    Array.isArray(assigned) &&
      assigned.length === intent.aliases.length &&
      new Set(assigned.map((alias) => alias.uid)).size === assigned.length &&
      new Set(assigned.map((alias) => alias.alias)).size === assigned.length &&
      assigned.every((alias) =>
        intent.aliases.some((item) => item.id === alias.uid && item.hostname === alias.alias),
      ),
    'registration-alias-inventory-changed',
  )
  const aliases = await inspectAliases(api, project, detail, intent.aliases)
  const nativeBranch = api.nativeBranch ? await api.nativeBranch(context.branch) : null
  if (api.nativeBranch)
    requireCleanup(nativeBranch != null, 'native-branch-missing-before-registration')
  // Recheck the PR after provider reads, including ref reuse/reopen/head changes.
  const latest = await githubContext(api, number, true)
  requireCleanup(
    isDeepStrictEqual(latest.context, context) && latest.commits.has(identity.commit),
    'registration-pr-changed',
  )
  const record = {
    disposable: 'exclusive-pr-preview',
    pr: { number, branch: context.branch, createdAt: context.createdAt, head: context.head },
    deployment: { id: identity.id, commit: identity.commit, createdAt: identity.createdAt },
    aliases,
    nativeBranch,
    registration: { kind, workflowSha, registeredAt: now },
  }
  validateOwnership({ ...emptyOwnership(), records: [record] })
  return record
}

export async function registerOwnership(
  api,
  manifest,
  request,
  env,
  config = policy,
  reviewed = adoptions,
) {
  requireRegistrationApproval(env, config)
  validateOwnership(manifest)
  let intent
  if (request.kind === 'reviewed-adoption') {
    requireCleanup(Array.isArray(reviewed.intents), 'invalid-reviewed-adoptions')
    const matches = reviewed.intents.filter((item) => item.deploymentId === request.deploymentId)
    requireCleanup(matches.length === 1, 'adoption-not-reviewed')
    intent = matches[0]
  } else {
    requireCleanup(
      request.kind === 'trusted-provisioning' && config.trustedProvisioningClaimsEnabled === true,
      'trusted-provisioning-not-enabled',
    )
    // The host must authenticate completion and supply its own exclusive binding;
    // forwarding webhook/PR fields into this argument is not that trust contract.
    intent = request.intent
  }
  const record = await captureOwnership(api, intent, env.GITHUB_SHA, request.kind)
  if (request.kind === 'trusted-provisioning')
    requireCleanup(
      typeof config.ownershipProvisioningAfter === 'string' &&
        Number.isFinite(Date.parse(config.ownershipProvisioningAfter)) &&
        record.deployment.createdAt >= Date.parse(config.ownershipProvisioningAfter),
      'provisioning-record-predates-policy',
    )
  return appendOwnership(manifest, record)
}

export async function writeOwnershipCandidate(path, expected, manifest) {
  validateOwnership(manifest)
  return withCleanupLock(`${path}.lock`, async () => {
    requireCleanup(readFileSync(path, 'utf8') === expected, 'ownership-snapshot-changed')
    const updated = `${JSON.stringify(manifest, null, 2)}\n`
    if (updated === expected) return 'unchanged'
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      writeFileSync(temporary, updated, { flag: 'wx', mode: 0o600 })
      renameSync(temporary, path)
    } finally {
      try {
        unlinkSync(temporary)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    return 'candidate-written'
  })
}

export async function registrationMain(
  args = process.argv.slice(2),
  env = process.env,
  fetcher = fetch,
  config = policy,
  reviewed = adoptions,
) {
  requireCleanup(
    args.length === 2 && ['--capture', '--adopt', '--completion'].includes(args[0]),
    'invalid-registration-arguments',
  )
  // There is no publish command, configurable output path or provider mutation.
  if (args[0] !== '--capture') requireRegistrationApproval(env, config)
  const api = cleanupAPI(env, fetcher, { policy: config })
  if (args[0] === '--capture') {
    const intent = JSON.parse(readFileSync(args[1], 'utf8'))
    requireCleanup(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? ''), 'capture-workflow-sha-missing')
    return { status: 'proposal-only', record: await captureOwnership(api, intent, env.GITHUB_SHA) }
  }
  const expected = readFileSync(manifestPath, 'utf8')
  const request =
    args[0] === '--adopt'
      ? { kind: 'reviewed-adoption', deploymentId: args[1] }
      : { kind: 'trusted-provisioning', intent: JSON.parse(readFileSync(args[1], 'utf8')) }
  const updated = await registerOwnership(api, JSON.parse(expected), request, env, config, reviewed)
  // Never overwrite the consumed manifest: a candidate in the same checkout
  // must not acquire authority under its still-approved, older GITHUB_SHA.
  const directory = mkdtempSync(join(tmpdir(), 'studio-lunia-ownership-candidate-'))
  const candidatePath = join(directory, 'manifest.json')
  try {
    writeFileSync(candidatePath, expected, { flag: 'wx', mode: 0o600 })
    const status = await writeOwnershipCandidate(candidatePath, expected, updated)
    return { status, candidatePath, published: false }
  } catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  registrationMain()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({ status: 'blocked', reason: reasonFor(error) }))
      process.exitCode = 1
    })
}
