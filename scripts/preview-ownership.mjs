import { isDeepStrictEqual } from 'node:util'
import { scope, requireCleanup, protectedRef } from './preview-cleanup-identity.mjs'

export const emptyOwnership = () => ({ schemaVersion: 1, scope: { ...scope }, records: [] })
const commit = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
const time = (value) => Number.isSafeInteger(value) && value > 0
const aliasId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
// This only excludes custom suffixes; it NEVER establishes ownership.
const nativeHostname = (value) =>
  typeof value === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(value)
function keys(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(), expected.split(' ').sort())
  )
}
export function validateOwnership(manifest) {
  requireCleanup(
    keys(manifest, 'schemaVersion scope records') &&
      manifest.schemaVersion === 1 &&
      isDeepStrictEqual(manifest.scope, scope) &&
      Array.isArray(manifest.records) &&
      manifest.records.length <= 2000,
    'invalid-ownership-manifest',
  )
  const deployments = new Set()
  const aliasOwners = new Map()
  for (const record of manifest.records) {
    requireCleanup(
      keys(record, 'disposable pr deployment aliases nativeBranch registration') &&
        record.disposable === 'exclusive-pr-preview' &&
        keys(record.pr, 'number branch createdAt head') &&
        Number.isSafeInteger(record.pr.number) &&
        record.pr.number > 0 &&
        !protectedRef(record.pr.branch) &&
        time(record.pr.createdAt) &&
        commit(record.pr.head) &&
        keys(record.deployment, 'id commit createdAt') &&
        /^dpl_[A-Za-z0-9]+$/.test(record.deployment.id) &&
        commit(record.deployment.commit) &&
        time(record.deployment.createdAt) &&
        Array.isArray(record.aliases) &&
        record.aliases.length <= 100 &&
        keys(record.registration, 'kind workflowSha registeredAt') &&
        ['reviewed-adoption', 'trusted-provisioning'].includes(record.registration.kind) &&
        commit(record.registration.workflowSha) &&
        time(record.registration.registeredAt),
      'invalid-ownership-record',
    )
    requireCleanup(!deployments.has(record.deployment.id), 'duplicate-ownership-deployment')
    deployments.add(record.deployment.id)
    const native = record.nativeBranch
    requireCleanup(
      native === null ||
        (keys(native, 'id projectId name parentId') &&
          /^br-[a-z0-9-]+$/.test(native.id) &&
          /^[a-z0-9-]{1,60}$/.test(native.projectId) &&
          /^br-[a-z0-9-]+$/.test(native.parentId) &&
          native.name === `preview/${record.pr.branch}`),
      'invalid-ownership-native-branch',
    )
    const aliases = new Set()
    for (const alias of record.aliases) {
      requireCleanup(
        keys(alias, 'id hostname createdAt updatedAt') &&
          aliasId(alias.id) &&
          nativeHostname(alias.hostname) &&
          time(alias.createdAt) &&
          (alias.updatedAt === null || time(alias.updatedAt)),
        'invalid-ownership-alias',
      )
      requireCleanup(!aliases.has(alias.id), 'duplicate-ownership-alias')
      aliases.add(alias.id)
      const owner = {
        pr: record.pr.number,
        branch: record.pr.branch,
        createdAt: record.pr.createdAt,
        id: alias.id,
        hostname: alias.hostname,
      }
      for (const key of [`id:${alias.id}`, `host:${alias.hostname}`]) {
        requireCleanup(
          !aliasOwners.has(key) || isDeepStrictEqual(aliasOwners.get(key), owner),
          'ownership-alias-shared-or-recreated',
        )
        aliasOwners.set(key, owner)
      }
    }
  }
  return manifest
}

export function ownershipForPR(manifest, context, commits) {
  validateOwnership(manifest)
  const records = manifest.records.filter((record) => record.pr.number === context.number)
  for (const record of records)
    requireCleanup(
      record.pr.branch === context.branch &&
        record.pr.createdAt === context.createdAt &&
        commits.has(record.pr.head) &&
        commits.has(record.deployment.commit),
      'ownership-pr-changed',
    )
  const native = records
    .filter((record) => record.nativeBranch)
    .map((record) => record.nativeBranch)
  requireCleanup(
    native.every((item) => isDeepStrictEqual(item, native[0])),
    'ownership-native-conflict',
  )
  return { records, nativeBranch: native[0] }
}

