import type { AdminViewServerProps } from 'payload'
import { studioWorkspace } from '../studio-days/queries'
import { WorkspaceTemplate } from './Workspace.server'
import { StudioWorkspace } from './StudioWorkspace'
export async function StudioDaysView(props: AdminViewServerProps) {
  const { req } = props.initPageResult
  if (!req.user) return null
  const segment = props.params?.segments?.at(-1)
  const id = segment && /^\d+$/.test(segment) ? Number(segment) : undefined
  return (
    <WorkspaceTemplate props={props}>
      <StudioWorkspace initial={await studioWorkspace(req.payload, req.user, id)} />
    </WorkspaceTemplate>
  )
}
