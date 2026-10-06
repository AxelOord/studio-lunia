import type { AdminViewServerProps } from 'payload'
import { experimentReport } from '../experiments/server'
import { WorkspaceTemplate } from './Workspace.server'
import { ExperimentResults } from './ExperimentResults'

export async function ExperimentsView(props: AdminViewServerProps) {
  const { req } = props.initPageResult
  if (!req.user) return null
  let report,
    error = ''
  try {
    const requested = props.searchParams?.page
    const page =
      typeof requested === 'string' && /^[1-9]\d{0,5}$/.test(requested) ? Number(requested) : 1
    report = await experimentReport(req.payload, req.user, page)
  } catch {
    error = 'Experiment results could not load. Reload to try again.'
  }
  return (
    <WorkspaceTemplate props={props}>
      <ExperimentResults report={report} error={error} />
    </WorkspaceTemplate>
  )
}
