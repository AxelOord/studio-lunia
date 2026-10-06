import Link from 'next/link'
import { DefaultTemplate } from '@payloadcms/ui/rsc'
import type { ReactNode } from 'react'
import type { AdminViewServerProps } from 'payload'
import { inbox, workspace, planQueue } from '../followups/queries'
import { CustomerWorkspace } from './CustomerWorkspace'
import { EnquiryInbox, FollowUpQueue } from './WorkspaceLists'

export async function InboxView({ initPageResult: { req }, searchParams }: AdminViewServerProps) {
  if (!req.user) return null
  const filter =
    typeof searchParams?.filter === 'string' &&
    ['all', 'new', 'waiting', 'upcoming', 'attention'].includes(searchParams.filter)
      ? searchParams.filter
      : 'all'
  const page =
    typeof searchParams?.page === 'string' && /^\d{1,4}$/.test(searchParams.page)
      ? Math.max(1, Number(searchParams.page))
      : 1
  return (
    <EnquiryInbox
      initial={await inbox(req.payload, req.user, { filter, page })}
      initialFilter={filter}
    />
  )
}
export async function CustomerView(props: AdminViewServerProps) {
  const {
    initPageResult: { req },
    params,
  } = props
  if (!req.user) return null
  const id = Number(params?.segments?.at(-1))
  if (!Number.isSafeInteger(id) || id < 1)
    return (
      <p>
        Customer not found. <Link href="/admin">Back to inbox</Link>
      </p>
    )
  return (
    <WorkspaceTemplate props={props}>
      <CustomerWorkspace
        initial={await workspace(req.payload, req.user, id, {
          enquiry: props.searchParams?.enquiry,
          plan: props.searchParams?.plan,
        })}
      />
    </WorkspaceTemplate>
  )
}
export async function FollowUpsView(props: AdminViewServerProps) {
  const {
    initPageResult: { req },
  } = props
  if (!req.user) return null
  const filter =
    typeof props.searchParams?.filter === 'string' &&
    ['all', 'attention', 'planned', 'paused', 'finished'].includes(props.searchParams.filter)
      ? props.searchParams.filter
      : 'all'
  const page =
    typeof props.searchParams?.page === 'string' && /^\d{1,4}$/.test(props.searchParams.page)
      ? Math.max(1, Number(props.searchParams.page))
      : 1
  const initial = await planQueue(req.payload, req.user, { filter, page })
  return (
    <WorkspaceTemplate props={props}>
      <FollowUpQueue initial={initial} initialFilter={filter} />
    </WorkspaceTemplate>
  )
}

export function WorkspaceTemplate({
  props,
  children,
}: {
  props: AdminViewServerProps
  children: ReactNode
}) {
  const { req, permissions, visibleEntities } = props.initPageResult
  return (
    <DefaultTemplate
      payload={req.payload}
      i18n={req.i18n}
      user={req.user || undefined}
      req={req}
      permissions={permissions}
      visibleEntities={{
        collections: visibleEntities.collections,
        globals: visibleEntities.globals,
      }}
      params={props.params}
      searchParams={props.searchParams}
    >
      {children}
    </DefaultTemplate>
  )
}