export function assertDisposableRouting(alias, deploymentId) {
  requireCleanup(
    alias &&
      aliasId(alias.uid) &&
      nativeHostname(alias.alias) &&
      alias.projectId === scope.projectId &&
      alias.deploymentId === deploymentId &&
      (!alias.deployment || alias.deployment.id === deploymentId) &&
      alias.redirect == null &&
      alias.redirectStatusCode == null &&
      alias.deletedAt == null &&
      alias.microfrontends == null &&
      (alias.protectionBypass == null ||
        (typeof alias.protectionBypass === 'object' &&
          !Array.isArray(alias.protectionBypass) &&
          Object.keys(alias.protectionBypass).length === 0)),
    'alias-routing-protected-or-changed',
  )
  const createdAt = alias.createdAt ?? Date.parse(alias.created)
  requireCleanup(
    time(createdAt) && (alias.updatedAt == null || time(alias.updatedAt)),
    'alias-generation-unverified',
  )
  return { id: alias.uid, hostname: alias.alias, createdAt, updatedAt: alias.updatedAt ?? null }
}

export async function inspectAliases(api, project, detail, expected) {
  requireCleanup(
    (project.microfrontends == null ||
      (project.microfrontends.enabled === false &&
        Array.isArray(project.microfrontends.groupIds) &&
        project.microfrontends.groupIds.length === 0)) &&
      detail.microfrontends == null,
    'microfrontend-preview-protected',
  )
  requireCleanup(
    typeof project.name === 'string' &&
      /^[a-z0-9-]+$/.test(project.name) &&
      detail.team?.id === scope.teamId &&
      typeof detail.team.slug === 'string' &&
      /^[a-z0-9-]+$/.test(detail.team.slug) &&
      typeof detail.creator?.username === 'string' &&
      /^[a-z0-9-]+$/.test(detail.creator.username),
    'shared-alias-names-unverified',
  )
  const sharedNames = new Set([
    `${project.name}.vercel.app`,
    `${project.name}-${detail.team.slug}.vercel.app`,
    `${project.name}-${detail.creator.username}-${detail.team.slug}.vercel.app`,
  ])
  requireCleanup(
    detail.userAliases === undefined ||
      (Array.isArray(detail.userAliases) &&
        detail.userAliases.every((hostname) => typeof hostname === 'string')),
    'user-alias-inventory-unverified',
  )
  requireCleanup(
    typeof api.projectDomains === 'function' && typeof api.alias === 'function',
    'alias-observation-unavailable',
  )
  const domains = await api.projectDomains()
  requireCleanup(
    Array.isArray(domains) &&
      domains.every(
        (domain) =>
          domain.projectId === scope.projectId &&
          typeof domain.name === 'string' &&
          domain.name.length <= 253 &&
          /^(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
            domain.name,
          ),
      ),
    'invalid-project-domain-inventory',
  )
  const seen = new Set()
  const observed = []
  for (const item of expected) {
    requireCleanup(
      aliasId(item.id) && nativeHostname(item.hostname) && !seen.has(item.id),
      'invalid-ownership-alias',
    )
    seen.add(item.id)
    requireCleanup(!detail.userAliases?.includes(item.hostname), 'alias-is-user-supplied')
    requireCleanup(!sharedNames.has(item.hostname), 'alias-is-shared-project-or-author-url')
    requireCleanup(
      !domains.some(
        ({ name }) =>
          name === item.hostname ||
          (name.startsWith('*.') && item.hostname.endsWith(name.slice(1))),
      ),
      'alias-is-project-domain',
    )
    const alias = assertDisposableRouting(await api.alias(item.id), detail.id)
    requireCleanup(
      alias.id === item.id && alias.hostname === item.hostname,
      'alias-identity-changed',
    )
    observed.push(alias)
  }
  return observed.sort((a, b) => a.id.localeCompare(b.id))
}

export async function verifyOwnedAliases(api, project, detail, identity, assigned, records) {
  const record = records.find((item) => item.deployment.id === detail.id)
  requireCleanup(record, 'deployment-has-retained-aliases')
  requireCleanup(
    isDeepStrictEqual(record.deployment, {
      id: identity.id,
      commit: identity.commit,
      createdAt: identity.createdAt,
    }),
    'ownership-deployment-changed',
  )
  const expected = assigned.map((item) => {
    const alias = record.aliases.find(
      (entry) => entry.id === item.uid && entry.hostname === item.alias,
    )
    requireCleanup(alias, 'alias-not-registered')
    requireCleanup(item.redirect == null, 'alias-routing-protected-or-changed')
    return alias
  })
  const observed = await inspectAliases(api, project, detail, expected)
  requireCleanup(
    isDeepStrictEqual(
      observed,
      [...expected].sort((a, b) => a.id.localeCompare(b.id)),
    ),
    'alias-generation-changed',
  )
  return observed
}

export function appendOwnership(manifest, record) {
  validateOwnership(manifest)
  const existing = manifest.records.find((item) => item.deployment.id === record.deployment.id)
  if (existing) {
    // A repeat capture can have a new observation time/SHA; it cannot change authority.
    requireCleanup(
      isDeepStrictEqual({ ...existing, registration: null }, { ...record, registration: null }),
      'ownership-record-immutable',
    )
    return structuredClone(manifest)
  }
  return validateOwnership({ ...structuredClone(manifest), records: [...manifest.records, record] })
}
