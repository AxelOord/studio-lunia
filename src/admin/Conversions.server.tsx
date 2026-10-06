import type { AdminViewServerProps } from 'payload'
import { conversionOverview } from '../reporting/queries'
import { ReportInputError } from '../reporting/domain'
import { WorkspaceTemplate } from './Workspace.server'
import { ConversionOverview } from './ConversionOverview'

export async function ConversionsView(props: AdminViewServerProps) {
  const { req } = props.initPageResult
  if (!req.user) return null
  let initial,
    error = ''
  try {
    initial = await conversionOverview(req.payload, req.user, props.searchParams || {})
  } catch (cause) {
    error =
      cause instanceof ReportInputError
        ? cause.message
        : 'The conversion overview could not load. Try again.'
  }
  return (
    <WorkspaceTemplate props={props}>
      <ConversionOverview initial={initial} initialError={error} />
    </WorkspaceTemplate>
  )
}
