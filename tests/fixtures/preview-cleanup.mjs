import { scope } from '../../scripts/preview-cleanup-identity.mjs'

export const head = 'a'.repeat(40)
export const previous = 'b'.repeat(40)
export function fixture() {
  const repo = { id: scope.repositoryId, full_name: scope.repository, default_branch: 'master' }
  const pr = {
    number: 91,
    state: 'closed',
    merged: false,
    created_at: '2026-01-01T00:00:00Z',
    closed_at: '2026-01-03T00:00:00Z',
    head: { repo: { ...repo }, ref: 'feat/owned-preview', sha: head },
    base: { repo: { ...repo }, ref: 'develop' },
  }
  const project = {
    id: scope.projectId,
    accountId: scope.teamId,
    targets: {},
    link: {
      type: 'github',
      repoId: scope.repositoryId,
      org: 'AxelOord',
      repo: 'studio-lunia',
      productionBranch: 'master',
    },
  }
  function deployment(id, commit, createdAt) {
    return {
      id,
      projectId: scope.projectId,
      target: null,
      source: 'git',
      readyState: 'READY',
      createdAt,
      meta: {
        githubOrg: 'AxelOord',
        githubRepo: 'studio-lunia',
        githubCommitRef: pr.head.ref,
        githubCommitSha: commit,
      },
      gitSource: { type: 'github', repoId: scope.repositoryId, ref: pr.head.ref, sha: commit },
    }
  }
  const rows = new Map([
    ['dpl_old', deployment('dpl_old', previous, Date.parse('2026-01-01T12:00:00Z'))],
    ['dpl_last', deployment('dpl_last', head, Date.parse('2026-01-02T00:00:00Z'))],
  ])
  const state = {
    repo,
    pr,
    project,
    rows,
    prs: [pr],
    branch: null,
    commits: [{ sha: previous }, { sha: head }],
    deleted: [],
  }
  const api = {
    repository: async () => structuredClone(state.repo),
    project: async () => structuredClone(state.project),
    pullRequest: async () => structuredClone(state.pr),
    pullRequests: async () => structuredClone(state.prs),
    branch: async () => structuredClone(state.branch),
    commits: async () => structuredClone(state.commits),
    aliases: async () => [],
    deployments: async () => [...rows.keys()].map((uid) => ({ uid })),
    deployment: async (id) => structuredClone(rows.get(id) ?? null),
    deleteDeployment: async (id) => {
      state.deleted.push(id)
      return rows.delete(id) ? 'deleted' : 'already-absent'
    },
  }
  return { state, api }
}
