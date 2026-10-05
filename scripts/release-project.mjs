import assert from 'node:assert/strict'
import { repository } from './release-core.mjs'

export function projectConfig(env = process.env) {
  const owner = env.LUNIA_PROJECT_OWNER
  const number = Number(env.LUNIA_PROJECT_NUMBER)
  assert.equal(owner, 'AxelOord', 'Missing or unapproved Project owner')
  assert.ok(Number.isSafeInteger(number) && number > 0, 'Missing Project number')
  const config = {
    owner,
    number,
    projectUrl: `https://github.com/users/${owner}/projects/${number}`,
  }

  return config
}

export function projectGraphql(token, fetcher = fetch) {
  assert.ok(token, 'LUNIA_PROJECT_TOKEN is required; GITHUB_TOKEN and labels are not fallbacks')
  return async (query, variables) => {
    const response = await fetcher('https://api.github.com/graphql', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })
    assert.ok(response.ok, `Project API failed (${response.status})`)
    const result = await response.json()
    assert.ok(!result.errors && result.data, 'Project API denied or failed the requested operation')
    return result.data
  }
}

export function projectBoard(query, selection) {
  return {
    async setStatus(issues, status) {
      assert.ok(['Development done', 'Done'].includes(status))
      // Resolve every target from the repository API first; only issue nodes are accepted.
      assert.ok(
        issues.every(
          (issue) =>
            Number.isSafeInteger(issue.number) &&
            issue.number > 0 &&
            typeof issue.node_id === 'string' &&
            !issue.pull_request,
        ),
      )
      const response = await query(
        `query ProjectStatusConfig($owner: String!, $number: Int!) {
        user(login: $owner) { projectV2(number: $number) {
          id url closed fields(first: 100) {
            pageInfo { hasNextPage }
            nodes { ... on ProjectV2SingleSelectField { id name options { id name } } }
          }
        } }
      }`,
        { owner: selection.owner, number: selection.number },
      )
      const project = response.user?.projectV2
      assert.ok(project?.id, 'Configured Project is inaccessible')
      assert.equal(
        project.url,
        selection.projectUrl,
        'Project identity does not match approved URL',
      )
      assert.equal(project.closed, false, 'Project is closed')
      assert.equal(project.fields.pageInfo.hasNextPage, false, 'Incomplete Project field inventory')
      const fields = project.fields.nodes.filter((value) => value.name === 'Status')
      assert.equal(fields.length, 1, 'Exactly one Project Status field is required')
      const field = fields[0]
      const development = field.options.filter((value) => value.name === 'Development done')
      const done = field.options.filter((value) => value.name === 'Done')
      assert.equal(development.length, 1, 'Exactly one Development done option is required')
      assert.equal(done.length, 1, 'Exactly one Done option is required')
      const config = {
        projectId: project.id,
        fieldId: field.id,
        developmentId: development[0].id,
        doneId: done[0].id,
      }
      assert.notEqual(config.developmentId, config.doneId)
      const option = status === 'Development done' ? config.developmentId : config.doneId
      const items = []
      let cursor = null
      for (let page = 0; ; page++) {
        assert.ok(page < 100, 'Incomplete Project item inventory; refusing to mutate')
        const { node } = await query(
          `query ProjectStatusItems($id: ID!, $cursor: String) {
          node(id: $id) { ... on ProjectV2 {
            items(first: 100, after: $cursor, archivedStates: [ARCHIVED, NOT_ARCHIVED]) {
              pageInfo { hasNextPage endCursor }
              nodes { id isArchived
                content { ... on Issue { id number repository { nameWithOwner } } }
                fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { optionId } }
              }
            }
          } }
        }`,
          { id: config.projectId, cursor },
        )
        assert.ok(node?.items, 'Project items are inaccessible')
        items.push(...node.items.nodes)
        if (!node.items.pageInfo.hasNextPage) break
        const next = node.items.pageInfo.endCursor
        assert.ok(next && next !== cursor, 'Project pagination did not advance')
        cursor = next
      }
      const plans = issues.map((issue) => {
        const matches = items.filter((item) => item.content?.id === issue.node_id)
        assert.ok(matches.length <= 1, 'Ambiguous Project issue membership')
        const item = matches[0]
        if (item) {
          assert.equal(item.content.repository.nameWithOwner, repository)
          assert.equal(item.content.number, issue.number)
          assert.equal(
            item.isArchived,
            false,
            'Unarchive the selected issue explicitly before automation',
          )
        }
        return { issue, item }
      })
      // All field/options/items are validated before the first write. No label fallback.
      for (const { issue, item } of plans) {
        const current = item?.fieldValueByName?.optionId
        if (current === option || (status === 'Development done' && current === config.doneId))
          continue
        let itemId = item?.id
        if (!itemId) {
          const added = await query(
            `mutation AddCompletedIssue($project: ID!, $issue: ID!) {
            addProjectV2ItemById(input: {projectId: $project, contentId: $issue}) { item { id } }
          }`,
            { project: config.projectId, issue: issue.node_id },
          )
          itemId = added.addProjectV2ItemById?.item?.id
          assert.ok(itemId, 'Cannot add the completed issue to the approved Project')
        }
        const updated = await query(
          `mutation SetCompletionStatus($project: ID!, $item: ID!, $field: ID!, $option: String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $project, itemId: $item, fieldId: $field,
            value: { singleSelectOptionId: $option }
          }) { projectV2Item { id fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { optionId } } } }
        }`,
          { project: config.projectId, item: itemId, field: config.fieldId, option },
        )
        assert.equal(updated.updateProjectV2ItemFieldValue?.projectV2Item?.id, itemId)
        assert.equal(
          updated.updateProjectV2ItemFieldValue.projectV2Item.fieldValueByName?.optionId,
          option,
        )
      }
    },
  }
}
